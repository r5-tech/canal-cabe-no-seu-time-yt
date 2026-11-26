# Cabe No Seu Time — pipeline de shorts de scout

Toda segunda, um **top 10**: dez shorts de 60–65 s, do #10 ao #1, cada um analisando um jogador com números e fechando com "cabe no seu time?". Mesmo esqueleto da Novelinha (`r5-tech/daniel-gamer-yt`): voz Kokoro pt-BR, Remotion, worker com aprovação no Telegram e agendamento no YouTube.

```
sempre    você sugere e agenda pautas no cérebro (front no celular, ou /pauta no Telegram); a VPS publica cerebro/agenda.json
sábado    cérebro de scout (tarefa agendada no Claude) lê a agenda, pesquisa e faz commit de fichas/<semana>/*.json
          a VPS faz git pull a cada 10 min
madrugada worker gera voz + vídeo dos 10, um por vez, e manda cada um pro Telegram
domingo   você aprova (um a um ou "✅ Aprovar os 10 da semana")
segunda   o YouTube publica sozinho: #10 às 08:00 … #1 às 21:30, todos na playlist da semana
          com INSTAGRAM=1, o worker publica cada um também como Reel, no mesmo horário
```

## Estrutura

```
canal-cabe-no-seu-time-yt/
├─ fichas/<semana>/<semana>-NN.json   # uma ficha por short (NN = posição no top 10)
├─ fichas/exemplo/                    # ficha modelo (Rômulo); o worker ignora esta pasta
├─ cerebro/PROMPT.md                  # instruções da tarefa semanal de scout
├─ cerebro/agenda.json                # gerado pela VPS: pauta de cada semana + fila de sugestões
├─ cerebro/programacao-inicial.json   # pautas carregadas no primeiro start do cérebro
├─ packages/video/                    # Remotion: composição ShortScout
│  ├─ src/schema.ts                   # schema zod da ficha (tipos de cena e limites de texto)
│  ├─ src/Cenas.tsx                   # gancho, linhaDoTempo, numero, barras, destaque, pontoFraco, veredito
│  ├─ src/ShortScout.tsx              # cabeçalho TOP 10 · #N, legenda palavra a palavra, cartela final
│  └─ scripts/{preparar,render}.mjs   # voz → data/prontos ; vídeo → data/out
├─ services/tts/                      # Kokoro (o mesmo da Novelinha)
├─ services/worker/                   # fila, Telegram, YouTube
├─ services/cerebro/                  # pautas em SQLite + front mínimo (porta 8080, só no Tailscale)
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
git clone https://github.com/r5-tech/canal-cabe-no-seu-time-yt.git /opt/canal-cabe-no-seu-time-yt
bash /opt/canal-cabe-no-seu-time-yt/deploy/setup-vps.sh      # Docker, swap, .env em DRY_RUN, cron de git pull, sobe tudo
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
| `INSTAGRAM` | `0` | `1` publica cada short também como Reel (veja abaixo) |
| `DRY_RUN` | `0` | `1` simula Telegram, YouTube e Instagram |

Se a aprovação atrasar e a segunda já tiver passado, cada short cai no próximo horário livre da lista.

### Instagram (Reels)

A API do Instagram não agenda: o worker publica cada Reel quando chega o horário do short (o mesmo do YouTube) e avisa no Telegram com 📸.

1. Deixe a conta do canal como **Profissional** (Comercial ou Criador de conteúdo) nas configurações do Instagram.
2. Em developers.facebook.com, crie um app do tipo **Empresa** e adicione o produto **Instagram → API setup with Instagram login**. Permissões: `instagram_business_basic` e `instagram_business_content_publish`.
3. Em *Funções do app → Testadores do Instagram*, adicione a conta do canal e aceite o convite no app do Instagram (Configurações → Apps e sites). Publicando só na sua conta, o app pode ficar em modo de desenvolvimento.
4. No painel do produto, em *Generate access tokens*, conecte a conta e copie o token (já é o de 60 dias).
5. Descubra o ID: `curl "https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=SEU_TOKEN"`.
6. No `services/worker/.env`: `INSTAGRAM=1`, `IG_USER_ID=<user_id>`, `IG_TOKEN=<token>`, e reinicie (`docker compose up -d worker`).

O worker renova o token sozinho toda semana. Se a renovação falhar, ele avisa no Telegram, e aí é só gerar outro token (passo 4).
Se o upload direto der erro no login do Instagram, a alternativa documentada pela Meta é o login do Facebook: conta do Instagram ligada a uma Página, token de Página e `IG_HOST=graph.facebook.com`.
Limite da Meta: 100 posts via API por 24 h (o top 10 usa 10).

Comandos no bot: `/pauta sua ideia` (manda para a fila do cérebro), `/agenda`, `/status`, `/fila`, `/render`, `/pausar`, `/retomar`, `/aprovar_semana 2026-w49`, `/retentar 2026-w49-07`, `/ig_retentar 2026-w49-07`, `/erro 2026-w49-07`.

## Cérebro (pautas)

O `services/cerebro` guarda as pautas num SQLite (`data/cerebro.db`) e mostra um front mínimo, feito para o celular: as próximas 10 semanas (com a pauta de cada uma ou o tema da rotação), o formulário para sugerir, a fila de sugestões e o histórico. Uma pauta anda sozinha: **sugerida → agendada → em produção** (quando as fichas da semana chegam no repositório) **→ publicada** (quando o worker publica os shorts da semana).

A tarefa semanal do Claude roda na nuvem e só enxerga o repositório, então o cérebro exporta `cerebro/agenda.json` a cada mudança, e o `deploy/sincronizar-repo.sh` (cron de 10 em 10 min) faz commit e push dele. O pull continua pelo https público; o push vai por SSH com uma deploy key.

No primeiro start com o banco vazio, o cérebro carrega `cerebro/programacao-inicial.json` (a programação até fevereiro de 2027).

### Configurar na VPS (uma vez)
1. **Deploy key:** rode de novo `bash deploy/setup-vps.sh` (é idempotente). Ele troca o cron de `git pull` pelo `sincronizar-repo.sh` e gera `/root/.ssh/cabe_deploy`. Cadastre a chave pública que ele imprime em GitHub → *Settings → Deploy keys → Add deploy key*, marcando **Allow write access**.
2. **Tailscale na VPS:** `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`, e pegue o IP com `tailscale ip -4` (algo como `100.x.y.z`).
3. **Porta só no Tailscale:** crie (ou edite) o `.env` da raiz do repositório com `CEREBRO_BIND=100.x.y.z` e suba: `docker compose up -d --build cerebro worker`.
4. **Celular:** instale o app do Tailscale com a mesma conta e abra `http://100.x.y.z:8080`. Dica: adicione à tela inicial.

Sem `CEREBRO_BIND`, a porta abre só em `127.0.0.1` (nada exposto). Para conferir o export: `cat cerebro/agenda.json` e `git log -3 -- cerebro/agenda.json`.

## Fontes de dados
Sem scraping de Sofascore/Transfermarkt/FotMob (termos de uso). O cérebro usa matérias, sites de ligas e clubes, e cita tudo em `fontes`, que vai para a descrição do vídeo.

### Estatísticas: API-Football (plano free)
`tools/api-football.mjs` baixa as estatísticas de temporada de todos os jogadores das Séries B, C e D (`/players`, 20 por página) e compila rankings em `dados/stats/<temporada>/serie-b.json` etc.: nota média (ponderada por minutos, mínimo de metade dos jogos do mais assíduo), gols, assistências, passes decisivos, sub-23.

- Roda todo dia pelo GitHub Actions (`.github/workflows/coletar-stats.yml`), gasta até 95 das 100 requisições do dia, retoma de onde parou e faz commit em `dados/`. A VPS recebe pelo `git pull` de sempre.
- Uma carga completa das três séries leva uns 3 dias (a Série D, com 96 clubes, é a maior). Depois, cada liga é baixada de novo a cada 7 dias (`REFRESH_DIAS`).
- Configuração: crie a conta grátis em dashboard.api-football.com e salve a chave no secret `API_FOOTBALL_KEY` do repositório. Primeiro rode o workflow à mão com `comando = cobertura` (1 requisição): o log mostra se cada série tem estatística de jogador (`players=true`).
- A nota é a da API-Football, **não** a do Sofascore: no vídeo, "nota média" com a API-Football nas fontes.

```bash
API_FOOTBALL_KEY=... node tools/api-football.mjs cobertura
API_FOOTBALL_KEY=... node tools/api-football.mjs coletar
node tools/api-football.mjs compilar
```
