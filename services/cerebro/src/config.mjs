import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

export const REPO_DIR = path.resolve(env.REPO_DIR ?? path.join(__dirname, "../../.."));
export const DATA_DIR = path.resolve(env.DATA_DIR ?? path.join(REPO_DIR, "data"));

export const config = {
  repoDir: REPO_DIR,
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, "cerebro.db"),
  /** banco do worker, só leitura: diz quais semanas já foram publicadas */
  workerDbPath: path.join(DATA_DIR, "worker.db"),
  fichasDir: path.join(REPO_DIR, "fichas"),
  /** arquivo que a tarefa semanal do Claude lê; o sincronizar-repo.sh faz commit e push dele */
  agendaPath: path.join(REPO_DIR, "cerebro", "agenda.json"),
  programacaoInicial: path.join(REPO_DIR, "cerebro", "programacao-inicial.json"),
  host: env.CEREBRO_HOST ?? "0.0.0.0",
  porta: Number(env.CEREBRO_PORTA ?? 8080),
  /** quantas semanas a agenda mostra e exporta */
  semanasAFrente: Number(env.CEREBRO_SEMANAS ?? 10),
  fusoOffset: env.FUSO_OFFSET ?? "-03:00",
};

export const log = (...a) => console.log(new Date().toISOString(), "[cerebro]", ...a);
