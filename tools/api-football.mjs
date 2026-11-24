// Coletor de estatísticas de jogadores da API-Football (plano free: 100 requisições/dia).
// Roda todo dia (GitHub Actions, .github/workflows/coletar-stats.yml), retoma de onde parou
// e para sozinho quando o orçamento do dia acaba. O cérebro de scout lê dados/stats/.
//
// Uso:
//   API_FOOTBALL_KEY=... node tools/api-football.mjs cobertura   # 1 requisição: ids e cobertura das Séries B, C e D
//   API_FOOTBALL_KEY=... node tools/api-football.mjs coletar     # baixa páginas de /players até o orçamento acabar
//   node tools/api-football.mjs compilar                         # sem rede: gera dados/stats/<temporada>/*.json
//
// Variáveis: TEMPORADA (padrão: ano atual), ORCAMENTO (padrão 95 requisições por execução),
//            REFRESH_DIAS (padrão 7: liga concluída há mais tempo que isso é baixada de novo),
//            SERIES (padrão "Serie B,Serie C,Serie D", nomes como a API-Football usa).
import fs from "node:fs";
import path from "node:path";

const BASE = "https://v3.football.api-sports.io";
const RAIZ = path.resolve(import.meta.dirname, "..");
const TEMPORADA = Number(process.env.TEMPORADA || new Date().getFullYear());
const ORCAMENTO = Number(process.env.ORCAMENTO || 95);
const REFRESH_DIAS = Number(process.env.REFRESH_DIAS || 7);
const SERIES = (process.env.SERIES || "Serie B,Serie C,Serie D").split(",").map((s) => s.trim());
const INTERVALO_MS = 7000; // o free limita requisições por minuto; 7 s dá folga

const dirBruto = path.join(RAIZ, "dados", "api-football", String(TEMPORADA));
const dirStats = path.join(RAIZ, "dados", "stats", String(TEMPORADA));
const arqLigas = path.join(dirBruto, "ligas.json");
const arqEstado = path.join(dirBruto, "estado.json");

const lerJson = (arq, padrao) => (fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, "utf8")) : padrao);
const gravarJson = (arq, dado) => {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, JSON.stringify(dado, null, 2) + "\n");
};
const slug = (nome) => nome.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let gastas = 0;
let restantesHoje = Infinity;

async function api(caminho, params) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("defina API_FOOTBALL_KEY");
  if (gastas > 0) await dormir(INTERVALO_MS);
  const url = `${BASE}${caminho}?${new URLSearchParams(params)}`;
  const resp = await fetch(url, { headers: { "x-apisports-key": key } });
  gastas++;
  const rest = resp.headers.get("x-ratelimit-requests-remaining");
  if (rest !== null) restantesHoje = Number(rest);
  if (!resp.ok) throw new Error(`${caminho}: HTTP ${resp.status}`);
  const json = await resp.json();
  // A API responde 200 com "errors" preenchido (chave inválida, temporada fora do plano, limite estourado...)
  const erros = Array.isArray(json.errors) ? json.errors : Object.values(json.errors || {});
  if (erros.length) throw new Error(`${caminho}: ${JSON.stringify(json.errors)}`);
  return json;
}

const podeGastar = () => gastas < ORCAMENTO && restantesHoje > 2;

async function cobertura() {
  const json = await api("/leagues", { country: "Brazil", season: TEMPORADA });
  const ligas = {};
  for (const item of json.response) {
    if (!SERIES.includes(item.league.name) || item.league.type !== "League") continue;
    const temp = item.seasons.find((s) => s.year === TEMPORADA) || {};
    ligas[slug(item.league.name)] = {
      id: item.league.id,
      nome: item.league.name,
      inicio: temp.start,
      fim: temp.end,
      atual: temp.current,
      cobertura: temp.coverage,
    };
  }
  gravarJson(arqLigas, { temporada: TEMPORADA, consultadoEm: new Date().toISOString(), ligas });
  for (const [s, l] of Object.entries(ligas)) {
    const c = l.cobertura || {};
    console.log(
      `${s} (id ${l.id}): players=${c.players} statistics_players=${c.fixtures?.statistics_players} ` +
        `top_scorers=${c.top_scorers} | ${l.inicio} → ${l.fim}`,
    );
  }
  const faltando = SERIES.filter((n) => !ligas[slug(n)]);
  if (faltando.length) console.log(`⚠ não encontradas na API: ${faltando.join(", ")}`);
  return ligas;
}

// Guarda só o que o canal usa, para o repositório não crescer à toa.
function enxugar(item, ligaId) {
  const p = item.player;
  return {
    id: p.id,
    nome: p.name,
    nomeCompleto: [p.firstname, p.lastname].filter(Boolean).join(" "),
    nascimento: p.birth?.date ?? null,
    idade: p.age ?? null,
    nacionalidade: p.nationality ?? null,
    altura: p.height ?? null,
    estatisticas: item.statistics
      .filter((s) => s.league?.id === ligaId)
      .map((s) => ({
        clube: s.team?.name,
        clubeId: s.team?.id,
        posicao: s.games?.position,
        jogos: s.games?.appearences ?? 0,
        titular: s.games?.lineups ?? 0,
        minutos: s.games?.minutes ?? 0,
        nota: s.games?.rating ? Number(s.games.rating) : null,
        gols: s.goals?.total ?? 0,
        assistencias: s.goals?.assists ?? 0,
        defesas: s.goals?.saves ?? 0,
        golsSofridos: s.goals?.conceded ?? 0,
        passesDecisivos: s.passes?.key ?? 0,
        precisaoPasse: s.passes?.accuracy ?? null,
        chutes: s.shots?.total ?? 0,
        chutesNoAlvo: s.shots?.on ?? 0,
        dribles: s.dribbles?.success ?? 0,
        desarmes: s.tackles?.total ?? 0,
        interceptacoes: s.tackles?.interceptions ?? 0,
        duelosGanhos: s.duels?.won ?? 0,
        duelos: s.duels?.total ?? 0,
        amarelos: s.cards?.yellow ?? 0,
        vermelhos: s.cards?.red ?? 0,
      })),
  };
}

async function coletar() {
  let { ligas } = lerJson(arqLigas, {});
  if (!ligas) ligas = await cobertura();
  const estado = lerJson(arqEstado, {});
  const agora = Date.now();

  for (const [s, liga] of Object.entries(ligas)) {
    if (liga.cobertura && liga.cobertura.players === false) {
      console.log(`${s}: a API não tem estatística de jogador nesta liga; pulando`);
      continue;
    }
    const e = (estado[s] ??= { proxima: 1, total: null, concluidoEm: null });
    if (e.concluidoEm && agora - Date.parse(e.concluidoEm) < REFRESH_DIAS * 864e5) continue;
    if (e.concluidoEm) Object.assign(e, { proxima: 1, total: null, concluidoEm: null }); // hora de atualizar

    while (podeGastar() && (e.total === null || e.proxima <= e.total)) {
      const json = await api("/players", { league: liga.id, season: TEMPORADA, page: e.proxima });
      e.total = json.paging?.total ?? 1;
      const jogadores = json.response.map((i) => enxugar(i, liga.id));
      gravarJson(path.join(dirBruto, s, `p${String(e.proxima).padStart(3, "0")}.json`), jogadores);
      console.log(`${s}: página ${e.proxima}/${e.total} (${jogadores.length} jogadores)`);
      e.proxima++;
      gravarJson(arqEstado, estado); // salva a cada página: se cair no meio, retoma daqui
    }
    if (e.total !== null && e.proxima > e.total) {
      e.concluidoEm = new Date().toISOString();
      gravarJson(arqEstado, estado);
      console.log(`${s}: completa`);
    }
    if (!podeGastar()) break;
  }
  console.log(`requisições nesta execução: ${gastas}; restantes hoje segundo a API: ${restantesHoje}`);
}

function compilar() {
  const { ligas = {} } = lerJson(arqLigas, {});
  const estado = lerJson(arqEstado, {});
  for (const [s, liga] of Object.entries(ligas)) {
    const dir = path.join(dirBruto, s);
    if (!fs.existsSync(dir)) continue;
    const porId = new Map();
    for (const arq of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      for (const j of lerJson(path.join(dir, arq), [])) porId.set(j.id, j); // páginas novas sobrescrevem
    }

    const jogadores = [];
    for (const j of porId.values()) {
      const st = j.estatisticas;
      if (!st.length) continue;
      const soma = (k) => st.reduce((a, x) => a + (x[k] || 0), 0);
      const minutos = soma("minutos");
      const comNota = st.filter((x) => x.nota !== null && x.minutos > 0);
      const minNota = comNota.reduce((a, x) => a + x.minutos, 0);
      const nota = minNota ? comNota.reduce((a, x) => a + x.nota * x.minutos, 0) / minNota : null;
      const principal = [...st].sort((a, b) => b.minutos - a.minutos)[0];
      jogadores.push({
        id: j.id,
        nome: j.nome,
        nomeCompleto: j.nomeCompleto,
        idade: j.idade,
        nascimento: j.nascimento,
        nacionalidade: j.nacionalidade,
        clube: st.map((x) => x.clube).join(" / "),
        posicao: principal.posicao,
        jogos: soma("jogos"),
        titular: soma("titular"),
        minutos,
        nota: nota === null ? null : Math.round(nota * 100) / 100,
        gols: soma("gols"),
        assistencias: soma("assistencias"),
        participacoes: soma("gols") + soma("assistencias"),
        passesDecisivos: soma("passesDecisivos"),
        chutes: soma("chutes"),
        chutesNoAlvo: soma("chutesNoAlvo"),
        dribles: soma("dribles"),
        desarmes: soma("desarmes"),
        interceptacoes: soma("interceptacoes"),
        duelosGanhos: soma("duelosGanhos"),
        duelos: soma("duelos"),
        defesas: soma("defesas"),
        golsSofridos: soma("golsSofridos"),
        amarelos: soma("amarelos"),
        vermelhos: soma("vermelhos"),
        minutosPorParticipacao:
          soma("gols") + soma("assistencias") ? Math.round(minutos / (soma("gols") + soma("assistencias"))) : null,
      });
    }

    // Mesmo critério dos rankings que a imprensa usa: ter jogado pelo menos metade dos jogos do mais assíduo.
    const maxJogos = Math.max(0, ...jogadores.map((j) => j.jogos));
    const minimoJogos = Math.ceil(maxJogos / 2);
    for (const j of jogadores) j.elegivelNota = j.jogos >= minimoJogos && j.nota !== null;
    const elegiveis = jogadores.filter((j) => j.elegivelNota);
    const top = (lista, k, n = 30) => [...lista].sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1)).slice(0, n);

    const saida = {
      liga: liga.nome,
      ligaId: liga.id,
      temporada: TEMPORADA,
      fonte: "API-Football (api-sports.io)",
      aviso: "A nota é a da API-Football, não a do Sofascore. No vídeo, chamar de 'nota média', citando a fonte.",
      coletaCompleta: Boolean(estado[s]?.concluidoEm),
      atualizadoEm: estado[s]?.concluidoEm ?? null,
      minimoJogos,
      totalJogadores: jogadores.length,
      rankings: {
        nota: top(elegiveis, "nota").map((j) => j.id),
        participacoes: top(jogadores, "participacoes").map((j) => j.id),
        gols: top(jogadores, "gols").map((j) => j.id),
        assistencias: top(jogadores, "assistencias").map((j) => j.id),
        passesDecisivos: top(jogadores, "passesDecisivos").map((j) => j.id),
        sub23Nota: top(elegiveis.filter((j) => j.idade !== null && j.idade <= 23), "nota").map((j) => j.id),
      },
      jogadores: jogadores.sort((a, b) => b.elegivelNota - a.elegivelNota || (b.nota ?? 0) - (a.nota ?? 0)),
    };
    gravarJson(path.join(dirStats, `${s}.json`), saida);
    const lider = jogadores.find((j) => j.id === saida.rankings.nota[0]);
    console.log(
      `${s}: ${jogadores.length} jogadores, mínimo ${minimoJogos} jogos` +
        (lider ? `; maior nota: ${lider.nome} (${lider.clube}) ${lider.nota}` : "") +
        (saida.coletaCompleta ? "" : " — coleta ainda incompleta"),
    );
  }
}

const cmd = process.argv[2];
try {
  if (cmd === "cobertura") await cobertura();
  else if (cmd === "coletar") await coletar();
  else if (cmd === "compilar") compilar();
  else {
    console.log("uso: node tools/api-football.mjs cobertura | coletar | compilar");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
