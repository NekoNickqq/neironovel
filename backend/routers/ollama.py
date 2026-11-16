from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ollama_client import ollama_client
from ollama_settings import ollama_settings

router = APIRouter()

class OllamaSettingsRequest(BaseModel):
    mode: Optional[str] = None
    ollama_url: Optional[str] = None
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_local: Optional[str] = None
    model_api: Optional[str] = None

def _mask_key(key: str) -> str:
    if not key: return ""
    if len(key) <= 8: return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]

@router.get("/settings")
async def get_ollama_settings():
    data = ollama_settings.get_all()
    return {"mode": data["mode"], "ollama_url": data["ollama_url"], "api_base_url": data["api_base_url"], "api_key_set": bool(data.get("api_key")), "api_key_masked": _mask_key(data.get("api_key", "")), "model_local": data["model_local"], "model_api": data["model_api"], "active_model": ollama_client.model, "active_url": ollama_client.url}

@router.post("/settings")
async def update_ollama_settings(req: OllamaSettingsRequest):
    values = req.dict(exclude_none=True)
    if not values: raise HTTPException(status_code=400, detail="No settings provided")
    updated = ollama_settings.update(values)
    return {"status": "updated", "mode": updated["mode"], "active_model": ollama_client.model, "active_url": ollama_client.url}

@router.get("/models")
async def list_ollama_models():
    models = await ollama_client.list_models()
    return {"mode": ollama_client.mode, "models": models, "current": ollama_client.model}