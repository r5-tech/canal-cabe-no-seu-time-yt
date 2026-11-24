import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cena, Ficha } from "./schema";
import { br, caber, COR, Entra, Linha, TEXTO, TITULO, useEntrada } from "./visual";

type Props<T extends Cena["tipo"]> = { cena: Extract<Cena, { tipo: T }> };

/** Conta de 0 até o número do texto ("22", "24,05", "US$ 5"), preservando prefixo/sufixo. */
const contarTexto = (texto: string, p: number) => {
  const m = texto.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return texto;
  const [, pre, num, suf] = m;
  const dec = num.includes(",") || num.includes(".") ? num.split(/[.,]/)[1].length : 0;
  const v = Number(num.replace(",", ".")) * p;
  return `${pre}${br(v, dec)}${suf}`;
};

const Gancho: React.FC<Props<"gancho"> & { jogador: Ficha["jogador"] }> = ({ cena, jogador }) => {
  const p = useEntrada(3, 36);
  const fAlerta = useEntrada(44, 10);
  const tam = caber(cena.numero, 520, 3);
  return (
    <>
      <Linha y={330} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 46, color: COR.cinza }}>
        <Entra>{[jogador.nome, jogador.posicao, jogador.idade ? `${jogador.idade} anos` : null].filter(Boolean).join(" · ").toUpperCase()}</Entra>
      </Linha>
      <Linha y={400} style={{ fontFamily: TITULO, fontSize: tam, lineHeight: 1.05, color: COR.acento }}>
        {contarTexto(cena.numero, p)}
      </Linha>
      <Linha y={990} style={{ fontFamily: TITULO, fontSize: caber(cena.rotulo, 92, 20), color: COR.branco, lineHeight: 1.15 }}>
        <Entra atraso={14}>{cena.rotulo}</Entra>
        {cena.sub ? <Entra atraso={18}>{cena.sub}</Entra> : null}
      </Linha>
      {cena.alerta ? (
        <div
          style={{
            position: "absolute",
            top: 1255,
            left: 80,
            right: 80,
            padding: "18px 20px",
            borderRadius: 18,
            background: COR.vermelho,
            textAlign: "center",
            fontFamily: TITULO,
            fontSize: caber(cena.alerta, 58, 30),
            color: COR.fundo,
            opacity: fAlerta,
            transform: `scale(${0.9 + 0.1 * fAlerta})`,
          }}
        >
          {cena.alerta}
        </div>
      ) : null}
    </>
  );
};

const LinhaDoTempo: React.FC<Props<"linhaDoTempo">> = ({ cena }) => {
  const f = useCurrentFrame();
  const n = cena.itens.length;
  const passo = Math.min(290, 900 / n);
  const x0 = 150;
  const y0 = 560;
  const linha = interpolate(f, [8, 8 + 30 * n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Linha y={330} style={{ fontFamily: TITULO, fontSize: 110, color: COR.branco }}>
        <Entra>{cena.titulo}</Entra>
      </Linha>
      <div style={{ position: "absolute", left: x0 - 4, top: y0 + 40, width: 8, height: passo * (n - 1) * linha, background: COR.fundo2 }} />
      {cena.itens.map((it, i) => {
        const cor = it.destaque ? COR.acento : i === 0 ? COR.branco : COR.cinza;
        const atraso = 12 + i * 22;
        return (
          <Entra key={i} atraso={atraso} dy={0} style={{ position: "absolute", left: 0, top: y0 + i * passo, width: "100%" }}>
            <div style={{ position: "absolute", left: x0 - 26, top: 30, width: 52, height: 52, borderRadius: 26, background: cor }} />
            <div style={{ position: "absolute", left: x0 + 70, top: -10, fontFamily: TITULO, fontSize: 110, color: cor }}>{it.ano}</div>
            <div style={{ position: "absolute", left: x0 + 330, top: 14, right: 40 }}>
              <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 48, color: COR.branco }}>{it.linha1}</div>
              {it.linha2 ? <div style={{ fontFamily: TEXTO, fontWeight: 500, fontSize: 44, color: COR.cinza, marginTop: 6 }}>{it.linha2}</div> : null}
            </div>
          </Entra>
        );
      })}
    </>
  );
};

const Numero: React.FC<Props<"numero">> = ({ cena }) => {
  const p = useEntrada(3, 30);
  const a = useEntrada(0, 10);
  const txt = `${cena.prefixo}${br(cena.valor * p, cena.decimais)}${cena.sufixo}`;
  return (
    <>
      <Linha
        y={430}
        style={{
          fontFamily: TITULO,
          fontSize: caber(`${cena.prefixo}${br(cena.valor, cena.decimais)}${cena.sufixo}`, 420, 3),
          lineHeight: 1.05,
          color: COR.acento,
          opacity: a,
          transform: `scale(${0.85 + 0.15 * a})`,
        }}
      >
        {txt}
      </Linha>
      <Linha y={1000} style={{ fontFamily: TITULO, fontSize: caber(cena.rotulo, 100, 14), color: COR.branco }}>
        <Entra atraso={8}>{cena.rotulo}</Entra>
      </Linha>
      {cena.sub ? (
        <Linha y={1135} style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 50, color: COR.cinza }}>
          <Entra atraso={12}>{cena.sub}</Entra>
        </Linha>
      ) : null}
    </>
  );
};

const Barras: React.FC<Props<"barras">> = ({ cena }) => {
  const f = useCurrentFrame();
  const max = Math.max(...cena.barras.map((b) => b.valor));
  const larguraMax = 1080 - 2 * 90 - 40;
  return (
    <>
      <Linha y={330} style={{ fontFamily: TITULO, fontSize: 120, color: COR.branco }}>
        <Entra>{cena.titulo}</Entra>
      </Linha>
      {cena.sub ? (
        <Linha y={490} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 52, color: COR.acento }}>
          <Entra atraso={4}>{cena.sub}</Entra>
        </Linha>
      ) : null}
      {cena.barras.map((b, i) => {
        const p = interpolate(f, [12 + i * 8, 42 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const pe = 1 - (1 - p) ** 3;
        const w = Math.max(larguraMax * (b.valor / max) * pe, 2);
        const dentro = w > larguraMax - 180;
        const y = 640 + i * 150;
        return (
          <div key={i} style={{ position: "absolute", left: 90, top: y, opacity: Math.min(1, p * 4) }}>
            <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 42, color: COR.branco }}>{b.nome}</div>
            <div style={{ position: "relative", marginTop: 8, width: w, height: 60, borderRadius: 10, background: b.destaque ? COR.acento : COR.cinza }}>
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  ...(dentro ? { right: 14 } : { left: w + 14 }),
                  fontFamily: TITULO,
                  fontSize: 48,
                  color: dentro ? COR.fundo : COR.branco,
                  whiteSpace: "nowrap",
                }}
              >
                {br(b.valor * pe, cena.decimais)}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

const Destaque: React.FC<Props<"destaque">> = ({ cena }) => {
  const a = useEntrada(0, 12);
  return (
    <>
      {cena.topo ? (
        <Linha y={420} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 54, color: COR.cinza }}>
          <Entra>{cena.topo}</Entra>
        </Linha>
      ) : null}
      <Linha
        y={500}
        style={{
          fontFamily: TITULO,
          fontSize: caber(cena.grande, 330, 5),
          lineHeight: 1.05,
          color: COR.acento,
          opacity: a,
          transform: `translateY(${(1 - a) * 40}px)`,
        }}
      >
        {cena.grande}
      </Linha>
      <Linha y={930} style={{ fontFamily: TITULO, fontSize: caber(cena.linha, 76, 26), color: COR.branco }}>
        <Entra atraso={9}>{cena.linha}</Entra>
      </Linha>
      {cena.nota ? (
        <Linha y={1075} style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 50, color: COR.cinza }}>
          <Entra atraso={30}>{cena.nota}</Entra>
        </Linha>
      ) : null}
      {cena.alerta ? (
        <Linha y={1150} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 54, color: COR.vermelho }}>
          <Entra atraso={34}>{cena.alerta}</Entra>
        </Linha>
      ) : null}
    </>
  );
};

const PontoFraco: React.FC<Props<"pontoFraco">> = ({ cena }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 160 } });
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", transform: `scale(${s})` }}>
        <svg width={330} height={290} viewBox="0 0 330 290">
          <polygon points="165,0 330,290 0,290" fill={COR.amarelo} />
          <text x="165" y="250" textAnchor="middle" fontFamily="Anton" fontSize="200" fill={COR.fundo}>
            !
          </text>
        </svg>
      </div>
      <Linha y={760} style={{ fontFamily: TITULO, fontSize: 120, color: COR.branco }}>
        <Entra atraso={8}>{cena.titulo}</Entra>
      </Linha>
      {cena.itens.map((it, i) => (
        <Linha key={i} y={960 + i * 95} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: caber(it, 58, 26), color: i === 0 ? COR.branco : COR.cinza }}>
          <Entra atraso={24 + i * 22}>{it}</Entra>
        </Linha>
      ))}
    </>
  );
};

const Botao: React.FC<{ tipo: "sim" | "nao"; a: number }> = ({ tipo, a }) => (
  <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: `scale(${0.6 + 0.4 * a})`, opacity: a }}>
    <circle cx={100} cy={100} r={100} fill={tipo === "sim" ? COR.acento : COR.vermelho} />
    {tipo === "sim" ? (
      <polyline points="55,102 88,135 148,70" fill="none" stroke={COR.fundo} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <>
        <line x1={62} y1={62} x2={138} y2={138} stroke={COR.fundo} strokeWidth={22} strokeLinecap="round" />
        <line x1={138} y1={62} x2={62} y2={138} stroke={COR.fundo} strokeWidth={22} strokeLinecap="round" />
      </>
    )}
  </svg>
);

const Veredito: React.FC<Props<"veredito">> = ({ cena }) => {
  const p = useEntrada(0, 24);
  const b = useEntrada(40, 12);
  return (
    <>
      <Linha y={320} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 54, color: COR.cinza }}>
        <Entra>{cena.topo}</Entra>
      </Linha>
      <Linha y={390} style={{ fontFamily: TITULO, fontSize: caber(cena.preco, 250, 8), lineHeight: 1.05, color: COR.acento, opacity: p }}>
        {contarTexto(cena.preco, p)}
      </Linha>
      {cena.conversao ? (
        <Linha y={720} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 62, color: COR.branco }}>
          <Entra atraso={10}>{cena.conversao}</Entra>
        </Linha>
      ) : null}
      {cena.tag ? (
        <Entra atraso={20} style={{ position: "absolute", top: 830, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ border: `4px solid ${COR.branco}`, borderRadius: 50, padding: "8px 40px", fontFamily: TEXTO, fontWeight: 700, fontSize: 46, color: COR.branco }}>
            {cena.tag}
          </div>
        </Entra>
      ) : null}
      <Linha y={960} style={{ fontFamily: TITULO, fontSize: caber(cena.pergunta, 120, 17), color: COR.branco }}>
        <Entra atraso={30}>{cena.pergunta}</Entra>
      </Linha>
      <div style={{ position: "absolute", top: 1170, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 140 }}>
        <Botao tipo="sim" a={b} />
        <Botao tipo="nao" a={b} />
      </div>
    </>
  );
};

export const CenaConteudo: React.FC<{ cena: Cena; jogador: Ficha["jogador"] }> = ({ cena, jogador }) => {
  switch (cena.tipo) {
    case "gancho":
      return <Gancho cena={cena} jogador={jogador} />;
    case "linhaDoTempo":
      return <LinhaDoTempo cena={cena} />;
    case "numero":
      return <Numero cena={cena} />;
    case "barras":
      return <Barras cena={cena} />;
    case "destaque":
      return <Destaque cena={cena} />;
    case "pontoFraco":
      return <PontoFraco cena={cena} />;
    case "veredito":
      return <Veredito cena={cena} />;
  }
};
