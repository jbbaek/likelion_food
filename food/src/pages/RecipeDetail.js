// RecipeDetail.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config";

function RecipeDetail() {
  const { seq } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 값 표시용(없으면 -)
  const show = (v, suffix = "") => {
    if (v === null || v === undefined) return "-";
    const s = String(v).trim();
    if (!s) return "-";
    return suffix ? `${s}${suffix}` : s;
  };

  useEffect(() => {
    if (!seq) {
      setLoading(false);
      setError("SEQ가 없습니다. 라우터를 확인하세요.");
      return;
    }

    let alive = true;

    const fetchRecipe = async () => {
      try {
        setLoading(true);
        setError("");
        setRecipe(null);

        const res = await fetch(
          `${API_BASE}/api/recipes/by-seq/${encodeURIComponent(seq)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message || "레시피 정보를 불러오지 못했습니다."
          );
        }

        if (alive) setRecipe(data);
      } catch (err) {
        if (alive) setError(err.message || "오류가 발생했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchRecipe();

    return () => {
      alive = false;
    };
  }, [seq]);

  // ✅ 만드는 법: MANUAL01~20 + MANUAL_IMG01~20
  const steps = useMemo(() => {
    if (!recipe) return [];
    const arr = [];
    for (let i = 1; i <= 20; i++) {
      const key = String(i).padStart(2, "0");
      const txt = recipe[`MANUAL${key}`];
      const img = recipe[`MANUAL_IMG${key}`];

      const hasTxt = txt && String(txt).trim() !== "";
      const hasImg = img && String(img).trim() !== "";
      if (!hasTxt && !hasImg) continue;

      arr.push({
        stepNo: i,
        txt: hasTxt ? String(txt) : "",
        img: hasImg ? String(img) : "",
      });
    }
    return arr;
  }, [recipe]);

  // ✅ 전체 필드(필요할 때만 펼쳐보기 용)
  const fieldRows = useMemo(() => {
    if (!recipe) return [];
    return [
      { no: 1, key: "RCP_SEQ", label: "일련번호", value: recipe.RCP_SEQ },
      { no: 2, key: "RCP_NM", label: "메뉴명", value: recipe.RCP_NM },
      { no: 3, key: "RCP_WAY2", label: "조리방법", value: recipe.RCP_WAY2 },
      { no: 4, key: "RCP_PAT2", label: "요리종류", value: recipe.RCP_PAT2 },
      { no: 5, key: "INFO_WGT", label: "중량(1인분)", value: recipe.INFO_WGT },
      {
        no: 6,
        key: "INFO_ENG",
        label: "열량",
        value: recipe.INFO_ENG,
        suffix: "kcal",
      },
      {
        no: 7,
        key: "INFO_CAR",
        label: "탄수화물",
        value: recipe.INFO_CAR,
        suffix: "g",
      },
      {
        no: 8,
        key: "INFO_PRO",
        label: "단백질",
        value: recipe.INFO_PRO,
        suffix: "g",
      },
      {
        no: 9,
        key: "INFO_FAT",
        label: "지방",
        value: recipe.INFO_FAT,
        suffix: "g",
      },
      {
        no: 10,
        key: "INFO_NA",
        label: "나트륨",
        value: recipe.INFO_NA,
        suffix: "mg",
      },
      { no: 11, key: "HASH_TAG", label: "해시태그", value: recipe.HASH_TAG },
      {
        no: 12,
        key: "ATT_FILE_NO_MAIN",
        label: "이미지경로(소)",
        value: recipe.ATT_FILE_NO_MAIN,
      },
      {
        no: 13,
        key: "ATT_FILE_NO_MK",
        label: "이미지경로(대)",
        value: recipe.ATT_FILE_NO_MK,
      },
      {
        no: 14,
        key: "RCP_PARTS_DTLS",
        label: "재료정보",
        value: recipe.RCP_PARTS_DTLS,
      },
      {
        no: 55,
        key: "RCP_NA_TIP",
        label: "저감 조리법 TIP",
        value: recipe.RCP_NA_TIP,
      },
    ];
  }, [recipe]);

  // ✅ 재료 문자열을 보기 좋게 분리(쉼표/줄바꿈 기반)
  const ingredients = useMemo(() => {
    const raw = recipe?.RCP_PARTS_DTLS;
    if (!raw) return [];
    const text = String(raw).replace(/\r/g, "\n");
    // 콤마가 많으면 콤마 기준으로 나누고, 아니면 줄바꿈 기준
    const hasComma = text.includes(",");
    const parts = hasComma ? text.split(",") : text.split("\n");
    return parts.map((s) => s.trim()).filter(Boolean);
  }, [recipe]);

  // 해시태그 칩
  const tags = useMemo(() => {
    const raw = recipe?.HASH_TAG;
    if (!raw) return [];
    const t = String(raw).trim();
    if (!t) return [];
    // # 포함/공백 혼재 대응
    return t
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.startsWith("#") ? x : `#${x}`));
  }, [recipe]);

  const heroImg = recipe?.ATT_FILE_NO_MK || recipe?.ATT_FILE_NO_MAIN || "";

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("복사되었습니다.");
    } catch {
      // noop
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse bg-white rounded-2xl shadow p-5">
            <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
            <div className="h-8 w-2/3 bg-gray-200 rounded mb-3" />
            <div className="h-56 w-full bg-gray-200 rounded-2xl mb-4" />
            <div className="h-4 w-full bg-gray-200 rounded mb-2" />
            <div className="h-4 w-5/6 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-amber-50 p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-5">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border hover:bg-gray-50"
          >
            ← 뒤로가기
          </button>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-amber-50 p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-5">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border hover:bg-gray-50"
          >
            ← 뒤로가기
          </button>
          <div className="text-gray-700">
            레시피 정보를 불러오지 못했습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50 shadow-sm"
          >
            ← 뒤로가기
          </button>

          <div className="text-xs text-gray-500">
            SEQ <span className="font-mono">{show(recipe.RCP_SEQ)}</span>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {heroImg ? (
            <div className="relative">
              <img
                src={heroImg}
                alt={show(recipe.RCP_NM)}
                className="w-full h-64 sm:h-80 object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/55 to-transparent">
                <h1 className="text-white text-2xl sm:text-3xl font-bold">
                  {show(recipe.RCP_NM)}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs bg-white/90">
                    조리방법: {show(recipe.RCP_WAY2)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs bg-white/90">
                    요리종류: {show(recipe.RCP_PAT2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {show(recipe.RCP_NM)}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-900">
                  조리방법: {show(recipe.RCP_WAY2)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-900">
                  요리종류: {show(recipe.RCP_PAT2)}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-5 sm:p-6 space-y-6">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t, idx) => (
                  <span
                    key={`${t}-${idx}`}
                    className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-900"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Nutrition summary */}
            <section>
              <div className="flex items-end justify-between mb-2">
                <h2 className="text-lg font-semibold">영양 정보</h2>
                <span className="text-xs text-gray-500">1인분 기준</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <InfoChip label="중량" value={show(recipe.INFO_WGT)} />
                <InfoChip label="열량" value={show(recipe.INFO_ENG, "kcal")} />
                <InfoChip label="탄수화물" value={show(recipe.INFO_CAR, "g")} />
                <InfoChip label="단백질" value={show(recipe.INFO_PRO, "g")} />
                <InfoChip label="지방" value={show(recipe.INFO_FAT, "g")} />
                <InfoChip label="나트륨" value={show(recipe.INFO_NA, "mg")} />
              </div>
            </section>

            {/* Ingredients */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">재료</h2>
                {recipe.RCP_PARTS_DTLS && (
                  <button
                    onClick={() => copyText(String(recipe.RCP_PARTS_DTLS))}
                    className="text-xs px-3 py-1 rounded-lg border hover:bg-gray-50"
                  >
                    재료 복사
                  </button>
                )}
              </div>

              {ingredients.length === 0 ? (
                <div className="text-sm text-gray-500">
                  재료 정보가 없습니다.
                </div>
              ) : (
                <div className="rounded-2xl border bg-amber-50/40 p-4">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ingredients.map((it, idx) => (
                      <li
                        key={`${it}-${idx}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-amber-400" />
                        <span className="whitespace-pre-wrap">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Steps */}
            <section>
              <h2 className="text-lg font-semibold mb-2">만드는 법</h2>

              {steps.length === 0 ? (
                <div className="text-sm text-gray-500">
                  만드는 법 데이터가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((s) => (
                    <div
                      key={s.stepNo}
                      className="rounded-2xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                          {s.stepNo}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          Step {s.stepNo}
                        </div>
                      </div>

                      {s.txt ? (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {s.txt}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">(설명 없음)</p>
                      )}

                      {s.img && (
                        <img
                          src={s.img}
                          alt={`step-${s.stepNo}`}
                          className="mt-3 w-full max-h-72 object-cover rounded-xl border"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* TIP */}
            {recipe.RCP_NA_TIP && String(recipe.RCP_NA_TIP).trim() && (
              <section>
                <h2 className="text-lg font-semibold mb-2">저감 조리 TIP</h2>
                <div className="rounded-2xl border bg-emerald-50 p-4 text-sm text-emerald-900 whitespace-pre-wrap">
                  {show(recipe.RCP_NA_TIP)}
                </div>
              </section>
            )}

            {/* Full fields (collapsed) */}
            <section>
              <details className="group rounded-2xl border bg-white p-4">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div>
                    <div className="font-semibold">레시피 정보(전체 필드)</div>
                    <div className="text-xs text-gray-500">
                      개발/디버깅용 원본 필드를 확인할 수 있어요
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-lg border bg-gray-50 group-open:hidden">
                    펼치기
                  </span>
                  <span className="text-xs px-3 py-1 rounded-lg border bg-gray-50 hidden group-open:inline">
                    접기
                  </span>
                </summary>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border px-3 py-2 w-14 text-center">
                          번호
                        </th>
                        <th className="border px-3 py-2 w-44">항목</th>
                        <th className="border px-3 py-2">값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldRows.map((row) => (
                        <tr key={row.key} className="hover:bg-amber-50/40">
                          <td className="border px-3 py-2 text-center">
                            {row.no}
                          </td>
                          <td className="border px-3 py-2">
                            <div className="font-mono text-xs">{row.key}</div>
                            <div className="text-[11px] text-gray-500">
                              {row.label}
                            </div>
                          </td>
                          <td className="border px-3 py-2 whitespace-pre-wrap">
                            {show(row.value, row.suffix || "")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 원본 이미지 링크도 필요하면 여기에서만 노출 */}
                {(recipe.ATT_FILE_NO_MAIN || recipe.ATT_FILE_NO_MK) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {recipe.ATT_FILE_NO_MAIN && (
                      <a
                        className="underline text-amber-700"
                        href={recipe.ATT_FILE_NO_MAIN}
                        target="_blank"
                        rel="noreferrer"
                      >
                        소 이미지 열기
                      </a>
                    )}
                    {recipe.ATT_FILE_NO_MK && (
                      <a
                        className="underline text-amber-700"
                        href={recipe.ATT_FILE_NO_MK}
                        target="_blank"
                        rel="noreferrer"
                      >
                        대 이미지 열기
                      </a>
                    )}
                  </div>
                )}
              </details>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// 작은 카드형 정보 표시 컴포넌트
function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 font-semibold text-sm text-gray-900">{value}</div>
    </div>
  );
}

export default RecipeDetail;
