import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config, log } from "./config.mjs";
import { pautas } from "./db.mjs";
import { TEMAS, proximasSemanas, temaDaRotacao } from "./semanas.mjs";

const temFichas = (semana) => {
  const dir = path.join(config.fichasDir, semana);
  return fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.endsWith(".json"));
};

/** Status dos shorts da semana no banco do worker (só leitura). */
function semanaPublicada(semana) {
  if (!fs.existsSync(config.workerDbPath)) return false;
  let wdb;
  try {
    wdb = new DatabaseSync(config.workerDbPath, { readOnly: true });
    const r = wdb
      .prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS pub FROM shorts WHERE semana = ?")
      .get(semana);
    return r.total > 0 && r.pub === r.total;
  } catch (e) {
    log("aviso: não consegui ler o banco do worker:", e.message);
    return false;
  } finally {
    wdb?.close();
  }
}

/** Avança o status das pautas pelo que já aconteceu no repositório e no worker. */
export function sincronizarStatus() {
  for (const p of pautas.porStatus("agendada", "em_producao")) {
    if (semanaPublicada(p.semana)) {
      pautas.atualizar(p.id, { status: "publicada" });
      log(`pauta #${p.id} publicada (${p.semana})`);
    } else if (p.status === "agendada" && temFichas(p.semana)) {
      pautas.atualizar(p.id, { status: "em_producao" });
      log(`pauta #${p.id} em produção: fichas de ${p.semana} no repositório`);
    }
  }
}

const resumo = (p) =>
  p && {
    id: p.id,
    titulo: p.titulo,
    tema: p.tema,
    temaNome: TEMAS[p.tema] ?? p.tema,
    descricao: p.descricao,
    sugeridaPor: p.sugerida_por,
    status: p.status,
  };

/** A agenda das próximas semanas + a fila de sugestões, no formato que a tarefa semanal lê. */
export function montarAgenda(agora = new Date()) {
  const semanas = proximasSemanas(config.semanasAFrente, agora).map((s) => {
    const p = pautas.daSemana(s.semana);
    const rot = temaDaRotacao(s.segunda);
    return {
      semana: s.semana,
      segunda: s.segunda,
      videoLongo: s.sexta,
      fichasNoRepositorio: temFichas(s.semana),
      pauta: resumo(p) ?? null,
      temaDaRotacao: rot,
      temaDaRotacaoNome: TEMAS[rot],
    };
  });
  const fila = pautas.porStatus("sugerida").map((p) => ({ ...resumo(p), criadaEm: p.criado_em }));
  return {
    comoUsar:
      "Gerado pelo cérebro na VPS. Para a semana que você vai produzir: se 'pauta' existir, ela é o tema da semana. " +
      "Se for null, escolha pelo momento, priorizando a 'fila' (sugestões do Erick) e o 'temaDaRotacao'.",
    semanas,
    fila,
  };
}

/** Grava cerebro/agenda.json só quando o conteúdo muda (o timestamp acompanha a mudança). */
export function exportar(agora = new Date()) {
  const agenda = montarAgenda(agora);
  let anterior = null;
  try {
    anterior = JSON.parse(fs.readFileSync(config.agendaPath, "utf8"));
  } catch {
    /* primeira vez */
  }
  const { atualizadoEm: _, ...semData } = anterior ?? {};
  if (anterior && JSON.stringify(semData) === JSON.stringify(agenda)) return false;
  fs.mkdirSync(path.dirname(config.agendaPath), { recursive: true });
  const tmp = `${config.agendaPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ atualizadoEm: agora.toISOString(), ...agenda }, null, 2) + "\n");
  fs.renameSync(tmp, config.agendaPath);
  log("agenda.json atualizado");
  return true;
}
