"""API de voz. POST /sintetizar -> grava o wav em DATA_DIR e devolve duração + palavras."""
import hashlib
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from tts import modelo, sintetizar

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data/public")).resolve()
VOZES = {"pm_santa", "pm_alex", "pf_dora"}

# muda sempre que tts.py muda (ex.: ajuste de pronúncia), para invalidar o cache do preparar
VERSAO = hashlib.sha1((Path(__file__).parent / "tts.py").read_bytes()).hexdigest()[:10]

app = FastAPI(title="cabe-tts")


class Pedido(BaseModel):
    texto: str = Field(min_length=1)
    arquivo: str = Field(description="caminho relativo dentro de DATA_DIR, ex: audio/ep-001/cena-01.wav")
    voz: str = "pm_santa"
    velocidade: float = Field(1.08, ge=0.7, le=1.5)


@app.on_event("startup")
def carregar():
    modelo()


@app.get("/saude")
def saude():
    return {"ok": True, "versao": VERSAO}


@app.post("/sintetizar")
def post_sintetizar(p: Pedido):
    if p.voz not in VOZES:
        raise HTTPException(400, f"voz inválida: {p.voz}")
    destino = (DATA_DIR / p.arquivo).resolve()
    if DATA_DIR not in destino.parents:
        raise HTTPException(400, "caminho fora de DATA_DIR")
    r = sintetizar(p.texto, destino, p.voz, p.velocidade)
    return {"arquivo": p.arquivo, "versao": VERSAO, **r}
