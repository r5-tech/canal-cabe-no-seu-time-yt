# Contexto de build: raiz do repositório (docker compose cuida disso)
FROM node:22-bookworm-slim

# ffmpeg (normalização de áudio), emoji e dependências do Chrome Headless Shell do Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg fonts-noto-color-emoji ca-certificates \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/video/package.json packages/video/package-lock.json packages/video/
RUN cd packages/video && npm ci && npx remotion browser ensure

COPY packages/video packages/video
COPY services/worker services/worker
COPY assets assets

ENV REPO_DIR=/app DATA_DIR=/data NODE_ENV=production
CMD ["node", "--disable-warning=ExperimentalWarning", "services/worker/src/main.mjs"]
