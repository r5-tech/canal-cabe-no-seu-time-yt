// Valida as fichas de uma semana contra o schema do vídeo, antes do commit.
// Uso: node tools/validar-fichas.mjs fichas/2026-w49
// (precisa de `npm install` em packages/video, de onde vem o zod)
import fs from "node:fs";
import path from "node:path";
import { fichaSchema } from "../packages/video/src/schema.ts";

const dir = process.argv[2];
if (!dir) throw new Error("uso: node tools/validar-fichas.mjs fichas/2026-w49");

const arquivos = fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort();
const semana = path.basename(path.resolve(dir));
let erros = 0;
const posicoes = new Map();
const nomes = new Map();

for (const nome of arquivos) {
  const arq = path.join(dir, nome);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(arq, "utf8"));
  } catch (e) {
    console.log(`✗ ${nome}: JSON inválido (${e.message})`);
    erros++;
    continue;
  }
  const r = fichaSchema.safeParse(json);
  if (!r.success) {
    erros++;
    console.log(`✗ ${nome}`);
    for (const i of r.error.issues) console.log(`   ${i.path.join(".") || "(raiz)"}: ${i.message}`);
    continue;
  }
  const f = r.data;
  const problemas = [];
  if (f.semana !== semana) problemas.push(`semana "${f.semana}" diferente da pasta "${semana}"`);
  if (`${f.id}.json` !== nome) problemas.push(`nome do arquivo deveria ser ${f.id}.json`);
  if (f.id !== `${f.semana}-${String(f.posicao).padStart(2, "0")}`) problemas.push("id precisa terminar com a posição (ex.: -07)");
  const palavras = f.cenas.reduce((a, c) => a + c.narracao.split(/\s+/).length, 0);
  if (palavras < 150 || palavras > 170)
    problemas.push(`narração com ${palavras} palavras; use de 150 a 170 para o short ficar entre 60 e 65 s`);
  if (posicoes.has(f.posicao)) problemas.push(`posição #${f.posicao} repetida (${posicoes.get(f.posicao)})`);
  if (nomes.has(f.jogador.nome)) problemas.push(`jogador repetido (${nomes.get(f.jogador.nome)})`);
  posicoes.set(f.posicao, nome);
  nomes.set(f.jogador.nome, nome);
  if (problemas.length) {
    erros++;
    console.log(`✗ ${nome}\n   ${problemas.join("\n   ")}`);
  } else {
    console.log(`✓ ${nome}  #${f.posicao} ${f.jogador.nome} · ${palavras} palavras`);
  }
}

const faltam = [...Array(10)].map((_, i) => i + 1).filter((p) => !posicoes.has(p));
if (faltam.length) {
  console.log(`✗ faltam as posições: ${faltam.map((p) => `#${p}`).join(", ")}`);
  erros++;
}
console.log(erros ? `\n${erros} problema(s)` : `\nsemana ${semana} ok: 10 fichas válidas`);
process.exit(erros ? 1 : 0);
