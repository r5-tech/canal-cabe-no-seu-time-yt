// Gera a narração de cada cena no serviço de voz e grava a ficha "pronta para render".
// Uso: node scripts/preparar.mjs ../../fichas/2026-w48/2026-w48-01.json
// Env: TTS_URL (padrão http://localhost:8000), DATA_DIR (padrão ../../data)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_URL = process.env.TTS_URL ?? "http://localhost:8000";
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, "../../../data"));

const epPath = process.argv[2];
if (!epPath) throw new Error("Informe o JSON da ficha");
const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const voz = ep.voz ?? "pm_alex";
const velocidade = ep.velocidade ?? 1.15;

const saude = await fetch(`${TTS_URL}/saude`).then((r) => r.json());
const t0 = Date.now();
for (const [i, cena] of ep.cenas.entries()) {
  const nome = `cena-${String(i + 1).padStart(2, "0")}`;
  const rel = `audio/${ep.id}/${nome}.wav`;
  const metaPath = path.join(DATA_DIR, "public", `audio/${ep.id}/${nome}.json`);
  const hash = crypto.createHash("sha1").update(`${cena.narracao}|${voz}|${velocidade}|${saude.versao}`).digest("hex");

  let meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
  if (!meta || meta.hash !== hash || !fs.existsSync(path.join(DATA_DIR, "public", rel))) {
    const r = await fetch(`${TTS_URL}/sintetizar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texto: cena.narracao, arquivo: rel, voz, velocidade }),
    });
    if (!r.ok) throw new Error(`TTS falhou na ${nome}: ${r.status} ${await r.text()}`);
    meta = { ...(await r.json()), hash };
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    console.log(`${nome}: ${meta.duracao}s`);
  } else {
    console.log(`${nome}: cache (${meta.duracao}s)`);
  }
  cena.audio = rel;
  cena.duracaoAudio = meta.duracao;
  cena.palavras = meta.palavras;
}

const saida = path.join(DATA_DIR, "prontos", `${ep.id}.json`);
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, JSON.stringify(ep, null, 2));
const total = ep.cenas.reduce((a, c) => a + c.duracaoAudio, 0);
console.log(`\n${saida}\nnarração total: ${total.toFixed(1)}s em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
