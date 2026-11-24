import fs from "node:fs";
import { config, log } from "./config.mjs";
import { kv } from "./db.mjs";

const API = () => `https://api.telegram.org/bot${config.telegramToken}`;

async function chamar(metodo, corpo) {
  if (config.dryRun) {
    log(`[telegram:dry] ${metodo}`, corpo instanceof FormData ? Object.fromEntries([...corpo].filter(([k]) => k !== "video")) : corpo);
    return { message_id: Math.floor(Math.random() * 1e6) };
  }
  const r = await fetch(`${API()}/${metodo}`, {
    method: "POST",
    ...(corpo instanceof FormData
      ? { body: corpo }
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(corpo ?? {}) }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}

export const botoesRevisao = (id) => ({
  inline_keyboard: [
    [
      { text: "✅ Aprovar", callback_data: `ok:${id}` },
      { text: "🔁 Refazer", callback_data: `no:${id}` },
    ],
  ],
});

export const botoesLote = (semana, n) => ({
  inline_keyboard: [[{ text: `✅ Aprovar os ${n} da semana`, callback_data: `lote:${semana}` }]],
});

export async function enviarMensagem(texto, extra = {}) {
  if (!config.telegramChatId && !config.dryRun) return null;
  return chamar("sendMessage", { chat_id: config.telegramChatId, text: texto, parse_mode: "HTML", ...extra });
}

export async function enviarVideo(arquivo, legenda, replyMarkup) {
  const form = new FormData();
  form.set("chat_id", config.telegramChatId);
  form.set("caption", legenda);
  form.set("parse_mode", "HTML");
  form.set("supports_streaming", "true");
  form.set("width", "1080");
  form.set("height", "1920");
  if (replyMarkup) form.set("reply_markup", JSON.stringify(replyMarkup));
  form.set("video", await fs.openAsBlob(arquivo, { type: "video/mp4" }), "short.mp4");
  return chamar("sendVideo", form);
}

export async function editarLegenda(messageId, legenda) {
  return chamar("editMessageCaption", {
    chat_id: config.telegramChatId,
    message_id: messageId,
    caption: legenda,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  }).catch((e) => log("aviso:", e.message));
}

/**
 * Long polling. Chama `aoComando(texto)` e `aoBotao(acao, id)` apenas para mensagens do chat autorizado.
 * Fica em loop para sempre.
 */
export async function escutar({ aoComando, aoBotao }) {
  if (config.dryRun || !config.telegramToken) {
    log("[telegram] polling desligado (DRY_RUN ou sem token)");
    return;
  }
  let offset = Number(kv.get("telegram_offset", 0));
  for (;;) {
    try {
      const updates = await chamar("getUpdates", { offset, timeout: 50, allowed_updates: ["message", "callback_query"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        kv.set("telegram_offset", offset);
        const chatId = String(u.message?.chat.id ?? u.callback_query?.message?.chat.id ?? "");

        // /id funciona em qualquer chat, para descobrir o TELEGRAM_CHAT_ID na configuração
        if (u.message?.text?.trim() === "/id") {
          await chamar("sendMessage", { chat_id: chatId, text: `Seu chat id: ${chatId}` });
          continue;
        }
        if (chatId !== String(config.telegramChatId)) {
          log(`[telegram] ignorando chat não autorizado ${chatId}`);
          continue;
        }
        if (u.callback_query) {
          const [acao, id] = u.callback_query.data.split(":"); // ok:<id> | no:<id> | lote:<semana>
          await chamar("answerCallbackQuery", { callback_query_id: u.callback_query.id }).catch(() => {});
          await aoBotao(acao, id, u.callback_query.message.message_id);
        } else if (u.message?.text) {
          await aoComando(u.message.text.trim());
        }
      }
    } catch (e) {
      log("[telegram] erro no polling:", e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
