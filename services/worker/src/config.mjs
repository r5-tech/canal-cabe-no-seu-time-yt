import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

export const REPO_DIR = path.resolve(env.REPO_DIR ?? path.join(__dirname, "../../.."));
export const DATA_DIR = path.resolve(env.DATA_DIR ?? path.join(REPO_DIR, "data"));

const HORARIOS_PADRAO = "08:00,09:30,11:00,12:30,14:00,15:30,17:00,18:30,20:00,21:30";

export const config = {
  repoDir: REPO_DIR,
  dataDir: DATA_DIR,
  /** fichas/<semana>/<id>.json — a pasta fichas/exemplo é ignorada */
  fichasDir: path.join(REPO_DIR, "fichas"),
  videoDir: path.join(REPO_DIR, "packages/video"),
  dbPath: path.join(DATA_DIR, "worker.db"),
  ttsUrl: env.TTS_URL ?? "http://localhost:8000",

  telegramToken: env.TELEGRAM_TOKEN ?? "",
  telegramChatId: env.TELEGRAM_CHAT_ID ?? "",

  ytClientId: env.YT_CLIENT_ID ?? "",
  ytClientSecret: env.YT_CLIENT_SECRET ?? "",
  ytRefreshToken: env.YT_REFRESH_TOKEN ?? "",

  /** Horários da segunda-feira de lançamento, em ordem: o #10 usa o primeiro, o #1 o último. */
  horarios: (env.HORARIOS_PUBLICACAO ?? HORARIOS_PADRAO).split(",").map((s) => s.trim()).filter(Boolean).sort(),
  fusoOffset: env.FUSO_OFFSET ?? "-03:00", // Brasília (sem horário de verão desde 2019)
  janelaRender: env.JANELA_RENDER ?? "01-07",
  maxEmRevisao: Number(env.MAX_EM_REVISAO ?? 12),
  antecedenciaMinHoras: Number(env.ANTECEDENCIA_MIN_HORAS ?? 1),
  diasManterArquivos: Number(env.DIAS_MANTER_ARQUIVOS ?? 14),
  /** Instagram (Reels): publica no mesmo horário do YouTube */
  instagram: env.INSTAGRAM === "1",
  igUserId: env.IG_USER_ID ?? "",
  igToken: env.IG_TOKEN ?? "",
  /** graph.instagram.com (login do Instagram) ou graph.facebook.com (login do Facebook + Página) */
  igHost: env.IG_HOST ?? "graph.instagram.com",
  igVersao: env.IG_VERSAO ?? "v25.0",
  /** meta de duração do short (s): fora dela o Telegram mostra um aviso */
  duracaoMin: Number(env.DURACAO_MIN ?? 60),
  duracaoMax: Number(env.DURACAO_MAX ?? 65),
  playlistSemanal: (env.PLAYLIST_SEMANAL ?? "1") === "1",
  canalNome: env.CANAL_NOME ?? "Cabe No Seu Time",
  maxTentativas: 3,
  dryRun: env.DRY_RUN === "1",
};

export const log = (...a) => console.log(new Date().toISOString(), ...a);
