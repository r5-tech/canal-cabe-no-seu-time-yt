import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config, log } from "./config.mjs";
import { TEMAS } from "./semanas.mjs";

/**
 * Pauta: uma ideia de top 10.
 *   sugerida -> agendada (ganha uma semana) -> em_producao (fichas da semana commitadas) -> publicada
 *   sugerida -> descartada · agendada -> sugerida (liberar a semana)
 */
export const STATUS = ["sugerida", "agendada", "em_producao", "publicada", "descartada"];

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS pautas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    tema TEXT NOT NULL DEFAULT 'livre',
    descricao TEXT NOT NULL DEFAULT '',
    sugerida_por TEXT NOT NULL DEFAULT 'Erick',
    origem TEXT NOT NULL DEFAULT 'front',
    semana TEXT,
    status TEXT NOT NULL DEFAULT 'sugerida',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS pautas_semana_ativa
    ON pautas(semana) WHERE semana IS NOT NULL AND status IN ('agendada','em_producao','publicada');
  CREATE TABLE IF NOT EXISTS kv (chave TEXT PRIMARY KEY, valor TEXT);
`);

const limpar = (s, max) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export const pautas = {
  get: (id) => db.prepare("SELECT * FROM pautas WHERE id = ?").get(Number(id)),
  daSemana: (semana) =>
    db.prepare("SELECT * FROM pautas WHERE semana = ? AND status IN ('agendada','em_producao','publicada')").get(semana),
  porStatus: (...status) =>
    db
      .prepare(`SELECT * FROM pautas WHERE status IN (${status.map(() => "?").join(",")}) ORDER BY COALESCE(semana, ''), id`)
      .all(...status),
  historico: (n = 20) =>
    db.prepare("SELECT * FROM pautas WHERE status IN ('publicada','descartada') ORDER BY atualizado_em DESC LIMIT ?").all(n),
  contar: () => db.prepare("SELECT COUNT(*) AS n FROM pautas").get().n,

  sugerir({ titulo, tema, descricao, sugerida_por, origem }) {
    const t = limpar(titulo, 120);
    if (!t) throw new Error("a pauta precisa de um título");
    const r = db
      .prepare("INSERT INTO pautas (titulo, tema, descricao, sugerida_por, origem) VALUES (?, ?, ?, ?, ?)")
      .run(t, TEMAS[tema] ? tema : "livre", String(descricao ?? "").trim().slice(0, 1000), limpar(sugerida_por, 40) || "Erick", limpar(origem, 20) || "front");
    log(`pauta #${r.lastInsertRowid} sugerida: ${t}`);
    return pautas.get(r.lastInsertRowid);
  },

  agendar(id, semana) {
    const p = pautas.get(id);
    if (!p) throw new Error(`pauta ${id} não existe`);
    if (!/^\d{4}-w\d{2}$/.test(semana ?? "")) throw new Error("semana inválida");
    if (!["sugerida", "agendada"].includes(p.status)) throw new Error(`pauta ${id} está ${p.status}`);
    const ocupada = pautas.daSemana(semana);
    if (ocupada && ocupada.id !== p.id) throw new Error(`a semana ${semana} já tem a pauta #${ocupada.id}`);
    pautas.atualizar(id, { status: "agendada", semana });
    log(`pauta #${id} agendada para ${semana}`);
  },

  liberar(id) {
    const p = pautas.get(id);
    if (p?.status !== "agendada") throw new Error(`pauta ${id} não está agendada`);
    pautas.atualizar(id, { status: "sugerida", semana: null });
  },

  descartar(id) {
    const p = pautas.get(id);
    if (!p || !["sugerida", "agendada"].includes(p.status)) throw new Error(`pauta ${id} não pode ser descartada`);
    pautas.atualizar(id, { status: "descartada", semana: null });
  },

  editar(id, { titulo, tema, descricao }) {
    const t = limpar(titulo, 120);
    if (!t) throw new Error("a pauta precisa de um título");
    pautas.atualizar(id, { titulo: t, tema: TEMAS[tema] ? tema : "livre", descricao: String(descricao ?? "").trim().slice(0, 1000) });
  },

  atualizar(id, campos) {
    const chaves = Object.keys(campos);
    db.prepare(`UPDATE pautas SET ${chaves.map((k) => `${k} = ?`).join(", ")}, atualizado_em = datetime('now') WHERE id = ?`).run(
      ...chaves.map((k) => campos[k] ?? null),
      Number(id),
    );
  },
};

export const kv = {
  get: (k, padrao = null) => db.prepare("SELECT valor FROM kv WHERE chave = ?").get(k)?.valor ?? padrao,
  set: (k, v) => db.prepare("INSERT INTO kv (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(k, String(v)),
};

/** Na primeira vez (banco vazio), carrega cerebro/programacao-inicial.json. */
export function importarProgramacaoInicial() {
  if (pautas.contar() > 0 || !fs.existsSync(config.programacaoInicial)) return 0;
  const lista = JSON.parse(fs.readFileSync(config.programacaoInicial, "utf8"));
  for (const item of lista) {
    const p = pautas.sugerir({ ...item, origem: "importada" });
    if (item.semana) pautas.agendar(p.id, item.semana);
  }
  log(`programação inicial importada: ${lista.length} pautas`);
  return lista.length;
}
