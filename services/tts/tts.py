"""
Narração com Kokoro-82M (ONNX, CPU) + tempo de cada palavra.

O modelo ONNX não devolve duração por fonema, então a frase é sintetizada em
trechos (quebrando na pontuação). Cada trecho tem o silêncio das pontas cortado,
o que dá o início/fim exato do trecho; dentro dele as palavras são distribuídas
pelo número de sílabas aproximado. As pausas entre trechos são controladas pela
pontuação, o que também ajuda no timing das piadas.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = Path(os.environ.get("KOKORO_MODEL_DIR", "/models"))
SR = 24000

PAUSAS = {",": 0.16, ";": 0.22, ":": 0.26, ".": 0.38, "!": 0.38, "?": 0.40, "…": 0.55}
VOGAIS = re.compile(r"[aeiouáéíóúâêôãõà]+", re.IGNORECASE)

_kokoro: Kokoro | None = None


def modelo() -> Kokoro:
    global _kokoro
    if _kokoro is None:
        _kokoro = Kokoro(str(MODEL_DIR / "kokoro-v1.0.int8.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))
    return _kokoro


@dataclass
class Palavra:
    palavra: str
    inicio: float
    fim: float


def _trechos(texto: str) -> list[tuple[str, float]]:
    """Quebra o texto em trechos terminados por pontuação e devolve (trecho, pausa_depois)."""
    texto = re.sub(r"\.\.\.", "…", texto.strip())
    partes = re.findall(r"[^,;:.!?…]+[,;:.!?…]*", texto)
    out = []
    for p in partes:
        p = p.strip()
        if not p:
            continue
        fim = p[-1]
        out.append((p, PAUSAS.get(fim, 0.12)))
    return out


def _cortar_silencio(audio: np.ndarray, limiar: float = 0.012) -> np.ndarray:
    energia = np.abs(audio)
    idx = np.where(energia > limiar)[0]
    if len(idx) == 0:
        return audio
    margem = int(0.02 * SR)
    return audio[max(idx[0] - margem, 0) : min(idx[-1] + margem, len(audio))]


def _peso(palavra: str) -> float:
    silabas = len(VOGAIS.findall(palavra)) or 1
    return silabas + 0.3


def _pronuncia(trecho: str) -> str:
    """Ajustes de pronúncia (o espeak lê algumas coisas errado). Só afeta o áudio, não a legenda."""
    t = trecho
    t = re.sub(r"\bpro\b", "pru", t, flags=re.IGNORECASE)
    t = t.replace("Kaique", "Kaíque")
    t = re.sub(r"\bHelo\b", "Helô", t)
    return t


def sintetizar(texto: str, saida: Path, voz: str = "pm_santa", velocidade: float = 1.08) -> dict:
    k = modelo()
    blocos: list[np.ndarray] = []
    palavras: list[Palavra] = []
    t = 0.12  # pequena respiração inicial
    blocos.append(np.zeros(int(t * SR), dtype=np.float32))

    for trecho, pausa in _trechos(texto):
        audio, sr = k.create(_pronuncia(trecho), voice=voz, speed=velocidade, lang="pt-br")
        assert sr == SR
        audio = _cortar_silencio(audio.astype(np.float32))
        dur = len(audio) / SR

        ws = trecho.split()
        pesos = [_peso(w) for w in ws]
        total = sum(pesos)
        acc = 0.0
        for w, p in zip(ws, pesos):
            ini = t + dur * acc / total
            acc += p
            palavras.append(Palavra(w, round(ini, 3), round(t + dur * acc / total, 3)))

        blocos.append(audio)
        blocos.append(np.zeros(int(pausa * SR), dtype=np.float32))
        t += dur + pausa

    final = np.concatenate(blocos)
    pico = float(np.max(np.abs(final))) or 1.0
    final = final / pico * 0.89  # normaliza em ~-1 dBFS
    saida.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(saida), final, SR, subtype="PCM_16")
    return {
        "duracao": round(len(final) / SR, 3),
        "palavras": [p.__dict__ for p in palavras],
    }
