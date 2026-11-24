#!/usr/bin/env bash
# Prepara uma VPS Ubuntu/Debian do zero e sobe o canal.
# Uso (como root ou com sudo), uma única vez:
#   curl -fsSL https://raw.githubusercontent.com/r5-tech/cabe-no-seu-time/main/deploy/setup-vps.sh | bash
# ou, com o repositório já clonado:  bash deploy/setup-vps.sh
set -euo pipefail

DIR=${DIR:-/opt/cabe-no-seu-time}
REPO=${REPO:-https://github.com/r5-tech/cabe-no-seu-time.git}

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Swap de 4 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Código em $DIR"
if [ ! -d "$DIR/.git" ]; then
  git clone "$REPO" "$DIR"   # repositório privado: use um token ou deploy key
else
  git -C "$DIR" pull --ff-only
fi
cd "$DIR"

if [ ! -f services/worker/.env ]; then
  cp services/worker/.env.example services/worker/.env
  sed -i 's/^DRY_RUN=0/DRY_RUN=1/' services/worker/.env
  echo
  echo "Criei services/worker/.env em modo DRY_RUN=1 (simulação)."
  echo "Preencha TELEGRAM_*, YT_* e troque para DRY_RUN=0 quando estiver tudo certo."
fi

echo "==> Cron: git pull a cada 10 min (é por aqui que chegam as fichas da semana)"
CRON="*/10 * * * * cd $DIR && git pull --ff-only -q >> $DIR/data/git-pull.log 2>&1"
( crontab -l 2>/dev/null | grep -v "$DIR && git pull" ; echo "$CRON" ) | crontab -

mkdir -p data
echo "==> Subindo containers (o primeiro build baixa o modelo de voz e o Chrome; leva alguns minutos)"
docker compose up -d --build
docker compose ps
echo
echo "Pronto. Acompanhe com: cd $DIR && docker compose logs -f worker"
