// Publicação de Reels pela API oficial do Instagram (Content Publishing).
// A API não agenda: o worker chama `publicarReel` quando chega o horário do short.
//
// Fluxo (upload resumable, sem precisar de URL pública):
//   1. POST /<IG_ID>/media  media_type=REELS, upload_type=resumable  → { id, uri }
//   2. POST rupload.facebook.com/ig-api-upload/<versão>/<id>  (bytes do mp4)
//   3. GET  /<id>?fields=status_code  até FINISHED
//   4. POST /<IG_ID>/media_publish  creation_id=<id>                   → { id do post }
import fs from "node:fs";
import { config, log } from "./config.mjs";
import { kv } from "./db.mjs";

const base = () => `https://${config.igHost}/${config.igVersao}`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Token atual: o renovado (guardado no kv) tem prioridade sobre o do .env. */
const token = () => kv.get("ig_token") || config.igToken;

/**
 * Renova o token de longa duração (60 dias) quando ele tem mais de 7 dias.
 * Só vale para o login do Instagram (graph.instagram.com); no login do Facebook o token de página não expira.
 */
export async function renovarTokenSeNecessario() {
  if (!config.instagram || config.dryRun || config.igHost !== "graph.instagram.com") return;
  const ultima = Number(kv.get("ig_token_renovado_em", "0"));
  if (Date.now() - ultima < 7 * 86_400_000) return;
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token())}`);
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`Instagram: não consegui renovar o token (${JSON.stringify(j.error ?? j)})`);
  kv.set("ig_token", j.access_token);
  kv.set("ig_token_renovado_em", Date.now());
  log(`instagram: token renovado, vale mais ${Math.round(j.expires_in / 86_400)} dias`);
}

async function graph(metodo, caminho, params = {}) {
  const url = new URL(`${base()}${caminho}`);
  const opcoes = { method: metodo, headers: { authorization: `Bearer ${token()}` } };
  if (metodo === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else {
    opcoes.headers["content-type"] = "application/json";
    opcoes.body = JSON.stringify(params);
  }
  const r = await fetch(url, opcoes);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram ${metodo} ${caminho} ${r.status}: ${JSON.stringify(j.error ?? j)}`);
  return j;
}

/** Legenda do Reel: sem #shorts, com hashtags de futebol e as fontes (máx. 2.200 caracteres). */
export function legenda(f) {
  const j = f.jogador;
  const veredito = f.cenas.at(-1);
  const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  const texto = [
    `#${f.posicao} do TOP 10 · ${f.tema}`,
    `${j.nome} · ${j.posicao} · ${j.clube}${j.idade ? ` · ${j.idade} anos` : ""}`,
    "",
    veredito?.narracao ?? "",
    "",
    "Comenta: cabe ou não cabe no seu time? ✅❌",
    "",
    "Fontes dos números:",
    ...f.fontes.map((x) => `• ${x.titulo}`),
    "",
    ["#scout", "#futebol", "#futebolbrasileiro", "#mercadodabola", "#brasileirao", "#cabenoseutime", tag(j.nome)].join(" "),
  ].join("\n");
  return texto.slice(0, 2200);
}

/** Publica o mp4 como Reel e devolve o id do post. */
export async function publicarReel(arquivo, f) {
  if (config.dryRun) {
    log(`[instagram:dry] Reel de ${f.id} publicado`);
    return `dry-ig-${f.id}`;
  }
  const tamanho = fs.statSync(arquivo).size;

  // 1. container
  const c = await graph("POST", `/${config.igUserId}/media`, {
    media_type: "REELS",
    upload_type: "resumable",
    caption: legenda(f),
    share_to_feed: true,
  });

  // 2. bytes do vídeo
  const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${config.igVersao}/${c.id}`, {
    method: "POST",
    headers: { authorization: `OAuth ${token()}`, offset: "0", file_size: String(tamanho) },
    body: await fs.openAsBlob(arquivo),
  });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw new Error(`Instagram upload ${up.status}: ${JSON.stringify(uj)}`);

  // 3. espera o processamento (normalmente 30 s a 2 min)
  for (let i = 0; ; i++) {
    const s = await graph("GET", `/${c.id}`, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram processamento: ${s.status_code} ${s.status ?? ""}`);
    if (i >= 60) throw new Error("Instagram: processamento passou de 10 min");
    await espera(10_000);
  }

  // 4. publica
  const p = await graph("POST", `/${config.igUserId}/media_publish`, { creation_id: c.id });
  return p.id;
}
