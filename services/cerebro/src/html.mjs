import { TEMAS, formatarDia } from "./semanas.mjs";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ROTULO_STATUS = {
  sugerida: "sugerida",
  agendada: "agendada",
  em_producao: "em produção",
  publicada: "publicada",
  descartada: "descartada",
};

const CSS = `
:root{--bg:#0e1210;--card:#1c221f;--linha:#2a302d;--txt:#f5f5f2;--sec:#b9b9b2;--verde:#1d9e75;--menta:#9fe1cb;--ambar:#fac775;--erro:#f09595}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 16px 48px}
h1{font-size:20px;margin:8px 0 2px;color:var(--menta);letter-spacing:.02em}h2{font-size:17px;margin:28px 0 10px}
.sub{color:var(--sec);font-size:14px;margin:0 0 12px}
.card{background:var(--card);border:1px solid var(--linha);border-radius:12px;padding:12px 14px;margin:0 0 10px}
.topo{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.sem{font-weight:600}.data{color:var(--sec);font-size:14px}
.tit{font-weight:600;margin:6px 0 2px}.desc{color:var(--sec);font-size:14px;margin:0 0 6px;white-space:pre-wrap}
.badge{font-size:12px;border-radius:999px;padding:2px 10px;border:1px solid var(--linha);color:var(--sec);white-space:nowrap}
.b-agendada{color:var(--menta);border-color:var(--verde)}.b-em_producao{color:var(--ambar);border-color:var(--ambar)}
.b-publicada{color:var(--bg);background:var(--verde);border-color:var(--verde)}.b-livre{color:var(--sec)}
.acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center}
form.inline{display:inline-flex;gap:8px;flex-wrap:wrap;margin:0}
input,select,textarea,button{font:inherit;color:var(--txt);background:#141917;border:1px solid var(--linha);border-radius:8px;padding:8px 10px;min-height:40px}
textarea{width:100%;min-height:80px}input[type=text]{width:100%}
label{display:block;font-size:14px;color:var(--sec);margin:10px 0 4px}
button{background:var(--verde);border-color:var(--verde);color:#fff;font-weight:600;cursor:pointer}
button.sec{background:transparent;color:var(--txt);border-color:var(--linha)}button.perigo{background:transparent;color:var(--erro);border-color:#5a2a2a}
.msg{border-radius:8px;padding:10px 12px;margin:10px 0;background:#173b2e;color:var(--menta)}.msg.erro{background:#3b1717;color:var(--erro)}
summary{cursor:pointer;color:var(--menta)}details form{margin-top:4px}
.vazio{color:var(--sec);font-size:14px}a{color:var(--menta)}
`;

const pagina = (titulo, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><style>${CSS}</style></head>
<body><main>${corpo}</main></body></html>`;

const opcoesTema = (atual) =>
  Object.entries(TEMAS)
    .map(([k, v]) => `<option value="${k}"${k === atual ? " selected" : ""}>${esc(v)}</option>`)
    .join("");

const avisos = ({ msg, erro }) =>
  (msg ? `<div class="msg">${esc(msg)}</div>` : "") + (erro ? `<div class="msg erro">${esc(erro)}</div>` : "");

function cardSemana(s, fila) {
  const p = s.pauta;
  const cab = `<div class="topo"><span><span class="sem">Segunda ${formatarDia(s.segunda)}</span>
    <span class="data"> · vídeo longo ${formatarDia(s.videoLongo)} · ${s.semana}</span></span>
    <span class="badge b-${p ? p.status : "livre"}">${p ? ROTULO_STATUS[p.status] : "livre"}</span></div>`;
  if (p) {
    const acoes =
      p.status === "agendada"
        ? `<div class="acoes"><a href="/pauta/${p.id}">editar</a>
           <form class="inline" method="post" action="/pautas/${p.id}/liberar"><button class="sec">Liberar semana</button></form></div>`
        : "";
    return `<div class="card">${cab}<div class="tit">${esc(p.titulo)}</div>
      <p class="desc">${esc(p.temaNome)}${p.descricao ? ` · ${esc(p.descricao)}` : ""}</p>${acoes}</div>`;
  }
  const escolher = fila.length
    ? `<form class="inline" method="post" action="/agendar"><input type="hidden" name="semana" value="${s.semana}">
       <select name="id" aria-label="Pauta da fila">${fila.map((f) => `<option value="${f.id}">${esc(f.titulo)}</option>`).join("")}</select>
       <button>Agendar</button></form>`
    : "";
  return `<div class="card">${cab}<p class="desc">Sem pauta: o cérebro escolhe pelo momento · rotação sugere <b>${esc(s.temaDaRotacaoNome)}</b></p>
    <div class="acoes">${escolher}</div></div>`;
}

function cardFila(f, semanasLivres) {
  const agendar = semanasLivres.length
    ? `<form class="inline" method="post" action="/agendar"><input type="hidden" name="id" value="${f.id}">
       <select name="semana" aria-label="Semana">${semanasLivres.map((s) => `<option value="${s.semana}">Segunda ${formatarDia(s.segunda)}</option>`).join("")}</select>
       <button>Agendar</button></form>`
    : "";
  return `<div class="card"><div class="topo"><span class="tit">${esc(f.titulo)}</span><span class="badge">${esc(f.temaNome)}</span></div>
    ${f.descricao ? `<p class="desc">${esc(f.descricao)}</p>` : ""}
    <p class="desc">por ${esc(f.sugeridaPor)} · #${f.id}</p>
    <div class="acoes">${agendar}<a href="/pauta/${f.id}">editar</a>
      <form class="inline" method="post" action="/pautas/${f.id}/descartar"><button class="perigo">Descartar</button></form></div></div>`;
}

export function paginaInicial(agenda, historico, flash) {
  const livres = agenda.semanas.filter((s) => !s.pauta);
  const hist = historico.length
    ? historico
        .map((p) => `<div class="card"><div class="topo"><span>${esc(p.titulo)}</span><span class="badge b-${p.status}">${ROTULO_STATUS[p.status]}</span></div>
          <p class="desc">${p.semana ?? ""}</p></div>`)
        .join("")
    : `<p class="vazio">Nada publicado ainda.</p>`;
  return pagina(
    "Cérebro · Cabe No Seu Time",
    `<h1>CÉREBRO · CABE NO SEU TIME</h1>
    <p class="sub">Agenda exportada para o repositório ${agenda.atualizadoEm ? `em ${esc(new Date(agenda.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}` : "a cada mudança"}.</p>
    ${avisos(flash)}
    <details class="card"><summary><b>+ Sugerir pauta</b></summary>
    <form method="post" action="/pautas">
      <label for="titulo">Pauta</label>
      <input type="text" id="titulo" name="titulo" required maxlength="120" placeholder="Top 10 estrangeiros do futebol brasileiro que cabem no seu time">
      <label for="tema">Tema</label><select id="tema" name="tema">${opcoesTema("livre")}</select>
      <label for="descricao">Detalhes para o cérebro (opcional)</label>
      <textarea id="descricao" name="descricao" maxlength="1000" placeholder="Recorte, liga, idade, o que evitar..."></textarea>
      <label for="semana">Agendar já para</label>
      <select id="semana" name="semana"><option value="">deixar na fila</option>
        ${livres.map((s) => `<option value="${s.semana}">Segunda ${formatarDia(s.segunda)}</option>`).join("")}</select>
      <div class="acoes"><button>Salvar pauta</button></div>
    </form></details>
    <h2>Próximas semanas</h2>
    ${agenda.semanas.map((s) => cardSemana(s, agenda.fila)).join("")}
    <h2>Fila de sugestões (${agenda.fila.length})</h2>
    ${agenda.fila.length ? agenda.fila.map((f) => cardFila(f, livres)).join("") : `<p class="vazio">Fila vazia. Sugira pelo formulário ou pelo Telegram: /pauta sua ideia</p>`}
    <h2>Histórico</h2>${hist}`,
  );
}

export function paginaEditar(p, flash) {
  return pagina(
    `Editar pauta #${p.id}`,
    `<h1>EDITAR PAUTA #${p.id}</h1><p class="sub"><a href="/">← voltar</a> · ${ROTULO_STATUS[p.status]}${p.semana ? ` · ${p.semana}` : ""}</p>
    ${avisos(flash)}
    <form class="card" method="post" action="/pautas/${p.id}/editar">
      <label for="titulo">Pauta</label><input type="text" id="titulo" name="titulo" required maxlength="120" value="${esc(p.titulo)}">
      <label for="tema">Tema</label><select id="tema" name="tema">${opcoesTema(p.tema)}</select>
      <label for="descricao">Detalhes para o cérebro</label><textarea id="descricao" name="descricao" maxlength="1000">${esc(p.descricao)}</textarea>
      <div class="acoes"><button>Salvar</button></div>
    </form>`,
  );
}
