import fs from "node:fs";
import path from "node:path";
import { dentroDaJanela, formatarLocal, horarioDoShort, proximoHorario } from "./agenda.mjs";
import { config, log } from "./config.mjs";
import { kv, sh } from "./db.mjs";
import { caminhoPronto, caminhoVideo, hashArquivo, lerFicha, limparArquivos, preparar, renderizar } from "./etapas.mjs";
import * as tg from "./telegram.mjs";
import * as ig from "./instagram.mjs";
import * as yt from "./youtube.mjs";

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

/** Tamanho que o Telegram conta: o texto visível, sem tags e com entidades desfeitas. */
const tamanhoVisivel = (html) =>
  [...html.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot);/g, "x")].length;

/**
 * Monta a legenda sem passar de 1024 caracteres visíveis. Nunca corta no meio de uma tag:
 * vai incluindo as fontes inteiras enquanto couberem e avisa quantas ficaram de fora.
 */
function legendaQueCabe(cabecalho, linhas, limite = 1024) {
  let texto = cabecalho;
  for (let i = 0; i < linhas.length; i++) {
    const resto = linhas.length - i - 1;
    const candidato = `${texto}\n${linhas[i]}`;
    const comAviso = resto ? `${candidato}\n<i>+${resto} fonte(s)</i>` : candidato;
    if (tamanhoVisivel(comAviso) > limite) {
      const faltam = linhas.length - i;
      return `${texto}\n<i>+${faltam} fonte(s) na ficha</i>`;
    }
    texto = candidato;
  }
  return texto;
}

const PENDENTES =["draft", "audio_ok", "rendered"];

/** Arquivos fichas/<semana>/*.json (a pasta "exemplo" fica de fora). */
function listarFichas() {
  if (!fs.existsSync(config.fichasDir)) return [];
  return fs
    .readdirSync(config.fichasDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-w\d{2}$/.test(d.name))
    .flatMap((d) =>
      fs
        .readdirSync(path.join(config.fichasDir, d.name))
        .filter((n) => n.endsWith(".json"))
        .map((n) => path.join(config.fichasDir, d.name, n)),
    )
    .sort();
}

/** Lê fichas/: cadastra novas e reabre rejeitadas/erros cujo JSON mudou. */
export function sincronizar() {
  for (const arquivo of listarFichas()) {
    let f;
    try {
      f = lerFicha(arquivo);
    } catch (e) {
      log(`JSON inválido em ${arquivo}: ${e.message}`);
      continue;
    }
    if (!f.id || !f.semana || !f.posicao) {
      log(`ficha sem id/semana/posicao: ${arquivo}`);
      continue;
    }
    const hash = hashArquivo(arquivo);
    const atual = sh.get(f.id);
    if (!atual) {
      sh.inserir(f, arquivo, hash);
      log(`[${f.id}] nova ficha na fila (#${f.posicao} de ${f.semana})`);
    } else if (atual.hash !== hash) {
      if (["rejected", "erro", ...PENDENTES].includes(atual.status)) {
        sh.atualizar(f.id, { hash, arquivo, posicao: f.posicao, status: "draft", tentativas: 0, erro: null });
        log(`[${f.id}] JSON alterado, volta para a fila`);
      } else {
        sh.atualizar(f.id, { hash });
      }
    }
  }
}

const pausado = () => kv.get("pausado") === "1";

/** Quando a semana inteira está em revisão, manda um resumo com o botão de aprovar todos. */
async function talvezResumoDaSemana(semana) {
  const todos = sh.daSemana(semana);
  if (todos.some((s) => PENDENTES.includes(s.status))) return;
  const emRevisao = todos.filter((s) => s.status === "in_review");
  if (!emRevisao.length || kv.get(`resumo:${semana}`) === String(emRevisao.length)) return;
  const f = lerFicha(emRevisao[0].arquivo);
  const linhas = todos.map((s) => {
    const fi = lerFicha(s.arquivo);
    return `#${s.posicao} ${esc(fi.jogador.nome)} (${esc(fi.jogador.clube)}) · ${s.status === "in_review" ? "👀" : s.status}`;
  });
  await tg.enviarMensagem(
    `<b>Top 10 · ${esc(f.tema)}</b> (${semana})\n\n${linhas.join("\n")}\n\nAprovar agenda todos na segunda, do #10 ao #1.`,
    { reply_markup: tg.botoesLote(semana, emRevisao.length) },
  );
  kv.set(`resumo:${semana}`, emRevisao.length);
}

/** Pega o próximo short da fila e leva até a revisão no Telegram. */
export async function processarProximo({ forcar = false } = {}) {
  if (pausado() && !forcar) return false;
  if (!forcar && !dentroDaJanela()) return false;
  if (sh.contar("in_review") >= config.maxEmRevisao) return false;

  const e = PENDENTES.map((s) => sh.porStatus(s)[0]).filter(Boolean).sort((a, b) => a.semana.localeCompare(b.semana) || b.posicao - a.posicao)[0];
  if (!e) return false;

  try {
    if (e.status === "draft") {
      await preparar(e);
      sh.atualizar(e.id, { status: "audio_ok" });
    }
    if (["draft", "audio_ok"].includes(e.status) || !fs.existsSync(caminhoVideo(e.id))) {
      const video = await renderizar(e);
      sh.atualizar(e.id, { status: "rendered", video });
    }
    const atual = sh.get(e.id);
    const f = lerFicha(atual.arquivo);
    const m = yt.metadados(f);
    const dur = fs.existsSync(caminhoPronto(e.id)) ? lerFicha(caminhoPronto(e.id)).duracaoTotal : undefined;
    const avisoDur =
      dur === undefined
        ? ""
        : dur < config.duracaoMin || dur > config.duracaoMax
          ? `⚠️ ${dur.toFixed(1)} s (meta ${config.duracaoMin}–${config.duracaoMax} s)`
          : `⏱ ${dur.toFixed(1)} s`;
    const cabecalho = `<b>#${f.posicao}</b> ${esc(f.jogador.nome)} · ${esc(f.tema)}\n${avisoDur}\n\n<b>Título:</b> ${esc(m.titulo)}\n\n<b>Fontes</b>`;
    const fontes = f.fontes.map((x) => `• <a href="${escAttr(x.url)}">${esc(x.titulo)}</a>`);
    const msg = await tg.enviarVideo(atual.video, legendaQueCabe(cabecalho, fontes), tg.botoesRevisao(atual.id));
    sh.atualizar(e.id, { status: "in_review", telegram_msg_id: msg.message_id, tentativas: 0, erro: null });
    log(`[${e.id}] enviado para revisão`);
    await talvezResumoDaSemana(e.semana);
  } catch (err) {
    const tentativas = e.tentativas + 1;
    const falhou = tentativas >= config.maxTentativas;
    sh.atualizar(e.id, { tentativas, erro: err.message.slice(0, 2000), ...(falhou ? { status: "erro" } : {}) });
    log(`[${e.id}] erro (tentativa ${tentativas}):`, err.message);
    if (falhou) await tg.enviarMensagem(`⚠️ <b>${esc(e.id)}</b> falhou ${tentativas}x:\n<code>${esc(err.message.slice(0, 800))}</code>`);
  }
  return true;
}

export async function aprovar(id, messageId) {
  const e = sh.get(id);
  if (!e || e.status !== "in_review") return `${id} não está em revisão (${e?.status ?? "inexistente"})`;
  const publishAt = horarioDoShort(e, sh.publishAtsOcupados());
  sh.atualizar(id, { status: "approved", publish_at: publishAt, ...(config.instagram ? { ig_status: "pendente", ig_tentativas: 0, ig_erro: null } : {}) });
  const quando = formatarLocal(publishAt);
  if (messageId ?? e.telegram_msg_id) await tg.editarLegenda(messageId ?? e.telegram_msg_id, `✅ <b>#${e.posicao}</b> ${esc(id)} aprovado · publica em ${quando}`);
  log(`[${id}] aprovado para ${publishAt}`);
  return `✅ #${e.posicao} ${id} · ${quando}`;
}

/** Aprova de uma vez todos os shorts da semana que estão em revisão. */
export async function aprovarSemana(semana) {
  const lista = sh.daSemana(semana).filter((s) => s.status === "in_review");
  if (!lista.length) return `nada em revisão na semana ${semana}`;
  const linhas = [];
  for (const s of lista) linhas.push(await aprovar(s.id));
  return `<b>Semana ${semana} aprovada</b>\n${linhas.join("\n")}`;
}

export async function rejeitar(id, messageId) {
  const e = sh.get(id);
  if (!e || e.status !== "in_review") return `${id} não está em revisão (${e?.status ?? "inexistente"})`;
  sh.atualizar(id, { status: "rejected" });
  kv.set(`resumo:${e.semana}`, "");
  if (messageId)
    await tg.editarLegenda(
      messageId,
      `🔁 <b>#${e.posicao}</b> ${esc(id)} para refazer. Edite <code>fichas/${esc(e.semana)}/${esc(id)}.json</code> que ele volta pra fila.`,
    );
  return `🔁 ${id} marcado para refazer`;
}

/** Sobe para o YouTube os aprovados (privado + publishAt). */
export async function publicarAprovados() {
  for (const e of sh.porStatus("approved")) {
    try {
      // horário pode ter ficado no passado (ex.: worker parado); reagenda
      let publishAt = e.publish_at;
      if (new Date(publishAt).getTime() < Date.now() + 15 * 60_000) {
        publishAt = proximoHorario(sh.publishAtsOcupados().filter((p) => p !== e.publish_at));
      }
      const id = await yt.enviar(e.video, lerFicha(e.arquivo), publishAt);
      sh.atualizar(e.id, { status: "scheduled", youtube_id: id, publish_at: publishAt, erro: null });
      await tg.enviarMensagem(
        `📅 <b>#${e.posicao}</b> ${esc(e.id)} no YouTube, publica em ${formatarLocal(publishAt)}\nhttps://youtu.be/${id}${config.instagram ? "\n📸 Instagram sai no mesmo horário" : ""}`,
      );
    } catch (err) {
      sh.atualizar(e.id, { erro: err.message.slice(0, 2000) });
      log(`[${e.id}] erro no upload:`, err.message);
      await tg.enviarMensagem(`⚠️ Upload de <b>${esc(e.id)}</b> falhou:\n<code>${esc(err.message.slice(0, 800))}</code>`);
      break; // provavelmente credencial/cota: não insiste nos outros agora
    }
  }
}

/** Publica no Instagram os Reels cujo horário chegou (o YouTube publica sozinho; o Instagram, não). */
export async function publicarInstagram() {
  if (!config.instagram) return;
  try {
    await ig.renovarTokenSeNecessario();
  } catch (e) {
    log(e.message);
    if (kv.get("ig_aviso_token") !== new Date().toISOString().slice(0, 10)) {
      kv.set("ig_aviso_token", new Date().toISOString().slice(0, 10));
      await tg.enviarMensagem(`⚠️ ${esc(e.message)}
Gere um token novo e coloque em IG_TOKEN no .env.`);
    }
  }
  for (const e of sh.igParaPublicar()) {
    try {
      const id = await ig.publicarReel(e.video, lerFicha(e.arquivo));
      sh.atualizar(e.id, { ig_status: "publicado", ig_media_id: id, ig_erro: null });
      await tg.enviarMensagem(`📸 <b>#${e.posicao}</b> ${esc(e.id)} publicado no Instagram`);
      log(`[${e.id}] publicado no Instagram (${id})`);
    } catch (err) {
      const t = (e.ig_tentativas ?? 0) + 1;
      const falhou = t >= config.maxTentativas;
      sh.atualizar(e.id, { ig_tentativas: t, ig_erro: err.message.slice(0, 2000), ...(falhou ? { ig_status: "erro" } : {}) });
      log(`[${e.id}] erro no Instagram (tentativa ${t}):`, err.message);
      if (falhou)
        await tg.enviarMensagem(
          `⚠️ Instagram de <b>${esc(e.id)}</b> falhou ${t}x:\n<code>${esc(err.message.slice(0, 800))}</code>\nUse /ig_retentar ${esc(e.id)}`,
        );
      break; // provavelmente token/limite: não insiste nos outros agora
    }
  }
}

export function marcarPublicados() {
  for (const e of sh.porStatus("scheduled")) {
    if (new Date(e.publish_at).getTime() <= Date.now()) {
      sh.atualizar(e.id, { status: "published" });
      log(`[${e.id}] publicado`);
    }
  }
  const limite = Date.now() - config.diasManterArquivos * 86_400_000;
  for (const e of sh.porStatus("published")) {
    if (e.video && new Date(e.publish_at).getTime() < limite && e.ig_status !== "pendente") {
      limparArquivos(e);
      sh.atualizar(e.id, { video: null });
    }
  }
}

export function statusTexto() {
  const n = (s) => sh.contar(s);
  const prox = sh
    .todos()
    .filter((e) => ["approved", "scheduled"].includes(e.status))
    .sort((a, b) => a.publish_at.localeCompare(b.publish_at))
    .slice(0, 10)
    .map((e) => `• #${e.posicao} ${e.id} → ${formatarLocal(e.publish_at)}`)
    .join("\n");
  return [
    `<b>Fila</b>${pausado() ? " (⏸ pausada)" : ""}`,
    `📝 na fila: ${PENDENTES.reduce((a, s) => a + n(s), 0)}`,
    `👀 em revisão: ${n("in_review")}`,
    `✅ aprovados: ${n("approved")} · 📅 agendados: ${n("scheduled")} · 📺 publicados: ${n("published")}`,
    `🔁 para refazer: ${n("rejected")} · ⚠️ erro: ${n("erro")}`,
    config.instagram
      ? `📸 Instagram: ${sh.todos().filter((e) => e.ig_status === "pendente").length} na fila · ${sh.todos().filter((e) => e.ig_status === "publicado").length} publicados · ${sh.todos().filter((e) => e.ig_status === "erro").length} com erro`
      : "",
    prox ? `\n<b>Próximas publicações</b>\n${prox}` : "",
  ].join("\n");
}

/** Cérebro (services/cerebro): fila de pautas e agenda das próximas semanas. */
async function cerebro(caminho, corpo) {
  const r = await fetch(`${config.cerebroUrl}${caminho}`, {
    method: corpo ? "POST" : "GET",
    ...(corpo ? { headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? `cérebro respondeu ${r.status}`);
  return j;
}

const diaMes = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

async function sugerirPauta(texto) {
  if (!texto) return "uso: /pauta Top 10 estrangeiros do futebol brasileiro que cabem no seu time";
  try {
    const p = await cerebro("/api/pautas", { titulo: texto, origem: "telegram" });
    return `🧠 Pauta #${p.id} na fila do cérebro:\n<b>${esc(p.titulo)}</b>\nAgende uma semana no front, ou deixe o cérebro de sábado escolher.`;
  } catch (e) {
    return `⚠️ Não consegui falar com o cérebro: ${esc(e.message)}`;
  }
}

async function agendaTexto() {
  try {
    const a = await cerebro("/api/agenda");
    const linhas = a.semanas.map(
      (s) => `• ${diaMes(s.segunda)}: ${s.pauta ? esc(s.pauta.titulo) : `<i>livre (rotação: ${esc(s.temaDaRotacaoNome)})</i>`}`,
    );
    return `<b>Agenda</b>\n${linhas.join("\n")}\n\n🧠 ${a.fila.length} pauta(s) na fila`;
  } catch (e) {
    return `⚠️ Não consegui falar com o cérebro: ${esc(e.message)}`;
  }
}

export async function comando(texto) {
  const [cmd, arg] = texto.split(/\s+/);
  switch (cmd) {
    case "/pauta":
      return sugerirPauta(texto.slice(cmd.length).trim());
    case "/agenda":
      return agendaTexto();
    case "/status":
    case "/start":
      return statusTexto();
    case "/fila":
      return (
        sh
          .todos()
          .filter((e) => e.status !== "published")
          .map((e) => `#${e.posicao} ${e.id}: ${e.status}${e.erro ? " ⚠️" : ""}`)
          .join("\n") || "fila vazia"
      );
    case "/pausar":
      kv.set("pausado", "1");
      return "⏸ render pausado";
    case "/retomar":
      kv.set("pausado", "0");
      return "▶️ render retomado";
    case "/render":
      kv.set("forcar", "1");
      return "🎬 vou renderizar a fila agora, fora da janela";
    case "/aprovar_semana":
      return arg ? aprovarSemana(arg) : "uso: /aprovar_semana 2026-w48";
    case "/retentar": {
      const e = arg && sh.get(arg);
      if (!e) return "uso: /retentar 2026-w48-07";
      sh.atualizar(e.id, { status: "draft", tentativas: 0, erro: null });
      return `${e.id} de volta para a fila`;
    }
    case "/ig_retentar": {
      const e = arg && sh.get(arg);
      if (!e) return "uso: /ig_retentar 2026-w48-07";
      sh.atualizar(e.id, { ig_status: "pendente", ig_tentativas: 0, ig_erro: null });
      return `${e.id} volta para a fila do Instagram`;
    }
    case "/erro": {
      const e = arg && sh.get(arg);
      const txt = [e?.erro, e?.ig_erro && `Instagram: ${e.ig_erro}`].filter(Boolean).join("\n\n");
      return txt ? `<code>${esc(txt.slice(0, 3500))}</code>` : "sem erro registrado";
    }
    default:
      return "Comandos: /pauta sua ideia · /agenda · /status /fila /render /pausar /retomar /aprovar_semana 2026-w48 /retentar 2026-w48-07 /ig_retentar 2026-w48-07 /erro 2026-w48-07";
  }
}
