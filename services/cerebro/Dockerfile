# Contexto de build: raiz do repositório (docker compose cuida disso)
FROM node:22-bookworm-slim

WORKDIR /app
COPY services/cerebro services/cerebro

# /repo/fichas (só leitura) e /repo/cerebro (agenda.json) chegam por volume
ENV REPO_DIR=/repo DATA_DIR=/data NODE_ENV=production
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "services/cerebro/src/main.mjs"]
