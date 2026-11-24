import fs from "node:fs";
import path from "node:path";
import { dentroDaJanela, formatarLocal, horarioDoShort, proximoHorario } from "./agenda.mjs";
import { config, log } from "./config.mjs";
import { kv, sh } from "./db.mjs";
import { caminhoVideo, hashArquivo, lerFicha, limparArquivos, preparar, renderizar } from "./etapas.mjs";
import * as tg from "./telegram.mjs";
import * as yt from "./youtube.mjs";

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const PENDENTES = ["draft", "audio_ok", "rendered"];

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
    const fontes = f.fontes.map((x) => `• <a href="${esc(x.url)}">${esc(x.titulo)}</a>`).join("\n");
    const msg = await tg.enviarVideo(
      atual.video,
      `<b>#${f.posicao}</b> ${esc(f.jogador.nome)} · ${esc(f.tema)}\n\n<b>Título:</b> ${esc(m.titulo)}\n\n<b>Fontes</b>\n${fontes}`.slice(0, 1024),
      tg.botoesRevisao(atual.id),
    );
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
  sh.atualizar(id, { status: "approved", publish_at: publishAt });
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
      await tg.enviarMensagem(`📅 <b>#${e.posicao}</b> ${esc(e.id)} no YouTube, publica em ${formatarLocal(publishAt)}\nhttps://youtu.be/${id}`);
    } catch (err) {
      sh.atualizar(e.id, { erro: err.message.slice(0, 2000) });
      log(`[${e.id}] erro no upload:`, err.message);
      await tg.enviarMensagem(`⚠️ Upload de <b>${esc(e.id)}</b> falhou:\n<code>${esc(err.message.slice(0, 800))}</code>`);
      break; // provavelmente credencial/cota: não insiste nos outros agora
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
    if (e.video && new Date(e.publish_at).getTime() < limite) {
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
    prox ? `\n<b>Próximas publicações</b>\n${prox}` : "",
  ].join("\n");
}

export async function comando(texto) {
  const [cmd, arg] = texto.split(/\s+/);
  switch (cmd) {
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
    case "/erro": {
      const e = arg && sh.get(arg);
      return e?.erro ? `<code>${esc(e.erro.slice(0, 3500))}</code>` : "sem erro registrado";
    }
    default:
      return "Comandos: /status /fila /render /pausar /retomar /aprovar_semana 2026-w48 /retentar 2026-w48-07 /erro 2026-w48-07";
  }
}
