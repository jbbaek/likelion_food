
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import os, json, re, pickle
import random

import numpy as np
# import faiss
# from rank_bm25 import BM25Okapi
# from sentence_transformers import SentenceTransformer

# =========================================================
# 0) 설정
# =========================================================
ART_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

RECIPES_PATH = os.path.join(ART_DIR, "recipes.jsonl")
TOKENIZED_PATH = os.path.join(ART_DIR, "tokenized.pkl")
FAISS_PATH = os.path.join(ART_DIR, "faiss.index")
META_PATH = os.path.join(ART_DIR, "meta.pkl")

CAND_TOP_N = int(os.getenv("CAND_TOP_N", "30"))
CAND_PULL = int(os.getenv("CAND_PULL", "90"))

RRF_K = int(os.getenv("RRF_K", "60"))
HARD_MIN_KEEP = int(os.getenv("HARD_MIN_KEEP", "12"))
DIVERSITY_LEVEL = int(os.getenv("DIVERSITY_LEVEL", "2"))

# =========================================================
# 1) FastAPI
# =========================================================
app = FastAPI(title="Recipe Recommender (BM25+FAISS+RuleRerank)")

class ChatReq(BaseModel):
    message: str
    top_k: Optional[int] = 3

# =========================================================
# 2) 유틸
# =========================================================
STOP_CHARS = re.compile(r"[\u200b\ufeff]")

def norm_text(s: Any) -> str:
    if s is None:
        return ""
    s = str(s)
    s = STOP_CHARS.sub("", s)
    s = s.replace("\n", " ").replace("\r", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def tokenize_with_ngrams_for_bm25(s: str) -> List[str]:
    s = norm_text(s).lower()
    base = re.sub(r"[^0-9a-z가-힣\s#]", " ", s)
    base = re.sub(r"\s+", " ", base).strip()
    toks = base.split() if base else []

    joined = re.sub(r"[^0-9a-z가-힣]", "", s)
    ngrams = []
    for n in (2, 3):
        if len(joined) >= n:
            ngrams.extend(joined[i:i+n] for i in range(len(joined) - n + 1))
    return toks + ngrams

def safe_float_list(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype="float32")
    if x.ndim == 1:
        x = x.reshape(1, -1)
    return x

def must_exist(p: str, name: str):
    if not os.path.exists(p):
        raise FileNotFoundError(f"[필수 파일 없음] {name}: {p}")

def clamp_int(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(v)))

def to_float_or_none(v: Any) -> Optional[float]:
    if v is None:
        return None
    s = norm_text(v)
    if s == "":
        return None
    try:
        return float(s)
    except:
        return None

def to_str_or_empty(v: Any) -> str:
    return norm_text(v)

# =========================================================
# ✅ 레시피 전체 필드 추출(요청한 55개 항목)
# =========================================================
def extract_manual_steps(r: Dict[str, Any], max_steps: int = 20) -> List[Dict[str, str]]:
    """
    MANUAL01~20 + MANUAL_IMG01~20을 steps 리스트로 묶어서 반환
    """
    steps: List[Dict[str, str]] = []
    for i in range(1, max_steps + 1):
        k_txt = f"MANUAL{i:02d}"
        k_img = f"MANUAL_IMG{i:02d}"
        txt = to_str_or_empty(r.get(k_txt))
        img = to_str_or_empty(r.get(k_img))
        if txt or img:
            steps.append({
                "step": f"{i:02d}",
                "text": txt,
                "img": img
            })
    return steps

def build_full_recipe_payload(r: Dict[str, Any]) -> Dict[str, Any]:
    """
    ✅ 너가 준 스키마(1~55)에 해당하는 데이터를 전부 포함해서 반환
    - 개별 MANUALxx 필드도 포함 + steps 배열도 추가(프론트에서 쓰기 편함)
    """
    payload: Dict[str, Any] = {
        # 1~14 기본/영양/이미지/재료
        "RCP_SEQ": to_str_or_empty(r.get("RCP_SEQ")),
        "RCP_NM": to_str_or_empty(r.get("RCP_NM")),
        "RCP_WAY2": to_str_or_empty(r.get("RCP_WAY2")),
        "RCP_PAT2": to_str_or_empty(r.get("RCP_PAT2")),

        "INFO_WGT": to_str_or_empty(r.get("INFO_WGT")),  # 원본이 문자열인 경우가 많아서 문자열 유지
        "INFO_ENG": to_str_or_empty(r.get("INFO_ENG")),
        "INFO_CAR": to_str_or_empty(r.get("INFO_CAR")),
        "INFO_PRO": to_str_or_empty(r.get("INFO_PRO")),
        "INFO_FAT": to_str_or_empty(r.get("INFO_FAT")),
        "INFO_NA":  to_str_or_empty(r.get("INFO_NA")),

        "HASH_TAG": to_str_or_empty(r.get("HASH_TAG")),
        "ATT_FILE_NO_MAIN": to_str_or_empty(r.get("ATT_FILE_NO_MAIN")),
        "ATT_FILE_NO_MK":   to_str_or_empty(r.get("ATT_FILE_NO_MK")),
        "RCP_PARTS_DTLS":   to_str_or_empty(r.get("RCP_PARTS_DTLS")),

        # 55 tip
        "RCP_NA_TIP": to_str_or_empty(r.get("RCP_NA_TIP")),
    }

    # 15~54 MANUAL01~20 + MANUAL_IMG01~20 개별 필드 그대로 포함
    for i in range(1, 21):
        payload[f"MANUAL{i:02d}"] = to_str_or_empty(r.get(f"MANUAL{i:02d}"))
        payload[f"MANUAL_IMG{i:02d}"] = to_str_or_empty(r.get(f"MANUAL_IMG{i:02d}"))

    # ✅ 추가 편의 필드(프론트에서 쓰기 쉬움): steps 배열
    payload["MANUAL_STEPS"] = extract_manual_steps(r, max_steps=20)

    return payload

# =========================================================
# 3) 아티팩트 로드
# =========================================================
def load_recipes_jsonl(path: str):
    recipes = []
    seq2idx = {}
    seq2recipe = {}
    with open(path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            recipes.append(obj)
            seq = str(obj.get("RCP_SEQ", "")).strip()
            if seq:
                seq2idx[seq] = idx
                seq2recipe[seq] = obj
    return recipes, seq2idx, seq2recipe

import threading
from fastapi import HTTPException

state = {
    "ready": False,
    "error": None,
    "traceback": None,
    "step": None,
    "started_at": None,
    "finished_at": None,
    "RECIPES": None,
    "SEQ2IDX": None,
    "SEQ2RECIPE": None,
    "TOKENIZED": None,
    "BM25": None,
    "FAISS_INDEX": None,
    "META": None,
    "EMBED_MODEL_NAME": None,
    "EMBED_MODEL": None,
}

import traceback
import time

def load_all_artifacts():
    try:
        state["step"] = "start"
        state["started_at"] = time.time()
        print("① load_all_artifacts 시작", flush=True)
        print("ART_DIR =", ART_DIR, flush=True)
        print("ART_DIR exists =", os.path.isdir(ART_DIR), flush=True)
        print("ART_DIR list =", os.listdir(ART_DIR) if os.path.isdir(ART_DIR) else "NOT FOUND", flush=True)

        state["step"] = "heavy_import"
        import faiss
        from rank_bm25 import BM25Okapi
        from sentence_transformers import SentenceTransformer
        state["step"] = "import_faiss"
        print("②-1 importing faiss...", flush=True)
        import faiss
        print("②-1 faiss OK", flush=True)

        state["step"] = "import_bm25"
        print("②-2 importing rank_bm25...", flush=True)
        from rank_bm25 import BM25Okapi
        print("②-2 bm25 OK", flush=True)

        state["step"] = "import_st"
        print("②-3 importing sentence_transformers...", flush=True)
        from sentence_transformers import SentenceTransformer
        print("②-3 sentence_transformers OK", flush=True)

        print("② bm25 import 성공")

        state["step"] = "check_files"
        print("③ 파일 존재 확인", flush=True)
        must_exist(RECIPES_PATH, "recipes.jsonl")
        must_exist(TOKENIZED_PATH, "tokenized.pkl")
        must_exist(FAISS_PATH, "faiss.index")
        must_exist(META_PATH, "meta.pkl")

        state["step"] = "load_recipes"
        print("④ recipes.jsonl 로드", flush=True)
        RECIPES, SEQ2IDX, SEQ2RECIPE = load_recipes_jsonl(RECIPES_PATH)
        print("   recipes 수:", len(RECIPES), flush=True)

        state["step"] = "load_tokenized"
        print("⑤ tokenized.pkl 로드", flush=True)
        with open(TOKENIZED_PATH, "rb") as f:
            TOKENIZED = pickle.load(f)

        state["step"] = "build_bm25"
        print("⑥ BM25 생성", flush=True)
        BM25 = BM25Okapi(TOKENIZED)

        state["step"] = "load_faiss"
        print("⑦ FAISS index 로드", flush=True)
        FAISS_INDEX = faiss.read_index(FAISS_PATH)

        state["step"] = "load_meta"
        print("⑧ meta.pkl 로드", flush=True)
        with open(META_PATH, "rb") as f:
            META = pickle.load(f)

        EMBED_MODEL_NAME = META.get(
            "embed_model_name",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )

        state["step"] = "load_embed_model"
        print("⑨ 임베딩 모델 로드:", EMBED_MODEL_NAME, flush=True)

        # (옵션) 캐시 경로를 /tmp로 강제해서 Cloud Run에서 안정화
        os.environ.setdefault("HF_HOME", "/tmp/hf")
        os.environ.setdefault("TRANSFORMERS_CACHE", "/tmp/hf")
        os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", "/tmp/hf")

        EMBED_MODEL = SentenceTransformer(EMBED_MODEL_NAME)

        state.update({
            "RECIPES": RECIPES,
            "SEQ2IDX": SEQ2IDX,
            "SEQ2RECIPE": SEQ2RECIPE,
            "TOKENIZED": TOKENIZED,
            "BM25": BM25,
            "FAISS_INDEX": FAISS_INDEX,
            "META": META,
            "EMBED_MODEL_NAME": EMBED_MODEL_NAME,
            "EMBED_MODEL": EMBED_MODEL,
            "ready": True,
            "error": None,
            "step": "done",
            "finished_at": time.time(),
        })

        print("✅ 모든 아티팩트 로딩 완료, ready=True", flush=True)

    except Exception as e:
        state["ready"] = False
        state["error"] = f"{type(e).__name__}: {e}"
        state["traceback"] = traceback.format_exc()
        state["step"] = f"failed_at:{state.get('step')}"
        print("❌ 아티팩트 로딩 실패:", state["error"], flush=True)
        print(state["traceback"], flush=True)


@app.on_event("startup")
def startup():
    # ✅ 서버는 바로 뜨고(포트 리슨), 로딩은 뒤에서
    threading.Thread(target=load_all_artifacts, daemon=True).start()

def ensure_ready():
    if state["error"]:
        raise HTTPException(status_code=500, detail=f"초기화 실패: {state['error']}")
    if not state["ready"]:
        raise HTTPException(status_code=503, detail="서버 준비중입니다. 잠시 후 다시 시도해주세요.")

# =========================================================
# 4) 의도(intent) 추출
# =========================================================
GREASY_HINT = ["느끼", "크림", "치즈", "버터", "마요", "튀김", "고소", "로제", "까르보", "알프레도", "크리미", "생크림"]
SOUP_HINT   = ["국물", "국", "탕", "찌개", "전골", "수프", "나베", "해장", "라면", "우동", "짬뽕"]
SPICY_HINT  = ["매운", "매콤", "얼큰", "칼칼", "화끈", "마라", "불닭", "고추", "청양", "김치"]
SALAD_HINT  = ["샐러드", "다이어트", "가벼운", "상큼", "클린", "저칼로리", "채소", "야채", "드레싱"]

def parse_intent(q: str) -> Dict[str, int]:
    t = q.lower()
    want_greasy = 1 if any(k in t for k in GREASY_HINT) else 0
    want_soup   = 1 if any(k in t for k in SOUP_HINT) else 0
    want_spicy  = 1 if any(k in t for k in SPICY_HINT) else 0
    want_salad  = 1 if any(k in t for k in SALAD_HINT) else 0
    return {
        "want_greasy": want_greasy,
        "want_soup": want_soup,
        "want_spicy": want_spicy,
        "want_salad": want_salad,
    }

# =========================================================
# 5) 후보 검색 (BM25 + FAISS) + RRF 결합
# =========================================================
def bm25_candidates(query: str, top_n: int) -> List[Tuple[int, float]]:
    q_tokens = tokenize_with_ngrams_for_bm25(query)
    BM25 = state["BM25"]
    scores = BM25.get_scores(q_tokens)
    idxs = np.argsort(scores)[::-1][:top_n]
    return [(int(i), float(scores[i])) for i in idxs]

def faiss_candidates(query: str, top_n: int) -> List[Tuple[int, float]]:
    EMBED_MODEL = state["EMBED_MODEL"]
    FAISS_INDEX = state["FAISS_INDEX"]

    q_emb = EMBED_MODEL.encode([query], normalize_embeddings=True)
    D, I = FAISS_INDEX.search(q_emb, top_n)
    I = I[0].tolist()
    D = D[0].tolist()

    out = []
    for i, d in zip(I, D):
        if i is None or int(i) < 0:
            continue
        out.append((int(i), float(d)))
    return out

USE_FAISS = os.getenv("USE_FAISS", "0") == "1"

def rrf_mix_candidates(query: str, top_n: int, pull_n: int, k: int = 60) -> List[Dict[str, Any]]:
    a = bm25_candidates(query, pull_n)

    # ✅ FAISS 비활성 or 로딩 안 됨 → BM25만 사용
    if (not USE_FAISS) or (state.get("FAISS_INDEX") is None) or (state.get("EMBED_MODEL") is None):
        a.sort(key=lambda x: x[1], reverse=True)
        out = []
        RECIPES = state["RECIPES"]
        for idx, score in a[:top_n]:
            r = RECIPES[idx]
            out.append({
                "RCP_SEQ": str(r.get("RCP_SEQ", "")).strip(),
                "RCP_NM": r.get("RCP_NM", ""),
                "RCP_PAT2": r.get("RCP_PAT2", ""),
                "RCP_WAY2": r.get("RCP_WAY2", ""),
                "HASH_TAG": r.get("HASH_TAG", ""),
                "RCP_PARTS_DTLS": r.get("RCP_PARTS_DTLS", ""),
                "auto_tags": r.get("auto_tags", []),
                "is_soupish": r.get("is_soupish", 0),
                "spicy_score": float(r.get("spicy_score", 0.0) or 0.0),
                "greasy_score": float(r.get("greasy_score", 0.0) or 0.0),
                "_mix_score": float(score),  # ✅ BM25 점수로 대체
            })
        return out

    # ✅ FAISS까지 정상 로딩된 경우만 RRF 수행
    b = faiss_candidates(query, pull_n)

    rank_a = {idx: r for r, (idx, _) in enumerate(a)}
    rank_b = {idx: r for r, (idx, _) in enumerate(b)}
    all_ids = list(set(rank_a.keys()) | set(rank_b.keys()))

    scored = []
    for idx in all_ids:
        s = 0.0
        if idx in rank_a:
            s += 1.0 / (k + rank_a[idx])
        if idx in rank_b:
            s += 1.0 / (k + rank_b[idx])
        scored.append((idx, s))

    scored.sort(key=lambda x: x[1], reverse=True)

    out = []
    RECIPES = state["RECIPES"]
    for idx, score in scored[:top_n]:
        r = RECIPES[idx]
        out.append({
            "RCP_SEQ": str(r.get("RCP_SEQ", "")).strip(),
            "RCP_NM": r.get("RCP_NM", ""),
            "RCP_PAT2": r.get("RCP_PAT2", ""),
            "RCP_WAY2": r.get("RCP_WAY2", ""),
            "HASH_TAG": r.get("HASH_TAG", ""),
            "RCP_PARTS_DTLS": r.get("RCP_PARTS_DTLS", ""),
            "auto_tags": r.get("auto_tags", []),
            "is_soupish": r.get("is_soupish", 0),
            "spicy_score": float(r.get("spicy_score", 0.0) or 0.0),
            "greasy_score": float(r.get("greasy_score", 0.0) or 0.0),
            "_mix_score": float(score),
        })
    return out

# =========================================================
# 6) 의도 기반 재정렬 + (조건부) 하드 필터
# =========================================================
def apply_intent_rerank(cands: List[Dict[str, Any]], intent: Dict[str, int]) -> List[Dict[str, Any]]:
    def bad_for_greasy(c):
        name = str(c.get("RCP_NM", ""))
        pat = str(c.get("RCP_PAT2", ""))
        return any(k in name for k in ["나물", "겉절이", "샐러드", "냉국"]) or ("샐러드" in pat)

    def score_boost(c):
        s = float(c.get("_mix_score", 0.0))

        if intent["want_soup"]:
            if int(c.get("is_soupish", 0)) == 1:
                s += 0.25
            if any(k in str(c.get("RCP_PAT2","")) for k in ["국", "탕", "찌개", "전골"]):
                s += 0.12

        if intent["want_greasy"]:
            s += 0.30 * float(c.get("greasy_score", 0.0))
            if bad_for_greasy(c):
                s -= 0.30

        if intent["want_spicy"]:
            s += 0.28 * float(c.get("spicy_score", 0.0))
            nm = str(c.get("RCP_NM",""))
            if any(k in nm for k in ["김치", "매운", "매콤", "얼큰", "마라", "불닭"]):
                s += 0.08

        if intent["want_salad"]:
            name = str(c.get("RCP_NM",""))
            if any(k in name for k in ["샐러드", "채소", "야채"]):
                s += 0.25
            else:
                s -= 0.08

        return s

    out = []
    for c in cands:
        cc = dict(c)
        cc["_intent_score"] = score_boost(c)
        out.append(cc)

    out.sort(key=lambda x: x["_intent_score"], reverse=True)
    return out

def hard_filter_if_possible(cands: List[Dict[str, Any]], intent: Dict[str, int], min_keep: int = 12) -> List[Dict[str, Any]]:
    out = cands

    if intent["want_soup"]:
        tmp = [
            c for c in out
            if int(c.get("is_soupish", 0)) == 1
            or any(k in str(c.get("RCP_PAT2","")) for k in ["국","탕","찌개","전골"])
        ]
        if len(tmp) >= min_keep:
            out = tmp

    if intent["want_spicy"]:
        tmp = [
            c for c in out
            if float(c.get("spicy_score", 0.0)) >= 0.25
            or any(k in str(c.get("RCP_NM","")) for k in ["매운","매콤","얼큰","마라","불닭","김치","고추","청양"])
        ]
        if len(tmp) >= min_keep:
            out = tmp

    if intent["want_salad"]:
        tmp = [
            c for c in out
            if any(k in str(c.get("RCP_NM","")) for k in ["샐러드","채소","야채"])
            or "샐러드" in str(c.get("RCP_PAT2",""))
        ]
        if len(tmp) >= min_keep:
            out = tmp

    if intent["want_greasy"]:
        tmp = [
            c for c in out
            if float(c.get("greasy_score", 0.0)) >= 0.20
            or any(k in str(c.get("RCP_NM","")) for k in ["크림","치즈","버터","로제","까르보","알프레도","튀김"])
        ]
        if len(tmp) >= min_keep:
            out = tmp

    return out

# =========================================================
# 7) 다양성(중복 완화) 선택
# =========================================================
def diversify_pick(cands: List[Dict[str, Any]], top_k: int, level: int = 2) -> List[Dict[str, Any]]:
    if level <= 1:
        return cands[:top_k]

    picked: List[Dict[str, Any]] = []
    used_way = set()
    used_pat = set()

    for c in cands:
        way = str(c.get("RCP_WAY2","")).strip()
        pat = str(c.get("RCP_PAT2","")).strip()

        if level >= 2 and way and way in used_way and len(picked) < top_k:
            continue
        if level >= 3 and pat and pat in used_pat and len(picked) < top_k:
            continue

        picked.append(c)
        if way:
            used_way.add(way)
        if pat:
            used_pat.add(pat)

        if len(picked) >= top_k:
            break

    if len(picked) < top_k:
        for c in cands:
            if all(x.get("RCP_SEQ") != c.get("RCP_SEQ") for x in picked):
                picked.append(c)
            if len(picked) >= top_k:
                break

    return picked[:top_k]

# =========================================================
# 8) 최종 응답 이유 생성
# =========================================================
def build_reply(user_query: str, intent: Dict[str, int], foods: List[Dict[str, Any]]) -> str:
    tags = []
    if intent["want_spicy"]:
        tags.append("얼큰/매콤")
    if intent["want_soup"]:
        tags.append("국물")
    if intent["want_greasy"]:
        tags.append("느끼/고소")
    if intent["want_salad"]:
        tags.append("가벼운")

    if not tags:
        return "요구에 맞는 후보 중에서 골랐어요."
    return f"{', '.join(tags)} 느낌에 맞는 레시피를 우선 추천했어요."

def pick_reason(intent: Dict[str, int], c: Dict[str, Any]) -> str:
    nm = str(c.get("RCP_NM",""))
    pat = str(c.get("RCP_PAT2",""))
    spicy = float(c.get("spicy_score", 0.0))
    greasy = float(c.get("greasy_score", 0.0))
    soupish = int(c.get("is_soupish", 0))

    rs = []
    if intent["want_soup"]:
        if soupish == 1 or any(k in pat for k in ["국","탕","찌개","전골"]):
            rs.append("국물/탕·찌개 계열")
    if intent["want_spicy"]:
        if spicy >= 0.25 or any(k in nm for k in ["김치","매운","매콤","얼큰","마라","불닭"]):
            rs.append("얼큰/매콤 포인트")
    if intent["want_greasy"]:
        if greasy >= 0.20 or any(k in nm for k in ["크림","치즈","로제","까르보","알프레도","튀김"]):
            rs.append("고소/크리미 포인트")

    if not rs:
        if pat:
            rs.append(pat)
        else:
            rs.append("후보 점수 상위")
    return ", ".join(rs[:2])

def weighted_random_pick(cands: List[Dict[str, Any]], k: int, pool: int = 30, temp: float = 0.9) -> List[Dict[str, Any]]:
    """
    cands: 점수 내림차순 후보(이미 tuned된 상태)
    k: 최종 추천 개수
    pool: 상위 몇 개 후보에서 랜덤하게 뽑을지
    temp: 낮을수록 상위가 더 자주 뽑힘(0.7~1.2 추천)
    """
    pool_cands = cands[:max(pool, k)]
    if not pool_cands:
        return []

    # _intent_score 기반 확률 분포 만들기
    scores = np.array([float(c.get("_intent_score", 0.0)) for c in pool_cands], dtype="float32")

    # 모두 0이거나 음수면 균등 랜덤
    if np.all(scores <= 0):
        random.shuffle(pool_cands)
        return pool_cands[:k]

    # 안정적으로 양수화 + temperature 적용
    scores = scores - scores.min() + 1e-6
    weights = np.power(scores, 1.0 / max(temp, 1e-6))

    picked = []
    used = set()
    for _ in range(k):
        # 아직 안 뽑힌 것들만 대상으로 확률 재계산
        idxs = [i for i in range(len(pool_cands)) if i not in used]
        if not idxs:
            break
        w = weights[idxs]
        w = w / w.sum()
        chosen = np.random.choice(idxs, p=w)
        used.add(chosen)
        picked.append(pool_cands[chosen])

    return picked

# =========================================================
# 9) 엔드포인트
# =========================================================
@app.get("/health")
def health():
    return {
        "ok": True,
        "ready": state["ready"],
        "step": state.get("step"),
        "error": state.get("error"),
        "traceback": state.get("traceback"),
        "recipes": len(state["RECIPES"]) if state["RECIPES"] else 0,
        "embed_model": state.get("EMBED_MODEL_NAME"),
        "cand_pull": CAND_PULL,
        "cand_top_n": CAND_TOP_N,
        "rrf_k": RRF_K,
        "hard_min_keep": HARD_MIN_KEEP,
        "diversity_level": DIVERSITY_LEVEL,
    }

@app.post("/chat")
def chat(req: ChatReq):
    ensure_ready()  # ✅ 준비 안 됐으면 503 / 실패면 500
    top_k = clamp_int(req.top_k or 3, 1, 10)
    user_query = norm_text(req.message)

    if not user_query:
        return {"reply": "요청이 비어 있어요.", "foods": []}

    intent = parse_intent(user_query)

    base_cands = rrf_mix_candidates(user_query, top_n=CAND_PULL, pull_n=CAND_PULL, k=RRF_K)
    if not base_cands:
        return {"reply": "추천할 후보를 찾지 못했어요.", "foods": []}

    tuned = apply_intent_rerank(base_cands, intent)
    tuned = hard_filter_if_possible(tuned, intent, min_keep=HARD_MIN_KEEP)

    candidates = tuned[:CAND_TOP_N]
    rand_picks = weighted_random_pick(candidates, k=top_k, pool=30, temp=0.9)
    final_picks = diversify_pick(rand_picks, top_k=top_k, level=DIVERSITY_LEVEL)


    foods = []
    for c in final_picks:
        seq = str(c.get("RCP_SEQ","")).strip()
        SEQ2RECIPE = state["SEQ2RECIPE"]
        r = SEQ2RECIPE.get(seq)

        if not r:
            continue

        # 요청한 55개 필드를 전부 포함한 레시피 payload 생성
        full = build_full_recipe_payload(r)

        # 기존 프론트 호환 필드 + 추천 reason 포함
        foods.append({
            **full,  # <-- 여기서 전체 데이터 포함
            "name": full.get("RCP_NM", ""),
            "reason": pick_reason(intent, c),
        })

    if not foods:
        return {"reply": "후보는 찾았는데 결과 매핑에 실패했어요.", "foods": []}

    reply = build_reply(user_query, intent, foods)
    return {"reply": reply, "foods": foods}
