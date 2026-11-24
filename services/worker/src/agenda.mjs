import { config } from "./config.mjs";

const doisDig = (n) => String(n).padStart(2, "0");

/** Data local (YYYY-MM-DD) no fuso configurado. */
const dataLocal = (d) => {
  const [sinal, hh, mm] = config.fusoOffset.match(/([+-])(\d\d):(\d\d)/).slice(1);
  const off = (sinal === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  const l = new Date(d.getTime() + off * 60_000);
  return `${l.getUTCFullYear()}-${doisDig(l.getUTCMonth() + 1)}-${doisDig(l.getUTCDate())}`;
};

/** Segunda-feira (YYYY-MM-DD) da semana ISO "2026-w48". */
export function segundaDaSemana(semana) {
  const [, ano, sem] = semana.match(/^(\d{4})-w(\d{2})$/).map(Number);
  // 4 de janeiro está sempre na semana 1
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const diaSemana = jan4.getUTCDay() || 7;
  const seg1 = new Date(jan4.getTime() - (diaSemana - 1) * 86_400_000);
  const seg = new Date(seg1.getTime() + (sem - 1) * 7 * 86_400_000);
  return `${seg.getUTCFullYear()}-${doisDig(seg.getUTCMonth() + 1)}-${doisDig(seg.getUTCDate())}`;
}

/** Semana ISO ("2026-w48") de uma data. */
export function semanaIso(d = new Date()) {
  const [a, m, dd] = dataLocal(d).split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, dd));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ano = t.getUTCFullYear();
  const sem = Math.ceil(((t - Date.UTC(ano, 0, 1)) / 86_400_000 + 1) / 7);
  return `${ano}-w${doisDig(sem)}`;
}

/**
 * Próximo horário livre (ISO UTC) a partir de agora + antecedência mínima,
 * em qualquer dia, nos horários configurados. Usado quando a segunda já passou.
 */
export function proximoHorario(ocupados, agora = new Date()) {
  const ocupadosMs = new Set(ocupados.map((s) => new Date(s).getTime()));
  const minimo = agora.getTime() + config.antecedenciaMinHoras * 3_600_000;
  const dia = new Date(`${dataLocal(agora)}T12:00:00${config.fusoOffset}`);
  for (let i = 0; i < 400; i++) {
    const d = dataLocal(new Date(dia.getTime() + i * 86_400_000));
    for (const h of config.horarios) {
      const t = new Date(`${d}T${h}:00${config.fusoOffset}`).getTime();
      if (t >= minimo && !ocupadosMs.has(t)) return new Date(t).toISOString();
    }
  }
  throw new Error("sem horário livre nos próximos 400 dias");
}

/**
 * Horário do short na segunda-feira de lançamento: o #10 no primeiro horário, o #1 no último.
 * Se esse horário já passou (aprovação atrasada) ou está ocupado, cai no próximo horário livre.
 */
export function horarioDoShort({ semana, posicao }, ocupados, agora = new Date()) {
  const n = config.horarios.length;
  const idx = Math.max(0, Math.min(n - 1, n - posicao));
  const t = new Date(`${segundaDaSemana(semana)}T${config.horarios[idx]}:00${config.fusoOffset}`);
  const livre = !ocupados.some((o) => new Date(o).getTime() === t.getTime());
  if (livre && t.getTime() >= agora.getTime() + config.antecedenciaMinHoras * 3_600_000) return t.toISOString();
  return proximoHorario(ocupados, agora);
}

export const formatarLocal = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Está dentro da janela de render? ("01-07", "22-06" ou "sempre") */
export function dentroDaJanela(agora = new Date()) {
  if (config.janelaRender === "sempre") return true;
  const [ini, fim] = config.janelaRender.split("-").map(Number);
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(agora));
  return ini <= fim ? hora >= ini && hora < fim : hora >= ini || hora < fim;
}
