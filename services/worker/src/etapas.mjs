import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config, log } from "./config.mjs";

/** Roda um script do pacote de vídeo em processo separado (isola a memória do Chrome do render). */
const rodar = (script, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script, ...args], {
      cwd: config.videoDir,
      env: { ...process.env, TTS_URL: config.ttsUrl, DATA_DIR: config.dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let saida = "";
    const guardar = (d) => {
      saida = (saida + d.toString()).slice(-4000);
    };
    p.stdout.on("data", guardar);
    p.stderr.on("data", guardar);
    p.on("close", (code) => (code === 0 ? resolve(saida) : reject(new Error(`${script} saiu com ${code}:\n${saida}`))));
  });

export const hashArquivo = (arquivo) => crypto.createHash("sha1").update(fs.readFileSync(arquivo)).digest("hex");

export const lerFicha = (arquivo) => JSON.parse(fs.readFileSync(arquivo, "utf8"));

export const caminhoPronto = (id) => path.join(config.dataDir, "prontos", `${id}.json`);
export const caminhoVideo = (id) => path.join(config.dataDir, "out", `${id}.mp4`);

export async function preparar(e) {
  log(`[${e.id}] gerando narração`);
  await rodar("scripts/preparar.mjs", [e.arquivo]);
}

export async function renderizar(e) {
  log(`[${e.id}] renderizando`);
  const out = caminhoVideo(e.id);
  const t = await rodar("scripts/render.mjs", [caminhoPronto(e.id), out]);
  log(`[${e.id}] ${t.trim().split("\n").at(-1)}`);
  return out;
}

/** Apaga áudio e vídeo de shorts publicados há mais de N dias. */
export function limparArquivos(e) {
  fs.rmSync(path.join(config.dataDir, "public", "audio", e.id), { recursive: true, force: true });
  if (e.video) fs.rmSync(e.video, { force: true });
}
