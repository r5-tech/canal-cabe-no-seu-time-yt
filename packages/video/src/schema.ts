import { z } from "zod";

export const VOZES = ["pm_alex", "pm_santa", "pf_dora"] as const;
export const MUSICAS = ["scout-01", "nenhuma"] as const;

export const palavraSchema = z.object({ palavra: z.string(), inicio: z.number(), fim: z.number() });

/** Campos comuns a toda cena: a narração manda na duração. */
const base = {
  narracao: z.string().min(1),
  /** duração forçada em segundos (opcional; senão vem do áudio ou da estimativa) */
  duracao: z.number().optional(),
  /** preenchidos pelo preparar.mjs (voz Kokoro) */
  audio: z.string().optional(),
  duracaoAudio: z.number().optional(),
  palavras: z.array(palavraSchema).optional(),
};

/** Abertura: número grande que conta do zero, rótulo e um alerta em faixa vermelha. */
const gancho = z.object({
  tipo: z.literal("gancho"),
  numero: z.string().max(8),
  rotulo: z.string().max(28),
  sub: z.string().max(28).optional(),
  alerta: z.string().max(40).optional(),
  ...base,
});

/** Até 4 marcos na carreira (ano + duas linhas). */
const linhaDoTempo = z.object({
  tipo: z.literal("linhaDoTempo"),
  titulo: z.string().max(22).default("A HISTÓRIA"),
  itens: z
    .array(
      z.object({
        ano: z.string().max(6),
        linha1: z.string().max(28),
        linha2: z.string().max(30).optional(),
        destaque: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(4),
  ...base,
});

/** Um número que conta até o valor (gols, assistências, desarmes...). */
const numero = z.object({
  tipo: z.literal("numero"),
  valor: z.number(),
  decimais: z.number().int().min(0).max(2).default(0),
  prefixo: z.string().max(4).default(""),
  sufixo: z.string().max(4).default(""),
  rotulo: z.string().max(22),
  sub: z.string().max(34).optional(),
  ...base,
});

/** Comparação em barras horizontais (ex.: xG+xA contra os outros da liga). */
const barras = z.object({
  tipo: z.literal("barras"),
  titulo: z.string().max(18),
  sub: z.string().max(30).optional(),
  decimais: z.number().int().min(0).max(2).default(2),
  barras: z
    .array(z.object({ nome: z.string().max(22), valor: z.number(), destaque: z.boolean().default(false) }))
    .min(2)
    .max(5),
  ...base,
});

/** Curiosidade/detalhe: um texto grande no meio com contexto embaixo. */
const destaque = z.object({
  tipo: z.literal("destaque"),
  topo: z.string().max(30).optional(),
  grande: z.string().max(10),
  linha: z.string().max(30),
  nota: z.string().max(34).optional(),
  alerta: z.string().max(34).optional(),
  ...base,
});

/** O lado ruim: toda ficha precisa de um, é o que dá credibilidade ao canal. */
const pontoFraco = z.object({
  tipo: z.literal("pontoFraco"),
  titulo: z.string().max(20).default("O PONTO FRACO"),
  itens: z.array(z.string().max(30)).min(1).max(3),
  ...base,
});

/** Fechamento: preço, contexto e a pergunta com ✅/❌. */
const veredito = z.object({
  tipo: z.literal("veredito"),
  topo: z.string().max(26),
  preco: z.string().max(10),
  conversao: z.string().max(26).optional(),
  tag: z.string().max(26).optional(),
  pergunta: z.string().max(20).default("CABE NO SEU TIME?"),
  ...base,
});

export const cenaSchema = z.discriminatedUnion("tipo", [gancho, linhaDoTempo, numero, barras, destaque, pontoFraco, veredito]);

export const fichaSchema = z
  .object({
    /** ex.: 2026-w48-07 */
    id: z.string().regex(/^\d{4}-w\d{2}-\d{2}$/),
    /** semana ISO do lançamento, ex.: 2026-w48 */
    semana: z.string().regex(/^\d{4}-w\d{2}$/),
    /** colocação no top 10 (o #10 abre, o #1 fecha) */
    posicao: z.number().int().min(1).max(10),
    /** título da série da semana, ex.: "Barganhas de fim de contrato" */
    tema: z.string().max(40),
    jogador: z.object({
      nome: z.string(),
      clube: z.string(),
      posicao: z.string(),
      idade: z.number().int().optional(),
    }),
    voz: z.enum(VOZES).default("pm_alex"),
    velocidade: z.number().default(1.15),
    musica: z.enum(MUSICAS).default("scout-01"),
    cenas: z.array(cenaSchema).min(3).max(8),
    /** obrigatório: todo número do vídeo precisa de fonte */
    fontes: z.array(z.object({ titulo: z.string(), url: z.string().url() })).min(1),
    youtube: z
      .object({ titulo: z.string().optional(), descricao: z.string().optional(), tags: z.array(z.string()).optional() })
      .optional(),
  })
  .superRefine((f, ctx) => {
    if (!f.id.startsWith(f.semana)) ctx.addIssue({ code: "custom", message: "id precisa começar pela semana" });
    if (f.cenas[0].tipo !== "gancho") ctx.addIssue({ code: "custom", message: "a primeira cena precisa ser o gancho" });
    if (f.cenas.at(-1)!.tipo !== "veredito") ctx.addIssue({ code: "custom", message: "a última cena precisa ser o veredito" });
    if (!f.cenas.some((c) => c.tipo === "pontoFraco")) ctx.addIssue({ code: "custom", message: "falta a cena de ponto fraco" });
  });

export type Ficha = z.infer<typeof fichaSchema>;
export type Cena = z.infer<typeof cenaSchema>;
export type Palavra = z.infer<typeof palavraSchema>;
