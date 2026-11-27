# Identidade digital — Cabe No Seu Time

Tudo aqui sai do código (`packages/video/src/Identidade.tsx`), com a mesma paleta e as mesmas fontes dos shorts (`visual.tsx`). Mudou cor ou fonte lá, regenere:

```bash
cd packages/video && npm run identidade      # PNGs em identidade/png/ (CHROME_PATH=/usr/bin/google-chrome se precisar)
```

## A marca
Uma escalação 4-3-3 vista de cima com **uma vaga aberta no meio**. A peça verde tracejada é o jogador que cabe ali: é a pergunta do canal em forma de desenho. Funciona sem texto, então aguenta o avatar pequeno do Shorts e a marca d'água.

| Arquivo | Onde usar | Tamanho |
|---|---|---|
| `png/avatar-800.png` | Foto do canal (YouTube) e do perfil (Instagram) | 800×800, seguro para o corte redondo |
| `png/banner-youtube-2560x1440.png` | Banner do YouTube | 2560×1440; texto dentro da área segura de 1546×423 (aparece igual no celular) |
| `png/marca-dagua-150.png` | YouTube Studio → Personalização → Marca d'água do vídeo ("Vídeo inteiro") | 150×150, fundo transparente |
| `png/destaque-*.png` | Capas dos destaques do Instagram: top10, sub20, contratos, europa, veredito | 1080×1920, ícone no círculo central |
| `png/folha-da-marca.png` | Referência rápida de cores e fontes | 1600×1000 |

### Paleta e tipografia
| Nome | Hex | Uso |
|---|---|---|
| fundo | `#0B0F14` | fundo de tudo |
| fundo2 | `#141B24` | faixas, cartões, círculos |
| acento | `#C6FF3D` | a peça que cabe, destaques, palavra ativa da legenda; usar pouco |
| branco | `#F5F7FA` | títulos e textos |
| cinza | `#8C96A5` | apoio, rótulos, os outros 10 da escalação |
| vermelho | `#FF5454` | ponto fraco, alerta |
| amarelo | `#FFC400` | contrato, prazo |

**Anton** em caixa alta para títulos e números; **Inter** 500/600/700 para texto e legenda.

Regras: o verde é só para o que importa (no máximo um destaque por tela); nada de escudo, foto ou logo de clube na marca; o "?" do nome fica sempre no acento.

## Textos do canal

**Nome:** Cabe No Seu Time
**@ sugerido (YouTube e Instagram):** `@cabenoseutime` (alternativas, se estiver tomado: `@cabenoseutime.scout`, `@cabenoseutimeoficial`)

**Descrição do YouTube** (cole em Personalização → Informações básicas):
> Scout de futebol em 60 segundos.
>
> Toda segunda sai um TOP 10: dez jogadores que fogem do óbvio, do #10 ao #1, com números, contexto, o ponto fraco e o veredito. Sub-20 pra ficar de olho, contratos vencendo, brasileiros escondidos na Europa, o melhor da rodada que ninguém viu.
>
> Aqui não tem lista de manchete. Tem a pergunta que todo diretor de futebol deveria fazer: cabe no seu time?
>
> Todo número vem com fonte na descrição do vídeo.
> 📅 Top 10 toda segunda · 08:00 às 21:30
> 💬 Discorda do veredito? Comenta. Tem um nome pra gente analisar? Manda também.

**Bio do Instagram** (até 150 caracteres):
> Scout de futebol em 60s ⚽
> TOP 10 toda segunda: números, ponto fraco e veredito.
> Cabe no seu time? 👇

**Palavras-chave do canal** (YouTube Studio → Configurações → Canal):
`scout, scout de futebol, mercado da bola, futebol brasileiro, brasileirão, série b, sub-20, jovens promessas, fim de contrato, análise de jogadores, top 10 futebol, cabe no seu time`

**Categoria:** Esportes · **Público:** não é conteúdo para crianças · **País:** Brasil

## Tom de voz
- Fala como scout, não como torcedor: número primeiro, opinião depois.
- Sempre mostra o lado ruim (a cena `pontoFraco` existe por isso).
- Fecha com pergunta, nunca com certeza: "cabe no seu time?".
- Sem clickbait que o vídeo não entrega; o gancho é um número real.

## Checklist de configuração (uma vez)
- [ ] YouTube: avatar, banner, marca d'água, descrição, palavras-chave, @.
- [ ] YouTube: seção "Shorts" e a playlist da semana em destaque na página inicial.
- [ ] Instagram: conta Profissional, avatar, bio, @; criar os destaques com as capas de `png/destaque-*`.
- [ ] Mesmo @ nas duas redes; link do YouTube na bio do Instagram e vice-versa.
