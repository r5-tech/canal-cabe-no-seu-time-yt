// Uso: node scripts/render.mjs ../../data/prontos/2026-w48-01.json [saida.mp4] [--frames=0-30] [--still=120]
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [epPath, saidaArg] = args.filter((a) => !a.startsWith("--"));
if (!epPath) throw new Error("Informe o JSON da ficha");

const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const saida = saidaArg ?? path.resolve(__dirname, `../../../data/out/${ep.id}.mp4`);
fs.mkdirSync(path.dirname(saida), { recursive: true });

const browserExecutable = process.env.CHROME_PATH || null;
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, "../../../data"));
const publicDir = path.join(DATA_DIR, "public");

// trilha e efeitos do repositório ficam disponíveis para o staticFile()
fs.cpSync(path.resolve(__dirname, "../../../assets"), path.join(publicDir, "assets"), { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), publicDir });
const composition = await selectComposition({ serveUrl, id: "ShortScout", inputProps: ep, browserExecutable });

if (flags.still !== undefined) {
  const frames = String(flags.still).split(",").map(Number);
  for (const f of frames) {
    const out = saida.replace(/\.mp4$/, `-f${f}.png`);
    await renderStill({ serveUrl, composition, inputProps: ep, frame: f, output: out, browserExecutable });
    console.log("still:", out);
  }
} else {
  const t0 = Date.now();
  await renderMedia({
    serveUrl,
    composition,
    inputProps: ep,
    codec: "h264",
    crf: 23,
    x264Preset: "veryfast",
    concurrency: 2,
    imageFormat: "jpeg",
    outputLocation: saida,
    browserExecutable,
    frameRange: flags.frames ? flags.frames.split("-").map(Number) : undefined,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== globalThis.__ult) { globalThis.__ult = p; console.log(`${p * 10}%`); } },
  });
  // normaliza o volume para o padrão de Shorts (-14 LUFS), sem reencodar o vídeo
  const tmp = saida.replace(/\.mp4$/, ".tmp.mp4");
  fs.renameSync(saida, tmp);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", saida]);
  fs.rmSync(tmp);
  console.log(`${saida} (${composition.durationInFrames} frames) em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
