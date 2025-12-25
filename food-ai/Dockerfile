# 1) 베이스 (가벼운 파이썬)
FROM python:3.12-slim

# 2) 시스템 패키지 (faiss / torch 관련에서 종종 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# 3) 작업 폴더
WORKDIR /app

# 4) 파이썬 의존성 먼저 설치(캐시 효율)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 5) (중요) HuggingFace 캐시 경로를 이미지 안쪽으로 고정
ENV HF_HOME=/app/.hf_cache
ENV TRANSFORMERS_CACHE=/app/.hf_cache
ENV SENTENCE_TRANSFORMERS_HOME=/app/.hf_cache

# 6) 소스 복사
COPY . /app

# 7) (핵심) 빌드 타임에 모델 미리 다운로드
#    너 코드의 기본 모델명(메타에 없으면 이걸 씀)
ARG EMBED_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBED_MODEL_NAME}')"

# 8) Cloud Run 포트
ENV PORT=8080

# 9) 실행
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
