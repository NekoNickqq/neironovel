import uuid
import os
import sys
import time
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from config import config
from database import init_db, get_db, Dialogue, DialogueSettings, Message
from ollama_client import ollama_client
from ollama_settings import ollama_settings
from comfyui_client import comfyui_client
from utils import build_system_prompt

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("✅ Database initialized")
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

# ============ Helper для отмены генерации ============
async def _run_with_cancel_check(request: Request, coro) -> any:
    """Запускает корутину, но отменяет её, если HTTP-клиент отключился."""
    gen_task = asyncio.create_task(coro)
    try:
        while True:
            done, _ = await asyncio.wait([gen_task], timeout=0.4)
            if done:
                return gen_task.result()
            if await request.is_disconnected():
                print("🛑 Client disconnected, cancelling generation...")
                gen_task.cancel()
                try:
                    await gen_task
                except asyncio.CancelledError:
                    pass
                raise asyncio.CancelledError()
    except asyncio.CancelledError:
        if not gen_task.done():
            gen_task.cancel()
        raise

# ============ Pydantic модели ============
class CreateDialogueRequest(BaseModel):
    title: str
    description: str = ""
    world_lore: str = ""
    character_cards: list = []
    style_preset: str = "dark fantasy, cinematic lighting, masterpiece, best quality, 8k"
    ai_controls_user: bool = False

class SendMessageRequest(BaseModel):
    dialogue_id: str
    user_text: str
    generate_image: bool = True
    model: Optional[str] = None

class RegenerateRequest(BaseModel):
    dialogue_id: str
    message_id: str
    model: Optional[str] = None
    mode: Optional[str] = "same"

class OllamaSettingsRequest(BaseModel):
    mode: Optional[str] = None
    ollama_url: Optional[str] = None
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_local: Optional[str] = None
    model_api: Optional[str] = None

class UpdateDialogueSettingsRequest(BaseModel):
    world_lore: Optional[str] = None
    character_cards: Optional[list] = None
    style_preset: Optional[str] = None

# ============ Эндпоинты ============
@app.get("/health")
async def health_check():
    ollama_ok = await ollama_client.is_available()
    comfyui_ok = await comfyui_client.is_available()
    return {"status": "ok", "services": {"ollama": ollama_ok, "comfyui": comfyui_ok}}

def _mask_key(key: str) -> str:
    if not key: return ""
    if len(key) <= 8: return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]

@app.get("/ollama/settings")
async def get_ollama_settings():
    data = ollama_settings.get_all()
    return {
        "mode": data["mode"], "ollama_url": data["ollama_url"], "api_base_url": data["api_base_url"],
        "api_key_set": bool(data.get("api_key")), "api_key_masked": _mask_key(data.get("api_key", "")),
        "model_local": data["model_local"], "model_api": data["model_api"],
        "active_model": ollama_client.model, "active_url": ollama_client.url,
    }

@app.post("/ollama/settings")
async def update_ollama_settings(req: OllamaSettingsRequest):
    values = req.dict(exclude_none=True)
    if not values: raise HTTPException(status_code=400, detail="No settings provided")
    updated = ollama_settings.update(values)
    return {"status": "updated", "mode": updated["mode"], "active_model": ollama_client.model, "active_url": ollama_client.url}

@app.get("/ollama/models")
async def list_ollama_models():
    models = await ollama_client.list_models()
    return {"mode": ollama_client.mode, "models": models, "current": ollama_client.model}

@app.get("/dialogues")
async def list_dialogues(db: Session = Depends(get_db)):
    dialogues = db.query(Dialogue).order_by(Dialogue.created_at.desc()).all()
    return [
        {
            "id": d.id, "title": d.title, "description": d.settings.world_lore[:100] if d.settings else "",
            "message_count": len(d.messages), "character_count": len(d.settings.character_cards) if d.settings else 0,
            "style_preset": d.settings.style_preset if d.settings else "", "created_at": d.created_at.isoformat()
        } for d in dialogues
    ]

@app.post("/dialogues")
async def create_dialogue(req: CreateDialogueRequest, db: Session = Depends(get_db)):
    dialogue_id = str(uuid.uuid4())
    dialogue = Dialogue(id=dialogue_id, title=req.title, created_at=datetime.utcnow())
    settings = DialogueSettings(
        dialogue_id=dialogue_id, world_lore=req.world_lore, character_cards=req.character_cards,
        style_preset=req.style_preset, ai_controls_user=req.ai_controls_user
    )
    db.add(dialogue)
    db.add(settings)
    db.commit()
    return {"dialogue_id": dialogue_id, "status": "created"}

@app.patch("/dialogues/{dialogue_id}/settings")
async def update_dialogue_settings(dialogue_id: str, req: UpdateDialogueSettingsRequest, db: Session = Depends(get_db)):
    settings = db.query(DialogueSettings).filter(DialogueSettings.dialogue_id == dialogue_id).first()
    if not settings: raise HTTPException(status_code=404, detail="Settings not found")
    if req.world_lore is not None: settings.world_lore = req.world_lore
    if req.character_cards is not None: settings.character_cards = req.character_cards
    if req.style_preset is not None: settings.style_preset = req.style_preset
    db.commit()
    return {"status": "updated"}

@app.get("/dialogues/{dialogue_id}")
async def get_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    messages = []
    for m in dialogue.messages:
        messages.append({
            "id": m.id, "dialogue_id": m.dialogue_id, "role": m.role, "blocks": m.content,
            "image_path": m.image_path, "image_variants": m.image_variants,
            "selected_image_index": m.selected_image_index, "has_image": m.has_image,
            "image_prompt": m.image_prompt, "debug_info": m.debug_info,
            "text_versions": m.text_versions, "selected_version_index": m.selected_version_index,
            "original_user_text": m.original_user_text, "parent_id": m.parent_id, "created_at": m.created_at.isoformat()
        })
    return {
        "id": dialogue.id, "title": dialogue.title,
        "settings": {
            "world_lore": dialogue.settings.world_lore if dialogue.settings else "",
            "character_cards": dialogue.settings.character_cards if dialogue.settings else [],
            "style_preset": dialogue.settings.style_preset if dialogue.settings else "",
            "font_config": dialogue.settings.font_config if dialogue.settings else {},
            "ai_controls_user": dialogue.settings.ai_controls_user if dialogue.settings else False
        },
        "messages": messages, "created_at": dialogue.created_at.isoformat()
    }

@app.delete("/dialogues/{dialogue_id}")
async def delete_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    db.delete(dialogue)
    db.commit()
    return {"status": "deleted"}

@app.post("/message")
async def send_message(req: SendMessageRequest, request: Request, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    
    user_msg_id = str(uuid.uuid4())
    last_msg = dialogue.messages[-1] if dialogue.messages else None
    
    user_message = Message(
        id=user_msg_id, dialogue_id=req.dialogue_id, role="user",
        content=[{"speaker": "user", "text": req.user_text}],
        has_image=False, parent_id=last_msg.id if last_msg else None, created_at=datetime.utcnow()
    )
    db.add(user_message)
    db.commit()
    
    history = []
    for m in dialogue.messages:
        if m.role == "user": history.append({"role": "user", "content": m.content[0]["text"] if m.content else ""})
        elif m.role == "assistant": history.append({"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])})
    
    system_prompt = build_system_prompt(
        dialogue.settings.world_lore if dialogue.settings else "",
        dialogue.settings.character_cards if dialogue.settings else [],
        dialogue.settings.style_preset if dialogue.settings else "",
        dialogue.settings.ai_controls_user if dialogue.settings else False
    )
    
    # Создаем пустое сообщение заранее
    assistant_msg_id = str(uuid.uuid4())
    assistant_message = Message(
        id=assistant_msg_id, dialogue_id=req.dialogue_id, role="assistant",
        content=[{"speaker": "narrator", "text": "*Генерация...*"}],
        image_path=None, image_variants=[], selected_image_index=0, has_image=False,
        image_prompt="", debug_info={"status": "generating"}, text_versions=[],
        selected_version_index=0, parent_id=user_msg_id, created_at=datetime.utcnow()
    )
    db.add(assistant_message)
    db.commit()

    # ИСПРАВЛЕНИЕ: заполняем debug_info с system_prompt и history сразу
    debug_info = {
        "status": "generating",
        "system_prompt": system_prompt,
        "history_sent": history,
        "model": req.model or ollama_client.model,
        "timings_ms": {},
    }

    try:
        # === Ollama (с возможностью отмены) ===
        t0 = time.perf_counter()
        ollama_res = await _run_with_cancel_check(
            request,
            ollama_client.chat(history, system_prompt, model=req.model)
        )
        ai_response = ollama_res["parsed"]
        debug_info["timings_ms"]["ollama"] = round((time.perf_counter() - t0) * 1000)
        debug_info["raw_response"] = ollama_res.get("raw", "")
        debug_info["thinking"] = ollama_res.get("thinking", "")

        # === ComfyUI (с возможностью отмены) ===
        image_path = None
        has_image = False
        image_variants = []
        image_prompt = (ai_response.get("image_prompt") or "").strip()
        prompt_source = "model"
        comfy_info = {}

        if req.generate_image:
            if not image_prompt:
                scene_text = " ".join(b.get("text", "") for b in ai_response.get("blocks", [])).strip() or req.user_text
                style_preset = dialogue.settings.style_preset if dialogue.settings else ""
                image_prompt = f"{scene_text[:400]}, {style_preset}".strip(", ")
                prompt_source = "fallback"

            t1 = time.perf_counter()
            comfy_res = await _run_with_cancel_check(
                request,
                comfyui_client.generate_image(image_prompt)
            )
            image_path = comfy_res["image_path"]
            comfy_info = {"prompt_id": comfy_res["prompt_id"], "seed": comfy_res["seed"]}
            has_image = True
            image_variants = [image_path]
            debug_info["timings_ms"]["comfyui"] = round((time.perf_counter() - t1) * 1000)

        # Успешно завершено
        debug_info["status"] = "success"
        debug_info["image_prompt_used"] = image_prompt
        debug_info["image_prompt_source"] = prompt_source
        debug_info["comfyui_info"] = comfy_info

        assistant_message.content = ai_response.get("blocks", [])
        assistant_message.image_path = image_path
        assistant_message.image_variants = image_variants
        assistant_message.has_image = has_image
        assistant_message.image_prompt = image_prompt
        # ВАЖНО: dict(...) вместо прямой ссылки, чтобы SQLAlchemy увидел изменение JSON-колонки
        assistant_message.debug_info = dict(debug_info)

    except asyncio.CancelledError:
        debug_info["status"] = "aborted_by_user"
        assistant_message.content = [{"speaker": "narrator", "text": "*Генерация прервана пользователем.*"}]
        assistant_message.debug_info = dict(debug_info)
        await comfyui_client.interrupt()
    except Exception as e:
        debug_info["status"] = "error"
        debug_info["error_message"] = str(e)
        assistant_message.content = [{"speaker": "narrator", "text": f"*Ошибка генерации: {str(e)}*"}]
        assistant_message.debug_info = dict(debug_info)
        await comfyui_client.interrupt()
    finally:
        db.commit()
    
    return {
        "user_message_id": user_msg_id,
        "assistant_message_id": assistant_msg_id,
        "ai_text": assistant_message.content,
        "has_image": assistant_message.has_image,
        "image_path": assistant_message.image_path
    }

@app.post("/regenerate/text")
async def regenerate_text(req: RegenerateRequest, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req.message_id).first()
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not message or not dialogue: raise HTTPException(status_code=404, detail="Not found")
    
    history = []
    for m in dialogue.messages:
        if m.id == req.message_id: break
        if m.role == "user": history.append({"role": "user", "content": m.content[0]["text"] if m.content else ""})
        elif m.role == "assistant": history.append({"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])})
    
    last_user_msg = next((m for m in reversed(dialogue.messages) if m.role == "user" and m.id != req.message_id), None)
    if last_user_msg: history.append({"role": "user", "content": last_user_msg.content[0]["text"] if last_user_msg.content else ""})
    
    system_prompt = build_system_prompt(
        dialogue.settings.world_lore, dialogue.settings.character_cards,
        dialogue.settings.style_preset, dialogue.settings.ai_controls_user
    )
    
    try:
        ollama_res = await ollama_client.chat(history, system_prompt, model=req.model)
        ai_response = ollama_res["parsed"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
    
    new_blocks = ai_response.get("blocks", [])
    text_versions = message.text_versions or []
    text_versions.append(new_blocks)
    
    message.text_versions = text_versions
    message.selected_version_index = len(text_versions)
    db.commit()
    
    return {"message_id": message.id, "new_blocks": new_blocks, "version_count": len(text_versions) + 1}

@app.post("/regenerate/image")
async def regenerate_image(req: RegenerateRequest, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req.message_id).first()
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not message or not dialogue: raise HTTPException(status_code=404, detail="Not found")
    
    image_prompt = message.image_prompt
    if req.mode == "new" or not image_prompt:
        history = []
        for m in dialogue.messages:
            if m.id == req.message_id: break
            if m.role == "user": history.append({"role": "user", "content": m.content[0]["text"] if m.content else ""})
            elif m.role == "assistant": history.append({"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])})
        
        system_prompt = build_system_prompt(
            dialogue.settings.world_lore, dialogue.settings.character_cards,
            dialogue.settings.style_preset, dialogue.settings.ai_controls_user
        ) + "\n\nОтвечай ТОЛЬКО полем image_prompt, без blocks. Формат: {\"image_prompt\": \"...\"}"
        
        try:
            ollama_res = await ollama_client.chat(history, system_prompt, model=req.model)
            image_prompt = ollama_res["parsed"].get("image_prompt", "")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
        
        if not image_prompt: raise HTTPException(status_code=400, detail="No image prompt generated")
        message.image_prompt = image_prompt
    
    try:
        comfy_res = await comfyui_client.generate_image(image_prompt)
        new_image_path = comfy_res["image_path"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ComfyUI error: {str(e)}")
    
    image_variants = message.image_variants or []
    image_variants.append(new_image_path)
    
    message.image_variants = image_variants
    message.selected_image_index = len(image_variants) - 1
    message.has_image = True
    message.image_path = new_image_path
    db.commit()
    
    return {"message_id": message.id, "new_image_path": new_image_path, "variant_count": len(image_variants), "prompt_source": "new" if req.mode == "new" else "same"}

@app.post("/select/image")
async def select_image(req: dict, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message: raise HTTPException(status_code=404, detail="Not found")
    message.selected_image_index = req["index"]
    db.commit()
    return {"status": "ok"}

@app.post("/select/version")
async def select_version(req: dict, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message: raise HTTPException(status_code=404, detail="Not found")
    message.selected_version_index = req["index"]
    db.commit()
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)