FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Modelo Kokoro (Apache 2.0) em ONNX int8, ~120 MB
RUN mkdir /models && \
    curl -sSL -o /models/kokoro-v1.0.int8.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx && \
    curl -sSL -o /models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
COPY tts.py app.py ./
ENV OMP_NUM_THREADS=2 KOKORO_MODEL_DIR=/models DATA_DIR=/data/public
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
