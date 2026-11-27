import React from "react";
import { Composition, Still } from "remotion";
import exemplo from "../../../fichas/exemplo/2026-w48-01.json";
import { Avatar, Banner, CapaDestaque, DESTAQUES, type Destaque, FolhaMarca, MarcaDagua } from "./Identidade";
import { fichaSchema } from "./schema";
import { ShortScout, type ShortScoutProps } from "./ShortScout";
import { ALTURA, duracaoTotalFrames, FPS, LARGURA } from "./timing";

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="ShortScout"
    component={ShortScout}
    schema={fichaSchema}
    defaultProps={fichaSchema.parse(exemplo) as ShortScoutProps}
    fps={FPS}
    width={LARGURA}
    height={ALTURA}
    durationInFrames={300}
    calculateMetadata={({ props }) => {
      const f = fichaSchema.parse(props);
      return { durationInFrames: duracaoTotalFrames(f), props: f };
    }}
  />
  {/* identidade digital: node scripts/identidade.mjs */}
  <Still id="Avatar" component={Avatar} width={800} height={800} />
  <Still id="Banner" component={Banner} width={2560} height={1440} />
  <Still id="MarcaDagua" component={MarcaDagua} width={150} height={150} />
  <Still id="FolhaMarca" component={FolhaMarca} width={1600} height={1000} />
  {(Object.keys(DESTAQUES) as Destaque[]).map((t) => (
    <Still key={t} id={`Destaque-${t}`} component={CapaDestaque} defaultProps={{ tipo: t }} width={1080} height={1920} />
  ))}
  </>
);
