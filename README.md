# Cabe No Seu Time — pipeline de shorts de scout

Toda segunda, um **top 10**: dez shorts de 60–65 s, do #10 ao #1, cada um analisando um jogador com números e fechando com "cabe no seu time?". Mesmo esqueleto da Novelinha (`r5-tech/daniel-gamer-yt`): voz Kokoro pt-BR, Remotion, worker com aprovação no Telegram e agendamento no YouTube.

```
sábado    cérebro de scout (tarefa agendada no Claude) escolhe o tema, pesquisa e faz commit de fichas/<semana>/*.json
          a VPS faz git pull a cada 10 min
madrugada worker gera voz + vídeo dos 10, um por vez, e manda cada um pro Telegram
domingo   você aprova (um a um ou "✅ Aprovar os 10 da semana")
segunda   o YouTube publica sozinho: #10 às 08:00 … #1 às 21:30, todos na playlist da semana
```

## Estrutura

```
cabe-no-seu-time/
├─ fichas/<semana>/<semana>-NN.json   # uma ficha por short (NN = posição no top 10)
├─ fichas/exemplo/                    # ficha modelo (Rômulo); o worker ignora esta pasta
├─ cerebro/PROMPT.md                  # instruções da tarefa semanal de scout
├─ packages/video/                    # Remotion: composição ShortScout
│  ├─ src/schema.ts                   # schema zod da ficha (tipos de cena e limites de texto)
│  ├─ src/Cenas.tsx                   # gancho, linhaDoTempo, numero, barras, destaque, pontoFraco, veredito
│  ├─ src/ShortScout.tsx              # cabeçalho TOP 10 · #N, legenda palavra a palavra, cartela final
│  └─ scripts/{preparar,render}.mjs   # voz → data/prontos ; vídeo → data/out
├─ services/tts/                      # Kokoro (o mesmo da Novelinha)
├─ services/worker/                   # fila, Telegram, YouTube
└─ tools/
   ├─ validar-fichas.mjs              # valida as 10 fichas da semana antes do commit
   └─ gerar_sons.py                   # trilha scout-01 e efeitos (procedurais, sem direitos de terceiros)
```

## Rodando local

```bash
docker compose up -d tts                    # voz em 127.0.0.1:8000
cd packages/video && npm install
node scripts/preparar.mjs ../../fichas/exemplo/2026-w48-01.json
node scripts/render.mjs ../../data/prontos/2026-w48-01.json                    # mp4 em data/out/
node scripts/render.mjs ../../data/prontos/2026-w48-01.json --still=95,600     # só alguns frames
npm run studio                                                                 # preview no navegador
```
Com Chrome instalado: `CHROME_PATH=/usr/bin/google-chrome`. Medido aqui: 64 s de vídeo em ~2 min.

## A ficha

| Cena | Para quê | Campos principais |
|---|---|---|
| `gancho` (1ª, obrigatória) | número que conta do zero + alerta | `numero`, `rotulo`, `sub`, `alerta` |
| `linhaDoTempo` | 2–4 marcos da carreira | `itens[{ano, linha1, linha2, destaque}]` |
| `numero` | um número grande | `valor`, `decimais`, `prefixo`, `sufixo`, `rotulo`, `sub` |
| `barras` | comparação com a liga | `titulo`, `sub`, `barras[{nome, valor, destaque}]` |
| `destaque` | curiosidade / contexto | `topo`, `grande`, `linha`, `nota`, `alerta` |
| `pontoFraco` (obrigatória) | o lado ruim | `itens[]` |
| `veredito` (última, obrigatória) | preço e a pergunta | `topo`, `preco`, `conversao`, `tag`, `pergunta` |

Toda cena tem `narracao` (números por extenso; 150 a 170 palavras no total, o que dá 60–65 s). O `preparar.mjs` calcula a duração real depois da voz, e o Telegram avisa com ⚠️ se o short sair da meta (`DURACAO_MIN`/`DURACAO_MAX`). `fontes` é obrigatório: todo número do vídeo precisa de uma. `youtube.titulo/descricao/tags` são opcionais; sem eles o worker monta título, descrição com as fontes e hashtags.

## VPS

```bash
git clone https://github.com/r5-tech/cabe-no-seu-time.git /opt/cabe-no-seu-time
bash /opt/cabe-no-seu-time/deploy/setup-vps.sh      # Docker, swap, .env em DRY_RUN, cron de git pull, sobe tudo
```
Telegram e YouTube se configuram igual à Novelinha (veja o README de lá). Diferenças:
- O `youtube-auth.mjs` pede o escopo `youtube` (não só `youtube.upload`), porque cria a playlist da semana.
- Vídeos sobem como **não** "made for kids", categoria Esportes.
- **Mesma VPS da Novelinha?** Use uma janela de render diferente para não disputar CPU, por exemplo `JANELA_RENDER=08-14` aqui.

| Variável (`services/worker/.env`) | Padrão | O que faz |
|---|---|---|
| `HORARIOS_PUBLICACAO` | `08:00,09:30,…,21:30` | Os 10 horários da segunda: o #10 no primeiro, o #1 no último |
| `JANELA_RENDER` | `01-07` | Horas em que o worker pode renderizar (`sempre` desliga) |
| `MAX_EM_REVISAO` | `12` | Pausa o render se houver esse tanto esperando aprovação |
| `PLAYLIST_SEMANAL` | `1` | Cria a playlist pública da semana e põe os 10 nela |
| `DRY_RUN` | `0` | `1` simula Telegram e YouTube |

Se a aprovação atrasar e a segunda já tiver passado, cada short cai no próximo horário livre da lista.

Comandos no bot: `/status`, `/fila`, `/render`, `/pausar`, `/retomar`, `/aprovar_semana 2026-w49`, `/retentar 2026-w49-07`, `/erro 2026-w49-07`.

## Fontes de dados
Sem scraping de Sofascore/Transfermarkt/FotMob (termos de uso). O cérebro usa matérias, sites de ligas e clubes, e cita tudo em `fontes`, que vai para a descrição do vídeo.
