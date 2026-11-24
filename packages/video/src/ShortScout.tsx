import "@fontsource/anton";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CenaConteudo } from "./Cenas";
import type { Cena, Ficha, Palavra } from "./schema";
import { duracaoCenaFrames, FINAL_SEG, FPS, tempoDasPalavras } from "./timing";
import { COR, Entra, Linha, TEXTO, TITULO } from "./visual";

export type ShortScoutProps = Ficha;

const VOLUME_MUSICA = 0.12;

/** Fundo fixo do canal: faixa diagonal sutil. */
const Fundo: React.FC = () => (
  <AbsoluteFill style={{ background: COR.fundo }}>
    <svg width={1080} height={1920} style={{ position: "absolute" }}>
      <polygon points="0,1250 1080,1050 1080,1110 0,1310" fill={COR.fundo2} />
    </svg>
  </AbsoluteFill>
);

/** Marca, posição no top 10, tema da semana e barra de progresso. */
const Cabecalho: React.FC<{ ficha: Ficha }> = ({ ficha }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const prog = Math.min(1, f / durationInFrames);
  return (
    <>
      <div style={{ position: "absolute", top: 110, left: 60, display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ background: COR.acento, borderRadius: 12, padding: "4px 22px", fontFamily: TITULO, fontSize: 46, color: COR.fundo }}>
          CABE NO SEU TIME
        </div>
        <div style={{ fontFamily: TITULO, fontSize: 46, color: COR.branco }}>TOP 10 · #{ficha.posicao}</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 190,
          left: 60,
          right: 60,
          fontFamily: TEXTO,
          fontWeight: 600,
          fontSize: 30,
          color: COR.cinza,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {ficha.tema.toUpperCase()}
      </div>
      <div style={{ position: "absolute", top: 240, left: 60, right: 60, height: 6, background: COR.fundo2 }}>
        <div style={{ width: `${prog * 100}%`, height: "100%", background: COR.acento }} />
      </div>
    </>
  );
};

/** Legenda palavra a palavra, em blocos de até 4 palavras, acima da área dos botões do Shorts. */
const Legenda: React.FC<{ texto: string; palavras?: Palavra[]; duracao: number }> = ({ texto, palavras, duracao }) => {
  const frame = useCurrentFrame();
  const tempos = tempoDasPalavras({ narracao: texto, palavras }, duracao);
  if (!tempos.length || frame < tempos[0].inicio - 3) return null;
  const idx = tempos.findIndex((t) => frame >= t.inicio && frame < t.fim);
  const atual = frame >= tempos.at(-1)!.fim ? tempos.length - 1 : Math.max(0, idx);
  const TAM = 4;
  const bloco = Math.floor(atual / TAM);
  const visiveis = tempos.slice(bloco * TAM, bloco * TAM + TAM);
  const pop = interpolate(frame - visiveis[0].inicio, [0, 4], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 1440,
        left: 50,
        right: 50,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 18px",
        transform: `scale(${pop})`,
        fontFamily: TITULO,
        fontSize: 66,
        lineHeight: 1.15,
      }}
    >
      {visiveis.map((t, i) => {
        const ativa = bloco * TAM + i === atual;
        return (
          <span key={i} style={{ color: ativa ? COR.acento : COR.branco, textShadow: "0 4px 0 #000" }}>
            {t.palavra.toUpperCase()}
          </span>
        );
      })}
    </div>
  );
};

const CenaView: React.FC<{ cena: Cena; duracao: number; ficha: Ficha }> = ({ cena, duracao, ficha }) => (
  <AbsoluteFill>
    <CenaConteudo cena={cena} jogador={ficha.jogador} />
    <Legenda texto={cena.narracao} palavras={cena.palavras} duracao={duracao} />
    {cena.audio ? <Audio src={staticFile(cena.audio)} /> : null}
    <Audio src={staticFile("assets/sfx/whoosh.wav")} volume={0.35} />
    {(cena.tipo === "gancho" && cena.alerta) || cena.tipo === "pontoFraco" ? (
      <Sequence from={cena.tipo === "gancho" ? 44 : 0} layout="none">
        <Audio src={staticFile("assets/sfx/pop.wav")} volume={0.5} />
      </Sequence>
    ) : null}
  </AbsoluteFill>
);

/** Cartela final: chama para a playlist da semana. */
const Final: React.FC<{ ficha: Ficha }> = ({ ficha }) => (
  <>
    <Linha y={520} style={{ fontFamily: TITULO, fontSize: 200, color: COR.acento }}>
      <Entra>#{ficha.posicao}</Entra>
    </Linha>
    <Linha y={800} style={{ fontFamily: TITULO, fontSize: 90, color: COR.branco }}>
      <Entra atraso={5}>{ficha.posicao === 1 ? "FECHOU O TOP 10" : "TOP 10 COMPLETO"}</Entra>
    </Linha>
    <Linha y={920} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 52, color: COR.cinza }}>
      <Entra atraso={10}>{ficha.posicao === 1 ? "Qual faltou? Comenta aí" : "na playlist da semana"}</Entra>
    </Linha>
    <Linha y={1060} style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 46, color: COR.acento }}>
      <Entra atraso={16}>Segue o canal · toda segunda tem top 10</Entra>
    </Linha>
  </>
);

export const ShortScout: React.FC<ShortScoutProps> = (ficha) => {
  let inicio = 0;
  const seqs = ficha.cenas.map((cena, i) => {
    const dur = duracaoCenaFrames(cena);
    const el = (
      <Sequence key={i} from={inicio} durationInFrames={dur} name={`${i + 1}. ${cena.tipo}`}>
        <CenaView cena={cena} duracao={dur} ficha={ficha} />
      </Sequence>
    );
    inicio += dur;
    return el;
  });
  const finalDur = Math.round(FINAL_SEG * FPS);
  const total = inicio + finalDur;

  return (
    <AbsoluteFill>
      <Fundo />
      {seqs}
      <Sequence from={inicio} durationInFrames={finalDur} name="Final">
        <Final ficha={ficha} />
        <Audio src={staticFile("assets/sfx/tum-tum.wav")} volume={0.6} />
      </Sequence>
      <Cabecalho ficha={ficha} />
      {ficha.musica !== "nenhuma" ? (
        <Audio
          src={staticFile(`assets/musica/${ficha.musica}.wav`)}
          loop
          volume={(f) =>
            interpolate(f, [0, 10, total - 20, total], [0, VOLUME_MUSICA, VOLUME_MUSICA, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
