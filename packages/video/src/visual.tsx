import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/** Identidade visual do canal (a mesma do short piloto do Rômulo). */
export const COR = {
  fundo: "#0B0F14",
  fundo2: "#141B24",
  acento: "#C6FF3D",
  branco: "#F5F7FA",
  cinza: "#8C96A5",
  vermelho: "#FF5454",
  amarelo: "#FFC400",
};
export const TITULO = "'Anton', sans-serif";
export const TEXTO = "'Inter', sans-serif";

/** Faixa útil do conteúdo: abaixo do cabeçalho e acima da legenda e dos botões do Shorts. */
export const AREA = { topo: 290, base: 1400 };

/** 0→1 com ease-out a partir de `atraso` frames, durante `dur` frames. */
export const useEntrada = (atraso = 0, dur = 12) => {
  const f = useCurrentFrame();
  return interpolate(f, [atraso, atraso + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
};

/** Bloco que entra com fade + deslize de baixo para cima. */
export const Entra: React.FC<{ atraso?: number; dur?: number; dy?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  atraso = 0,
  dur = 12,
  dy = 36,
  style,
  children,
}) => {
  const a = useEntrada(atraso, dur);
  return <div style={{ opacity: a, transform: `translateY(${(1 - a) * dy}px)`, ...style }}>{children}</div>;
};

/** Texto centralizado numa linha absoluta. */
export const Linha: React.FC<{ y: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ y, style, children }) => (
  <div style={{ position: "absolute", top: y, left: 60, right: 60, textAlign: "center", ...style }}>{children}</div>
);

/** Formata número no padrão brasileiro (24,05). */
export const br = (v: number, decimais = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais });

/** Ajusta o tamanho da fonte ao comprimento do texto, para nada estourar a largura. */
export const caber = (texto: string, base: number, maxChars: number) =>
  texto.length <= maxChars ? base : Math.floor((base * maxChars) / texto.length);
