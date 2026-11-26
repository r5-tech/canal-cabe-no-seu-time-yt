#!/usr/bin/env bash
# Roda no cron da VPS a cada 10 min (o setup-vps.sh instala).
#  1. puxa o repositório (fichas da semana, dados da API-Football);
#  2. se o cérebro mudou cerebro/agenda.json, faz commit e push, para a tarefa semanal do Claude ler.
# O push usa uma deploy key com permissão de escrita (veja "Cérebro" no README).
set -euo pipefail

DIR=${DIR:-/opt/canal-cabe-no-seu-time-yt}
DEPLOY_KEY=${DEPLOY_KEY:-/root/.ssh/cabe_deploy}
REPO_SSH=${REPO_SSH:-git@github.com:r5-tech/canal-cabe-no-seu-time-yt.git}
cd "$DIR"

if [ -f "$DEPLOY_KEY" ]; then
  export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

# --autostash guarda o agenda.json alterado durante o rebase; --rebase reaplica um commit local ainda não enviado
git pull --rebase --autostash -q

if [ -n "$(git status --porcelain -- cerebro/agenda.json)" ]; then
  git add cerebro/agenda.json
  git -c user.name="cérebro (VPS)" -c user.email="cerebro@vps.local" commit -q -m "cérebro: agenda atualizada"
fi

# envia o que estiver à frente do remoto (o commit de agora ou um que falhou antes)
if [ -n "$(git log --oneline '@{u}..HEAD' 2>/dev/null)" ]; then
  if [ -f "$DEPLOY_KEY" ]; then
    # o pull segue pelo https público; só o push vai por SSH com a deploy key
    git push -q "$REPO_SSH" HEAD:main
    git fetch -q origin
  else
    echo "$(date -Is) agenda.json com commit local, mas sem deploy key em $DEPLOY_KEY: não enviei" >&2
  fi
fi
