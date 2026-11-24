"""
Gera a trilha e os efeitos sonoros do canal de forma procedural.
Tudo é original e sem licença de terceiros, então não há risco de reivindicação de direitos.

Uso: python tools/gerar_sons.py assets/
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
rng = np.random.default_rng(7)


def nota(n: int) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def env(dur, a=0.005, d=0.08, s=0.6, r=0.05):
    n = int(dur * SR)
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[na : na + nd] = np.linspace(1, s, nd)[: max(0, min(nd, n - na))]
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def quadrada(f, dur, duty=0.5):
    t = np.arange(int(dur * SR)) / SR
    return np.where((t * f) % 1 < duty, 1.0, -1.0)


def triangular(f, dur):
    t = np.arange(int(dur * SR)) / SR
    return 2 * np.abs(2 * ((t * f) % 1) - 1) - 1


def ruido(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def mix(base, som, inicio):
    i = int(inicio * SR)
    fim = min(len(base), i + len(som))
    base[i:fim] += som[: fim - i]


def musica_comedia(bpm=124, compassos=16):
    beat = 60 / bpm
    total = compassos * 4 * beat
    out = np.zeros(int(total * SR) + SR)
    # progressão C - Am - F - G (2 compassos cada, repetida)
    acordes = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])]
    melodia = [
        [72, None, 76, 79, 76, None, 72, 74],
        [76, None, 74, 72, 69, None, 72, None],
        [69, None, 72, 77, 76, 74, 72, None],
        [74, None, 71, 74, 79, None, 74, None],
    ]
    for c in range(compassos):
        raiz, acorde = acordes[(c // 2) % 4]
        t0 = c * 4 * beat
        # baixo saltitante
        for b in range(4):
            n = raiz if b % 2 == 0 else raiz + 7
            mix(out, 0.32 * triangular(nota(n), beat * 0.9) * env(beat * 0.9, d=0.1, s=0.5), t0 + b * beat)
        # acorde em arpejo curto nos contratempos
        for b in range(4):
            for k, n in enumerate(acorde):
                mix(out, 0.05 * quadrada(nota(n), beat * 0.25, 0.25) * env(beat * 0.25, s=0.3), t0 + b * beat + beat / 2 + k * 0.02)
        # melodia (só nos compassos pares, para respirar)
        frase = melodia[(c // 2) % 4] if c % 2 == 0 else melodia[(c // 2) % 4][::-1]
        for i, n in enumerate(frase):
            if n is None:
                continue
            d = beat / 2 * 0.9
            mix(out, 0.11 * quadrada(nota(n), d, 0.125) * env(d, d=0.05, s=0.5), t0 + i * beat / 2)
        # bateria: bumbo, caixa (ruído), chimbal
        for b in range(4):
            tb = t0 + b * beat
            if b in (0, 2):
                f = np.linspace(150, 45, int(0.12 * SR))
                mix(out, 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.12, d=0.1, s=0.0, r=0.01), tb)
            else:
                mix(out, 0.16 * ruido(0.1) * env(0.1, d=0.08, s=0.0, r=0.01), tb)
            mix(out, 0.04 * ruido(0.03) * env(0.03, d=0.02, s=0.0, r=0.005), tb + beat / 2)
    out = out[: int(total * SR)]
    return out / np.max(np.abs(out)) * 0.8


def sfx_pop():
    d = 0.12
    f = np.linspace(400, 1400, int(d * SR))
    return 0.8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, d=0.1, s=0.0, r=0.01)


def sfx_whoosh():
    d = 0.45
    n = ruido(d)
    k = np.hanning(int(d * SR))
    # passa-baixa simples e variável
    out = np.convolve(n, np.ones(30) / 30, mode="same") * k
    return out / np.max(np.abs(out)) * 0.6


def sfx_moeda():
    a = quadrada(nota(83), 0.08, 0.5) * env(0.08, s=0.8, r=0.005)
    b = quadrada(nota(88), 0.35, 0.5) * env(0.35, d=0.3, s=0.0)
    return 0.35 * np.concatenate([a, b])


def sfx_boing():
    d = 0.5
    t = np.arange(int(d * SR)) / SR
    f = 220 + 160 * np.sin(2 * np.pi * 9 * t) * np.exp(-5 * t)
    return 0.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, d=0.45, s=0.0)


def sfx_tum_tum():
    out = np.zeros(int(1.0 * SR))
    for i, n in enumerate([50, 43]):
        mix(out, 0.4 * quadrada(nota(n), 0.35, 0.5) * env(0.35, d=0.3, s=0.2), i * 0.4)
    return out


def sfx_risada():
    out = np.zeros(int(0.9 * SR))
    for i in range(5):
        f0 = nota(72 - i)
        mix(out, 0.25 * quadrada(f0, 0.1, 0.3) * env(0.1, s=0.5, r=0.02), i * 0.15)
    return out


def musica_scout(bpm=100, compassos=16):
    """Batida tensa de análise: bumbo, chimbal, baixo em lá menor e um pad baixinho."""
    beat = 60 / bpm
    total = compassos * 4 * beat
    out = np.zeros(int(total * SR) + SR)
    # Am - F - C - G (1 compasso cada)
    baixos = [45, 41, 48, 43]
    pads = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
    for c in range(compassos):
        t0 = c * 4 * beat
        b = baixos[c % 4]
        for i in range(4):
            # bumbo: seno com queda de frequência
            dur = 0.25
            t = np.arange(int(dur * SR)) / SR
            f = 120 * np.exp(-t * 18) + 45
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
            mix(out, 0.55 * kick, t0 + i * beat)
            # clap no 2 e no 4
            if i in (1, 3):
                mix(out, 0.12 * ruido(0.12) * env(0.12, a=0.001, d=0.05, s=0.2, r=0.04), t0 + i * beat)
        for i in range(8):
            mix(out, 0.035 * ruido(0.04) * env(0.04, a=0.001, d=0.02, s=0.1, r=0.01), t0 + i * beat / 2)
            # baixo em colcheias, oitava no contratempo
            n = b if i % 2 == 0 else b + 12
            mix(out, 0.16 * triangular(nota(n), beat / 2 * 0.9) * env(beat / 2 * 0.9, s=0.7, r=0.03), t0 + i * beat / 2)
        for n in pads[c % 4]:
            mix(out, 0.025 * quadrada(nota(n), 4 * beat, 0.25) * env(4 * beat, a=0.3, s=0.8, r=0.4), t0)
    out = out[: int(total * SR)]
    return 0.9 * out / max(1e-9, np.max(np.abs(out)))


if __name__ == "__main__":
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "assets")
    (dest / "musica").mkdir(parents=True, exist_ok=True)
    (dest / "sfx").mkdir(parents=True, exist_ok=True)
    sf.write(dest / "musica" / "scout-01.wav", musica_scout(), SR, subtype="PCM_16")
    for nome, fn in {"pop": sfx_pop, "whoosh": sfx_whoosh, "tum-tum": sfx_tum_tum}.items():
        sf.write(dest / "sfx" / f"{nome}.wav", fn(), SR, subtype="PCM_16")
    print("ok:", dest)
