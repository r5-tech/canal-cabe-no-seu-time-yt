import { config, log } from "./config.mjs";
import { kv } from "./db.mjs";
import { aprovar, aprovarSemana, comando, marcarPublicados, processarProximo, publicarAprovados, rejeitar, sincronizar } from "./acoes.mjs";
import * as tg from "./telegram.mjs";

const INTERVALO_MS = 60_000;
let ocupado = false;

async function ciclo() {
  if (ocupado) return;
  ocupado = true;
  try {
    sincronizar();
    const forcar = kv.get("forcar") === "1";
    if (forcar) kv.set("forcar", "0");
    // processa em sequência enquanto houver trabalho (um short por vez); /render libera a fila toda
    while (await processarProximo({ forcar }));
    await publicarAprovados();
    marcarPublicados();
  } catch (e) {
    log("erro no ciclo:", e);
  } finally {
    ocupado = false;
  }
}

log(`worker iniciado · horários ${config.horarios.join(", ")} · janela ${config.janelaRender}${config.dryRun ? " · DRY_RUN" : ""}`);

tg.escutar({
  aoComando: async (texto) => {
    const r = await comando(texto);
    await tg.enviarMensagem(r);
    if (texto.startsWith("/render")) ciclo();
  },
  aoBotao: async (acao, id, messageId) => {
    if (acao === "lote") {
      await tg.enviarMensagem(await aprovarSemana(id));
      return ciclo();
    }
    const r = acao === "ok" ? await aprovar(id, messageId) : await rejeitar(id, messageId);
    log(r);
    if (acao === "ok") ciclo();
  },
});

await ciclo();
setInterval(ciclo, INTERVALO_MS);
