import fs from "node:fs";
import http from "node:http";
import { exportar, montarAgenda, sincronizarStatus } from "./agenda.mjs";
import { config, log } from "./config.mjs";
import { importarProgramacaoInicial, pautas } from "./db.mjs";
import { paginaEditar, paginaInicial } from "./html.mjs";

const INTERVALO_MS = 60_000;

function ciclo() {
  try {
    sincronizarStatus();
    exportar();
  } catch (e) {
    log("erro no ciclo:", e.message);
  }
}

importarProgramacaoInicial();
ciclo();

if (process.argv.includes("--exportar")) process.exit(0);

const ultimaExportacao = () => {
  try {
    return JSON.parse(fs.readFileSync(config.agendaPath, "utf8")).atualizadoEm;
  } catch {
    return null;
  }
};

async function corpo(req) {
  let dados = "";
  for await (const parte of req) {
    dados += parte;
    if (dados.length > 20_000) throw new Error("corpo grande demais");
  }
  if ((req.headers["content-type"] ?? "").includes("application/json")) return dados ? JSON.parse(dados) : {};
  return Object.fromEntries(new URLSearchParams(dados));
}

const enviar = (res, status, tipo, conteudo) => {
  res.writeHead(status, { "content-type": `${tipo}; charset=utf-8`, "cache-control": "no-store" });
  res.end(conteudo);
};
const json = (res, status, obj) => enviar(res, status, "application/json", JSON.stringify(obj, null, 2));
const voltar = (res, destino, { msg, erro } = {}) => {
  const q = new URLSearchParams();
  if (msg) q.set("msg", msg);
  if (erro) q.set("erro", erro);
  res.writeHead(303, { location: `${destino}${q.size ? `?${q}` : ""}` });
  res.end();
};

/** Toda alteração já atualiza os status e o agenda.json (o push sai no próximo sincronizar-repo.sh). */
const aplicar = (fn) => {
  const r = fn();
  ciclo();
  return r;
};

async function rotear(req, res) {
  const url = new URL(req.url, "http://cerebro");
  const flash = { msg: url.searchParams.get("msg"), erro: url.searchParams.get("erro") };
  const m = (re) => url.pathname.match(re);
  let rota;

  if (req.method === "GET" && url.pathname === "/") {
    return enviar(res, 200, "text/html", paginaInicial({ ...montarAgenda(), atualizadoEm: ultimaExportacao() }, pautas.historico(), flash));
  }
  if (req.method === "GET" && (rota = m(/^\/pauta\/(\d+)$/))) {
    const p = pautas.get(rota[1]);
    if (!p) return voltar(res, "/", { erro: "pauta não encontrada" });
    return enviar(res, 200, "text/html", paginaEditar(p, flash));
  }
  if (req.method === "GET" && url.pathname === "/api/agenda") return json(res, 200, montarAgenda());
  if (req.method === "GET" && url.pathname === "/saude") return json(res, 200, { ok: true });

  if (req.method !== "POST") return enviar(res, 404, "text/plain", "não encontrado");
  const dados = await corpo(req);

  // API usada pelo worker (/pauta no Telegram)
  if (url.pathname === "/api/pautas") {
    try {
      const p = aplicar(() => pautas.sugerir({ ...dados, origem: dados.origem ?? "api" }));
      return json(res, 201, p);
    } catch (e) {
      return json(res, 400, { erro: e.message });
    }
  }

  try {
    if (url.pathname === "/pautas") {
      const p = aplicar(() => {
        const nova = pautas.sugerir({ ...dados, origem: "front" });
        if (dados.semana) pautas.agendar(nova.id, dados.semana);
        return nova;
      });
      return voltar(res, "/", { msg: dados.semana ? `Pauta #${p.id} agendada` : `Pauta #${p.id} na fila` });
    }
    if (url.pathname === "/agendar") {
      aplicar(() => pautas.agendar(dados.id, dados.semana));
      return voltar(res, "/", { msg: "Pauta agendada" });
    }
    if ((rota = m(/^\/pautas\/(\d+)\/(liberar|descartar|editar)$/))) {
      const [, id, acao] = rota;
      if (acao === "liberar") aplicar(() => pautas.liberar(id));
      if (acao === "descartar") aplicar(() => pautas.descartar(id));
      if (acao === "editar") {
        const p = pautas.get(id);
        if (!p || !["sugerida", "agendada"].includes(p.status)) throw new Error("só dá para editar pautas sugeridas ou agendadas");
        aplicar(() => pautas.editar(id, dados));
      }
      return voltar(res, "/", { msg: { liberar: "Semana liberada; a pauta voltou para a fila", descartar: "Pauta descartada", editar: "Pauta salva" }[acao] });
    }
  } catch (e) {
    return voltar(res, "/", { erro: e.message });
  }
  return enviar(res, 404, "text/plain", "não encontrado");
}

http
  .createServer((req, res) =>
    rotear(req, res).catch((e) => {
      log("erro na requisição:", e.message);
      if (!res.headersSent) enviar(res, 500, "text/plain", "erro interno");
    }),
  )
  .listen(config.porta, config.host, () => log(`front em http://${config.host}:${config.porta}`));

setInterval(ciclo, INTERVALO_MS);
