// Uso: node scripts/identidade.mjs   → PNGs da identidade digital em identidade/png/
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saida = path.resolve(__dirname, "../../../identidade/png");
fs.mkdirSync(saida, { recursive: true });
const browserExecutable = process.env.CHROME_PATH || null;

const ARQUIVOS = {
  Avatar: "avatar-800.png",
  Banner: "banner-youtube-2560x1440.png",
  MarcaDagua: "marca-dagua-150.png",
  FolhaMarca: "folha-da-marca.png",
};

const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts") });
const comps = (await getCompositions(serveUrl, { browserExecutable })).filter((c) => c.id !== "ShortScout");
for (const composition of comps) {
  const nome = ARQUIVOS[composition.id] ?? `destaque-${composition.id.replace("Destaque-", "")}.png`;
  const output = path.join(saida, nome);
  await renderStill({ serveUrl, composition, output, imageFormat: "png", browserExecutable });
  console.log(output);
}
