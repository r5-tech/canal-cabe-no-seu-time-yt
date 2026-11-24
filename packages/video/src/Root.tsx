import React from "react";
import { Composition } from "remotion";
import exemplo from "../../../fichas/exemplo/2026-w48-01.json";
import { fichaSchema } from "./schema";
import { ShortScout, type ShortScoutProps } from "./ShortScout";
import { ALTURA, duracaoTotalFrames, FPS, LARGURA } from "./timing";

export const RemotionRoot: React.FC = () => (
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
);
