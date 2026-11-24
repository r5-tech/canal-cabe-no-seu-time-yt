import type { Cena, Ficha } from "./schema";

export const FPS = 30;
export const LARGURA = 1080;
export const ALTURA = 1920;

/** Velocidade média de narração (palavras/segundo) usada só quando ainda não há áudio. */
const PALAVRAS_POR_SEGUNDO = 2.9;
/** respiro depois da fala, antes do corte */
const RESPIRO_SEG = 0.35;
/** cena mínima, para as animações terminarem */
const MIN_SEG = 2.2;
export const FINAL_SEG = 2.5;

export const palavras = (t: string) => t.split(/\s+/).filter(Boolean);

export const duracaoCenaFrames = (cena: Cena) => {
  const seg =
    cena.duracao ??
    (cena.duracaoAudio !== undefined
      ? cena.duracaoAudio + RESPIRO_SEG
      : palavras(cena.narracao).length / PALAVRAS_POR_SEGUNDO + 0.5);
  return Math.round(Math.max(seg, MIN_SEG) * FPS);
};

export const duracaoTotalFrames = (f: Ficha) =>
  f.cenas.reduce((acc, c) => acc + duracaoCenaFrames(c), 0) + Math.round(FINAL_SEG * FPS);

/**
 * Tempo de cada palavra em frames. Usa os tempos reais do serviço de voz quando existem;
 * senão distribui pela duração da cena, ponderando pelo tamanho da palavra.
 */
export const tempoDasPalavras = (cena: Pick<Cena, "narracao" | "palavras">, frames: number) => {
  if (cena.palavras?.length) {
    return cena.palavras.map((p) => ({ palavra: p.palavra, inicio: Math.round(p.inicio * FPS), fim: Math.round(p.fim * FPS) }));
  }
  const ws = palavras(cena.narracao);
  const util = frames - Math.round(0.5 * FPS);
  const pesos = ws.map((w) => 2 + w.replace(/[^\p{L}\p{N}]/gu, "").length + (/[.,!?…:]$/.test(w) ? 3 : 0));
  const soma = pesos.reduce((a, b) => a + b, 0);
  let acc = 0;
  return ws.map((w, i) => {
    const inicio = Math.round((acc / soma) * util);
    acc += pesos[i];
    return { palavra: w, inicio, fim: Math.round((acc / soma) * util) };
  });
};
