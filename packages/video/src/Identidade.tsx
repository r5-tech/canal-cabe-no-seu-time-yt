import "@fontsource/anton";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import React from "react";
import { AbsoluteFill } from "remotion";
import { COR, TEXTO, TITULO } from "./visual";

/**
 * Identidade digital do canal: avatar, banner, marca d'água e capas de destaque.
 * Tudo sai da mesma paleta e das mesmas fontes dos shorts (visual.tsx).
 * Gerar os PNGs: node scripts/identidade.mjs  → identidade/png/
 */

/*
 * A marca: uma escalação 4-3-3 vista de cima, com uma vaga em aberto no meio.
 * A peça verde é o jogador que "cabe" ali. É a pergunta do canal em forma de desenho.
 */
const ESCALACAO: [number, number][] = [
  // ataque
  [-0.62, -0.62], [0, -0.74], [0.62, -0.62],
  // meio (o centro fica vazio: é a vaga)
  [-0.56, -0.06], [0.56, -0.06],
  // defesa
  [-0.78, 0.5], [-0.27, 0.6], [0.27, 0.6], [0.78, 0.5],
];
const VAGA: [number, number] = [0, -0.06];

/** Desenha a marca centrada em (cx, cy) com "raio" r. `contorno` liga as linhas do campo. */
export const Marca: React.FC<{ cx: number; cy: number; r: number; contorno?: boolean; corDots?: string; opDots?: number }> = ({
  cx,
  cy,
  r,
  contorno = true,
  corDots = COR.cinza,
  opDots = 0.55,
}) => {
  const p = (x: number, y: number) => [cx + x * r, cy + y * r] as const;
  const dot = r * 0.12;
  const [vx, vy] = p(...VAGA);
  return (
    <g>
      {contorno ? (
        <g fill="none" stroke={COR.cinza} strokeOpacity={0.28} strokeWidth={r * 0.02}>
          <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={r * 0.08} />
          <line x1={cx - r} y1={cy + r * 0.3} x2={cx + r} y2={cy + r * 0.3} />
        </g>
      ) : null}
      {ESCALACAO.map(([x, y], i) => {
        const [px, py] = p(x, y);
        return <circle key={i} cx={px} cy={py} r={dot} fill={corDots} fillOpacity={opDots} />;
      })}
      <circle cx={vx} cy={vy} r={dot * 2.05} fill="none" stroke={COR.acento} strokeWidth={r * 0.035} strokeDasharray={`${r * 0.09} ${r * 0.07}`} />
      <circle cx={vx} cy={vy} r={dot * 1.45} fill={COR.acento} />
    </g>
  );
};

/** Nome em duas cores: "CABE NO SEU" branco, "TIME?" no acento. */
const Nome: React.FC<{ tamanho: number; style?: React.CSSProperties }> = ({ tamanho, style }) => (
  <div style={{ fontFamily: TITULO, fontSize: tamanho, lineHeight: 1, color: COR.branco, letterSpacing: tamanho * 0.01, ...style }}>
    CABE NO SEU <span style={{ color: COR.acento }}>TIME?</span>
  </div>
);

/* ---------- Avatar (YouTube e Instagram) · 800x800, seguro para corte circular ---------- */
export const Avatar: React.FC = () => (
  <AbsoluteFill style={{ background: COR.fundo }}>
    <svg width={800} height={800}>
      <circle cx={400} cy={400} r={400} fill={COR.fundo2} />
      <Marca cx={400} cy={392} r={235} contorno={false} opDots={0.7} />
    </svg>
  </AbsoluteFill>
);

/* ---------- Banner do YouTube · 2560x1440, conteúdo na área segura central 1546x423 ---------- */
const BANNER = { w: 2560, h: 1440, seguraW: 1546, seguraH: 423 };
export const Banner: React.FC = () => {
  const sx = (BANNER.w - BANNER.seguraW) / 2;
  const sy = (BANNER.h - BANNER.seguraH) / 2;
  // escalações apagadas espalhadas: aparecem na TV e no desktop, somem no celular sem fazer falta
  const fundo = [
    [180, 260, 150], [520, 1180, 120], [2380, 230, 140], [2080, 1210, 130], [360, 760, 90], [2240, 720, 95],
  ];
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <svg width={BANNER.w} height={BANNER.h} style={{ position: "absolute" }}>
        <polygon points={`0,${sy + 330} ${BANNER.w},${sy + 40} ${BANNER.w},${sy + 130} 0,${sy + 420}`} fill={COR.fundo2} />
        {fundo.map(([x, y, r], i) => (
          <g key={i} opacity={0.35}>
            <Marca cx={x} cy={y} r={r} contorno={false} opDots={0.5} />
          </g>
        ))}
        <Marca cx={sx + 190} cy={BANNER.h / 2} r={170} />
      </svg>
      <div style={{ position: "absolute", left: sx + 420, top: sy + 40, width: BANNER.seguraW - 440 }}>
        <Nome tamanho={150} />
        <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 50, color: COR.branco, marginTop: 26 }}>
          Scout de futebol que foge do óbvio
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
          <span style={{ background: COR.acento, color: COR.fundo, fontFamily: TITULO, fontSize: 44, padding: "4px 20px", borderRadius: 10 }}>
            TOP 10 TODA SEGUNDA
          </span>
          <span style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 38, color: COR.cinza, alignSelf: "center" }}>
            números, contexto e o veredito
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Marca d'água do YouTube · 150x150, fundo transparente ---------- */
export const MarcaDagua: React.FC = () => (
  <AbsoluteFill>
    <svg width={150} height={150}>
      <rect x={4} y={4} width={142} height={142} rx={22} fill={COR.fundo} fillOpacity={0.85} />
      <Marca cx={75} cy={73} r={52} contorno={false} corDots={COR.branco} opDots={0.75} />
    </svg>
  </AbsoluteFill>
);

/* ---------- Capas de destaque do Instagram · 1080x1920, ícone no círculo central ---------- */
export const DESTAQUES = {
  top10: { grande: "10", rotulo: "TOP 10" },
  sub20: { grande: "S20", rotulo: "SUB-20" },
  contratos: { grande: "FIM", rotulo: "CONTRATOS" },
  europa: { grande: "EU", rotulo: "NA EUROPA" },
  veredito: { grande: "?", rotulo: "VEREDITO" },
} as const;
export type Destaque = keyof typeof DESTAQUES;

export const CapaDestaque: React.FC<{ tipo: Destaque }> = ({ tipo }) => {
  const d = DESTAQUES[tipo];
  return (
    <AbsoluteFill style={{ background: COR.fundo, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: COR.fundo2,
          border: `14px solid ${COR.acento}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: TITULO, fontSize: d.grande.length > 2 ? 210 : 280, lineHeight: 1, color: COR.acento }}>{d.grande}</div>
        <div style={{ fontFamily: TITULO, fontSize: 64, color: COR.branco, marginTop: 10 }}>{d.rotulo}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Folha da marca · 1600x1000, referência rápida para quem mexer no canal ---------- */
export const FolhaMarca: React.FC = () => {
  const cores: [string, string][] = [
    ["fundo", COR.fundo], ["fundo2", COR.fundo2], ["acento", COR.acento], ["branco", COR.branco],
    ["cinza", COR.cinza], ["vermelho", COR.vermelho], ["amarelo", COR.amarelo],
  ];
  return (
    <AbsoluteFill style={{ background: COR.fundo, padding: 80 }}>
      <svg width={1600} height={1000} style={{ position: "absolute", left: 0, top: 0 }}>
        <Marca cx={1310} cy={330} r={210} />
      </svg>
      <Nome tamanho={110} />
      <div style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 34, color: COR.cinza, marginTop: 18, width: 900 }}>
        Uma escalação com uma vaga aberta. A peça verde é o jogador que cabe ali.
      </div>
      <div style={{ marginTop: 60, fontFamily: TITULO, fontSize: 72, color: COR.branco }}>ANTON · TÍTULOS E NÚMEROS</div>
      <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 40, color: COR.branco, marginTop: 10 }}>Inter 500/600/700 · textos e legendas</div>
      <div style={{ display: "flex", gap: 24, marginTop: 80 }}>
        {cores.map(([nome, hex]) => (
          <div key={nome} style={{ width: 180 }}>
            <div style={{ height: 120, borderRadius: 14, background: hex, border: `2px solid ${COR.fundo2}` }} />
            <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 26, color: COR.branco, marginTop: 12 }}>{nome}</div>
            <div style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 24, color: COR.cinza }}>{hex}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
