import fs from "node:fs";
import { config, log } from "./config.mjs";
import { kv } from "./db.mjs";

let cacheToken = { valor: "", expira: 0 };

async function accessToken() {
  if (cacheToken.valor && Date.now() < cacheToken.expira - 60_000) return cacheToken.valor;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.ytClientId,
      client_secret: config.ytClientSecret,
      refresh_token: config.ytRefreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OAuth: ${j.error} ${j.error_description ?? ""} (refresh token expirado? rode npm run youtube-auth)`);
  cacheToken = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return cacheToken.valor;
}

const limpar = (s, max) => s.replace(/[<>]/g, "").slice(0, max);
const hashtag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");

/** Monta título, descrição e tags a partir da ficha (campos `youtube` do JSON têm prioridade). */
export function metadados(f) {
  const yt = f.youtube ?? {};
  const j = f.jogador;
  const titulo = yt.titulo ?? `#${f.posicao} ${j.nome}: cabe no seu time? | ${f.tema} #shorts`;
  const veredito = f.cenas.at(-1);
  const descricao =
    yt.descricao ??
    [
      `TOP 10 · ${f.tema} · #${f.posicao}`,
      `${j.nome} · ${j.posicao} · ${j.clube}${j.idade ? ` · ${j.idade} anos` : ""}`,
      "",
      veredito?.narracao ?? "",
      "",
      "Fontes dos números:",
      ...f.fontes.map((x) => `• ${x.titulo}: ${x.url}`),
      "",
      `${config.canalNome}: scout de futebol fora do óbvio. Todo segunda tem top 10 novo.`,
      "",
      ["#shorts", "#scout", "#futebol", "#mercadodabola", hashtag(j.nome)].join(" "),
    ].join("\n");
  const tags = yt.tags ?? [j.nome, j.clube, "scout", "futebol brasileiro", "mercado da bola", "brasileirão", "cabe no seu time", f.tema];
  return { titulo: limpar(titulo, 100), descricao: limpar(descricao, 4900), tags };
}

async function api(metodo, url, corpo) {
  const token = await accessToken();
  const r = await fetch(url, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube ${metodo} ${url.split("?")[0]} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

/** Playlist pública da semana (criada uma vez e guardada no kv). */
async function playlistDaSemana(f) {
  const chave = `playlist:${f.semana}`;
  const existente = kv.get(chave);
  if (existente) return existente;
  const j = await api("POST", "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
    snippet: {
      title: limpar(`Top 10 · ${f.tema}`, 150),
      description: `${config.canalNome} · semana ${f.semana}. Os 10 nomes, do #10 ao #1.`,
      defaultLanguage: "pt-BR",
    },
    status: { privacyStatus: "public" },
  });
  kv.set(chave, j.id);
  return j.id;
}

/**
 * Upload resumable. O vídeo sobe como privado com `publishAt`, e o próprio YouTube publica no horário.
 * Retorna o id do vídeo.
 */
export async function enviar(arquivo, f, publishAt) {
  const m = metadados(f);
  if (config.dryRun) {
    log(`[youtube:dry] "${m.titulo}" agendado para ${publishAt}`);
    return `dry-${f.id}`;
  }
  const token = await accessToken();
  const tamanho = fs.statSync(arquivo).size;
  const ini = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(tamanho),
      "x-upload-content-type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: {
        title: m.titulo,
        description: m.descricao,
        tags: m.tags,
        categoryId: "17", // Esportes
        defaultLanguage: "pt-BR",
        defaultAudioLanguage: "pt-BR",
      },
      status: {
        privacyStatus: "private",
        publishAt,
        selfDeclaredMadeForKids: false,
        // gráficos e narração de análise: não mostra pessoa real fazendo ou dizendo algo que não fez
        containsSyntheticMedia: false,
      },
    }),
  });
  if (!ini.ok) throw new Error(`YouTube init ${ini.status}: ${await ini.text()}`);
  const url = ini.headers.get("location");
  const up = await fetch(url, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "video/mp4", "content-length": String(tamanho) },
    body: await fs.openAsBlob(arquivo),
  });
  const j = await up.json();
  if (!up.ok) throw new Error(`YouTube upload ${up.status}: ${JSON.stringify(j)}`);

  if (config.playlistSemanal) {
    try {
      const pl = await playlistDaSemana(f);
      await api("POST", "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
        snippet: { playlistId: pl, resourceId: { kind: "youtube#video", videoId: j.id }, position: 10 - f.posicao },
      });
    } catch (e) {
      log(`[${f.id}] aviso: não entrou na playlist: ${e.message}`);
    }
  }
  return j.id;
}
