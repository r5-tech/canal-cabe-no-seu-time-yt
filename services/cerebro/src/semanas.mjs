import { config } from "./config.mjs";

const doisDig = (n) => String(n).padStart(2, "0");

/** Data local (YYYY-MM-DD) no fuso do canal. */
export function dataLocal(d = new Date()) {
  const [sinal, hh, mm] = config.fusoOffset.match(/([+-])(\d\d):(\d\d)/).slice(1);
  const off = (sinal === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  const l = new Date(d.getTime() + off * 60_000);
  return `${l.getUTCFullYear()}-${doisDig(l.getUTCMonth() + 1)}-${doisDig(l.getUTCDate())}`;
}

/** Semana ISO ("2026-w49") de uma data YYYY-MM-DD. */
export function semanaDe(ymd) {
  const [a, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ano = t.getUTCFullYear();
  const sem = Math.ceil(((t - Date.UTC(ano, 0, 1)) / 86_400_000 + 1) / 7);
  return `${ano}-w${doisDig(sem)}`;
}

/** Segunda-feira (YYYY-MM-DD) da semana ISO. */
export function segundaDaSemana(semana) {
  const [, ano, sem] = semana.match(/^(\d{4})-w(\d{2})$/).map(Number);
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dia = jan4.getUTCDay() || 7;
  const seg = new Date(jan4.getTime() - (dia - 1) * 86_400_000 + (sem - 1) * 7 * 86_400_000);
  return seg.toISOString().slice(0, 10);
}

const somarDias = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * As próximas N semanas de lançamento, a partir da próxima segunda
 * (hoje sendo segunda, a semana de hoje já está em produção e entra também).
 */
export function proximasSemanas(n, agora = new Date()) {
  const hoje = dataLocal(agora);
  const dia = new Date(`${hoje}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const primeiraSegunda = somarDias(hoje, dia === 1 ? 0 : (8 - dia) % 7 || 7);
  return Array.from({ length: n }, (_, i) => {
    const segunda = somarDias(primeiraSegunda, 7 * i);
    const sexta = somarDias(segunda, 4);
    // vídeo longo: sexta, ou quinta quando a sexta é Natal ou Ano-Novo
    const feriado = ["12-25", "01-01"].includes(sexta.slice(5));
    return { semana: semanaDe(segunda), segunda, sexta: feriado ? somarDias(segunda, 3) : sexta };
  });
}

export const formatarDia = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** Temas do ciclo de 4 semanas (semana do mês pela data da segunda). A 5ª segunda do mês é livre. */
export const TEMAS = {
  sub23: "Sub-23 com potencial",
  contrato: "Fim de contrato",
  series: "Garimpo das séries",
  mercado: "Mercado em alta",
  especial: "Especial",
  livre: "Livre",
};

export function temaDaRotacao(segunda) {
  const ordem = Math.ceil(Number(segunda.slice(8, 10)) / 7);
  return ["sub23", "contrato", "series", "mercado"][ordem - 1] ?? "livre";
}
