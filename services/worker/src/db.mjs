import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.mjs";

/**
 * Estados de cada short:
 *   draft -> audio_ok -> rendered -> in_review -> approved -> scheduled -> published
 *   in_review -> rejected (volta a draft quando o JSON da ficha mudar)
 *   qualquer etapa -> erro (após N tentativas; volta a draft quando o JSON mudar ou via /retentar)
 */
export const ESTADOS = ["draft", "audio_ok", "rendered", "in_review", "approved", "scheduled", "published", "rejected", "erro"];

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS shorts (
    id TEXT PRIMARY KEY,
    semana TEXT NOT NULL,
    posicao INTEGER NOT NULL,
    arquivo TEXT NOT NULL,
    hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    tentativas INTEGER NOT NULL DEFAULT 0,
    erro TEXT,
    video TEXT,
    telegram_msg_id INTEGER,
    youtube_id TEXT,
    publish_at TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS kv (chave TEXT PRIMARY KEY, valor TEXT);
`);

/** Ordem de trabalho: semana mais antiga primeiro e, dentro dela, do #10 ao #1 (a ordem da contagem). */
const ORDEM = "ORDER BY semana, posicao DESC";

export const sh = {
  get: (id) => db.prepare("SELECT * FROM shorts WHERE id = ?").get(id),
  todos: () => db.prepare(`SELECT * FROM shorts ${ORDEM}`).all(),
  porStatus: (status) => db.prepare(`SELECT * FROM shorts WHERE status = ? ${ORDEM}`).all(status),
  daSemana: (semana) => db.prepare(`SELECT * FROM shorts WHERE semana = ? ${ORDEM}`).all(semana),
  contar: (status) => db.prepare("SELECT COUNT(*) AS n FROM shorts WHERE status = ?").get(status).n,
  inserir: (f, arquivo, hash) =>
    db.prepare("INSERT INTO shorts (id, semana, posicao, arquivo, hash) VALUES (?, ?, ?, ?, ?)").run(f.id, f.semana, f.posicao, arquivo, hash),
  atualizar: (id, campos) => {
    const chaves = Object.keys(campos);
    const sets = chaves.map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE shorts SET ${sets}, atualizado_em = datetime('now') WHERE id = ?`).run(...chaves.map((k) => campos[k] ?? null), id);
  },
  publishAtsOcupados: () =>
    db
      .prepare("SELECT publish_at FROM shorts WHERE publish_at IS NOT NULL AND status IN ('approved','scheduled','published')")
      .all()
      .map((r) => r.publish_at),
};

export const kv = {
  get: (k, padrao = null) => db.prepare("SELECT valor FROM kv WHERE chave = ?").get(k)?.valor ?? padrao,
  set: (k, v) => db.prepare("INSERT INTO kv (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(k, String(v)),
};
