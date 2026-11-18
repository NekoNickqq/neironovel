import os
import sys
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"): sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from config import config
from database import init_db
from ollama_client import ollama_client
from comfyui_client import comfyui_client

from logger import log_queue

# Импорт роутеров
from routers import catalog, dialogues, ollama

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    
    paths = [
        config.GALLERY_PATH,
        config.GALLERY_CARDS_WORLDS,
        config.GALLERY_CARDS_CHARACTERS,
        config.GALLERY_NARRATIVE,
        config.GALLERY_AVATARS,
        config.AVATARS_PATH
    ]
    for path in paths:
        os.makedirs(path, exist_ok=True)
        
    print("✅ Database and Folders initialized")
    yield
    print("👋 Shutting down...")

app = FastAPI(title="RP Novel Engine API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(config.GALLERY_PATH, exist_ok=True)
os.makedirs(config.AVATARS_PATH, exist_ok=True)
app.mount("/gallery", StaticFiles(directory=config.GALLERY_PATH), name="gallery")
app.mount("/avatars", StaticFiles(directory=config.AVATARS_PATH), name="avatars")

# --- Системные эндпоинты ---

@app.get("/health")
async def health_check():
    ollama_ok = await ollama_client.is_available()
    comfyui_ok = await comfyui_client.is_available()
    return {"status": "ok", "services": {"ollama": ollama_ok, "comfyui": comfyui_ok}}

@app.get("/logs/stream")
async def stream_logs():
    async def event_generator():
        while True:
            log = await log_queue.get()
            yield f"data: {json.dumps(log, ensure_ascii=False)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- ПОДКЛЮЧАЕМ РОУТЕРЫ (СОХРАНЯЯ СТАРЫЕ ПУТИ) ---
# ВАЖНО: диалоги подключаем ДО «корневого» catalog-роутера, иначе generic-роут
# /{card_type}/{card_id} перехватывает DELETE /dialogues/{id}
app.include_router(dialogues.router, tags=["Dialogues"])

app.include_router(catalog.router, prefix="/catalog", tags=["Catalog"])
# Дублируем /generate_negative для совместимости со старым фронтом (он в корне)
app.include_router(catalog.router, prefix="", include_in_schema=False, tags=["Catalog"])

app.include_router(ollama.router, prefix="/ollama", tags=["Ollama"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)