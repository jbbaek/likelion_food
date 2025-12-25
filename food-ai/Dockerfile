FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
 && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/app/.hf
ENV TRANSFORMERS_CACHE=/app/.hf
ENV SENTENCE_TRANSFORMERS_HOME=/app/.hf
ENV TOKENIZERS_PARALLELISM=false

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ARG EMBED_MODEL_NAME="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBED_MODEL_NAME}')"

ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
