import uuid
import os
import re
import sys
import time
import json
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional
from utils import extract_json_from_text
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
import shutil

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from config import config
from database import init_db, get_db, Dialogue, DialogueSettings, Message, WorldCard, CharacterCard
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

# --- СИСТЕМА ЛОГОВ ДЛЯ ТЕРМИНАЛА ---
log_queue = asyncio.Queue()

async def log_event(event_type: str, data: dict):
    """Отправляет лог в SSE очередь"""
    await log_queue.put({"type": event_type, "data": data, "timestamp": datetime.utcnow().isoformat()})

@app.get("/logs/stream")
async def stream_logs():
    async def event_generator():
        while True:
            log = await log_queue.get()
            yield f"data: {json.dumps(log, ensure_ascii=False)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

async def _run_with_cancel_check(request: Request, coro) -> any:
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
    world_data: dict = {}
    character_cards: list = []
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
    world_data: Optional[dict] = None
    character_cards: Optional[list] = None
    ai_controls_user: Optional[bool] = None

class GenerateNegativeRequest(BaseModel):
    type: str # "world" | "character"
    data: dict

class GenerateCardImageRequest(BaseModel):
    type: str # "world" | "character"
    prompt: str
    negative_prompt: str = ""

class UpdateImagesRequest(BaseModel):
    image_variants: list
    selected_image_index: int

class WorldCardSchema(BaseModel):
    id: Optional[str] = None
    name: str
    history: str
    features: str
    appearance: str
    negative_prompt: str
    image_variants: list = []
    selected_image_index: int = 0

class CharacterCardSchema(BaseModel):
    id: Optional[str] = None
    name: str
    appearance: str
    personality: str
    features: str = ""
    negative_appearance: str
    negative_personality: str
    image_variants: list = []
    selected_image_index: int = 0

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

# --- КАТАЛОГ ---

@app.get("/catalog/worlds")
async def list_worlds(db: Session = Depends(get_db)):
    worlds = db.query(WorldCard).all()
    return [
        {
            "id": w.id, "name": w.name, "history": w.history, "features": w.features, 
            "appearance": w.appearance, "negative_prompt": w.negative_prompt, 
            "image_variants": w.image_variants, "selected_image_index": w.selected_image_index
        } for w in worlds
    ]

@app.post("/catalog/worlds")
async def create_world(req: WorldCardSchema, db: Session = Depends(get_db)):
    w = WorldCard(id=str(uuid.uuid4()), **req.dict(exclude={"id"}))
    db.add(w)
    db.commit()
    return {"id": w.id}

@app.get("/catalog/characters")
async def list_chars(db: Session = Depends(get_db)):
    chars = db.query(CharacterCard).all()
    return [
        {
            "id": c.id, "name": c.name, "appearance": c.appearance, "personality": c.personality, 
            "features": c.features, "negative_appearance": c.negative_appearance, 
            "negative_personality": c.negative_personality,
            "image_variants": c.image_variants, "selected_image_index": c.selected_image_index
        } for c in chars
    ]

@app.post("/catalog/characters")
async def create_char(req: CharacterCardSchema, db: Session = Depends(get_db)):
    c = CharacterCard(id=str(uuid.uuid4()), **req.dict(exclude={"id"}))
    db.add(c)
    db.commit()
    return {"id": c.id}

@app.patch("/catalog/{card_type}/{card_id}/images")
async def update_card_images(card_type: str, card_id: str, req: UpdateImagesRequest, db: Session = Depends(get_db)):
    if card_type == "world":
        card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    else:
        card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
        
    if not card: raise HTTPException(404, "Card not found")
    
    card.image_variants = req.image_variants
    card.selected_image_index = req.selected_image_index
    db.commit()
    return {"status": "updated"}

@app.delete("/catalog/{card_type}/{card_id}")
async def delete_card(card_type: str, card_id: str, db: Session = Depends(get_db)):
    if card_type == "world":
        card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    else:
        card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
        
    if not card: raise HTTPException(404, "Card not found")
    
    db.delete(card)
    db.commit()
    return {"status": "deleted"}

@app.post("/generate_negative")
async def generate_negative(req: GenerateNegativeRequest):
    try:
        if req.type == "world":
            prompt = f"Create a short comma-separated list of negative visual tags in English for a world. World: {req.data.get('name')}. Description: {req.data.get('history')}. Output ONLY the tags."
            
            res = await ollama_client.chat([{"role": "user", "content": prompt}], "You are a machine. Output ONLY comma-separated tags. No conversation.", temperature=0.1)
            raw = res.get("raw", "")
            
            if raw.strip().startswith('{'):
                try:
                    parsed = extract_json_from_text(raw)
                    raw = str(list(parsed.values())[0]) if parsed else raw
                except: pass
                    
            text = re.sub(r'[^a-zA-Z0-9,\s]', '', raw)
            tags = [t.strip() for t in text.split(',') if t.strip()]
            unique_tags = list(dict.fromkeys(tags))
            return {"negative": ", ".join(unique_tags)}
            
        else:
            prompt = f"""Create negative tags in English for a character. 
Name: {req.data.get('name')}. Appearance: {req.data.get('appearance')}. Personality: {req.data.get('personality')}. 
Return a JSON object with exactly two keys: "negative_appearance" and "negative_personality". 
Example: {{"negative_appearance": "old, short", "negative_personality": "dull"}}"""
            
            res = await ollama_client.chat([{"role": "user", "content": prompt}], "Output ONLY valid JSON.", temperature=0.1)
            raw = res.get("raw", "")
            data = extract_json_from_text(raw)
            
            neg_app = data.get("negative_appearance") or ""
            neg_pers = data.get("negative_personality") or ""
            
            if not neg_app and not neg_pers:
                text = re.sub(r'[^a-zA-Z0-9,\s]', '', raw)
                return {"negative_appearance": text, "negative_personality": text}
                
            neg_app = re.sub(r'[^a-zA-Z0-9,\s]', '', str(neg_app))
            neg_pers = re.sub(r'[^a-zA-Z0-9,\s]', '', str(neg_pers))
            
            return {"negative_appearance": neg_app, "negative_personality": neg_pers}
    except Exception as e:
        # ЗАЩИТНЫЙ МЕХАНИЗМ (Fallback): если Оллама упала или зациклилась
        print(f"⚠️ Ошибка генерации негатива: {e}")
        base_neg = "ugly, blurry, low quality, deformed, worst quality, low resolution, watermark, text, signature, sketch"
        if req.type == "world":
            return {"negative": base_neg + ", human, character, person"}
        else:
            return {"negative_appearance": base_neg + ", bad anatomy", "negative_personality": "dull, boring, passive"}

@app.post("/catalog/upload_image")
async def upload_image(file: UploadFile = File(...)):
    file_ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_ext}"
    filepath = os.path.join(config.AVATARS_PATH, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"image_path": f"/avatars/{filename}"}

@app.post("/catalog/generate_image")
async def generate_card_image(req: GenerateCardImageRequest):
    try:
        clean_negative_words = ["ugly", "blurry", "low quality", "deformed", "bad anatomy", "worst quality", "sketch"]
        tags = [t.strip() for t in req.prompt.split(',') if t.strip()]
        
        clean_tags = []
        for tag in tags:
            if not any(bad_word in tag.lower() for bad_word in clean_negative_words):
                clean_tags.append(tag)
                
        final_prompt = ", ".join(clean_tags)

        if req.type == "world":
            res = await comfyui_client.generate_image(final_prompt, req.negative_prompt, width=1280, height=720)
        else:
            res = await comfyui_client.generate_image(final_prompt, req.negative_prompt, width=720, height=1680)
            
        return {"image_path": res["image_path"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ДИАЛОГИ ---

@app.get("/dialogues")
async def list_dialogues(db: Session = Depends(get_db)):
    dialogues = db.query(Dialogue).order_by(Dialogue.created_at.desc()).all()
    return [
        {
            "id": d.id, "title": d.title, "description": d.settings.world_data.get("name", "") if d.settings else "",
            "message_count": len(d.messages), "character_count": len(d.settings.character_cards) if d.settings else 0,
            "created_at": d.created_at.isoformat()
        } for d in dialogues
    ]

@app.post("/dialogues")
async def create_dialogue(req: CreateDialogueRequest, db: Session = Depends(get_db)):
    dialogue_id = str(uuid.uuid4())
    dialogue = Dialogue(id=dialogue_id, title=req.title, created_at=datetime.utcnow())
    settings = DialogueSettings(
        dialogue_id=dialogue_id, 
        world_data=req.world_data, 
        character_cards=req.character_cards, 
        ai_controls_user=req.ai_controls_user
    )
    db.add(dialogue)
    db.add(settings)
    db.commit()
    return {"dialogue_id": dialogue_id, "status": "created"}

@app.patch("/dialogues/{dialogue_id}/settings")
async def update_dialogue_settings(dialogue_id: str, req: UpdateDialogueSettingsRequest, db: Session = Depends(get_db)):
    settings = db.query(DialogueSettings).filter(DialogueSettings.dialogue_id == dialogue_id).first()
    if not settings: raise HTTPException(status_code=404, detail="Settings not found")
    if req.world_data is not None: settings.world_data = req.world_data
    if req.character_cards is not None: settings.character_cards = req.character_cards
    if req.ai_controls_user is not None: settings.ai_controls_user = req.ai_controls_user
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
            "world_data": dialogue.settings.world_data if dialogue.settings else {},
            "character_cards": dialogue.settings.character_cards if dialogue.settings else [],
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

# --- СООБЩЕНИЯ ---

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
        dialogue.settings.world_data if dialogue.settings else {},
        dialogue.settings.character_cards if dialogue.settings else [],
        dialogue.settings.ai_controls_user if dialogue.settings else False
    )
    
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

    debug_info = {
        "status": "generating",
        "system_prompt": system_prompt,
        "history_sent": history,
        "model": req.model or ollama_client.model,
        "timings_ms": {},
    }

    try:
        t0 = time.perf_counter()
        ollama_res = await _run_with_cancel_check(
            request,
            ollama_client.chat(history, system_prompt, model=req.model)
        )
        ai_response = ollama_res["parsed"]
        debug_info["timings_ms"]["ollama"] = round((time.perf_counter() - t0) * 1000)
        debug_info["raw_response"] = ollama_res.get("raw", "")
        debug_info["thinking"] = ollama_res.get("thinking", "")

        image_path = None
        has_image = False
        image_variants = []
        image_prompt = (ai_response.get("image_prompt") or "").strip()
        negative_prompt = (ai_response.get("negative_prompt") or "").strip()
        prompt_source = "model"
        comfy_info = {}

        if req.generate_image:
            if not image_prompt:
                scene_text = " ".join(b.get("text", "") for b in ai_response.get("blocks", [])).strip() or req.user_text
                style_preset = dialogue.settings.world_data.get("appearance", "") if dialogue.settings else ""
                image_prompt = f"{scene_text[:400]}, {style_preset}".strip(", ")
                prompt_source = "fallback"

            t1 = time.perf_counter()
            comfy_res = await _run_with_cancel_check(
                request,
                comfyui_client.generate_image(image_prompt, negative_prompt)
            )
            image_path = comfy_res["image_path"]
            comfy_info = {"prompt_id": comfy_res["prompt_id"], "seed": comfy_res["seed"]}
            has_image = True
            image_variants = [image_path]
            debug_info["timings_ms"]["comfyui"] = round((time.perf_counter() - t1) * 1000)

        debug_info["status"] = "success"
        debug_info["image_prompt_used"] = image_prompt
        debug_info["negative_prompt_used"] = negative_prompt
        debug_info["image_prompt_source"] = prompt_source
        debug_info["comfyui_info"] = comfy_info

        assistant_message.content = ai_response.get("blocks", [])
        assistant_message.image_path = image_path
        assistant_message.image_variants = image_variants
        assistant_message.has_image = has_image
        assistant_message.image_prompt = image_prompt
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

# --- РЕГЕНЕРАЦИЯ ---

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
        dialogue.settings.world_data if dialogue.settings else {},
        dialogue.settings.character_cards if dialogue.settings else [],
        dialogue.settings.ai_controls_user if dialogue.settings else False
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
    negative_prompt = ""
    
    if req.mode == "new" or not image_prompt:
        history = []
        for m in dialogue.messages:
            if m.id == req.message_id: break
            if m.role == "user": history.append({"role": "user", "content": m.content[0]["text"] if m.content else ""})
            elif m.role == "assistant": history.append({"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])})
        
        system_prompt = build_system_prompt(
            dialogue.settings.world_data if dialogue.settings else {},
            dialogue.settings.character_cards if dialogue.settings else [],
            dialogue.settings.ai_controls_user if dialogue.settings else False
        ) + "\n\nОтвечай ТОЛЬКО полями image_prompt и negative_prompt. Формат: {\"image_prompt\": \"...\", \"negative_prompt\": \"...\"}"
        
        try:
            ollama_res = await ollama_client.chat(history, system_prompt, model=req.model)
            image_prompt = ollama_res["parsed"].get("image_prompt", "")
            negative_prompt = ollama_res["parsed"].get("negative_prompt", "")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
        
        if not image_prompt: raise HTTPException(status_code=400, detail="No image prompt generated")
        message.image_prompt = image_prompt
    else:
        neg_log = message.debug_info.get("negative_prompt_used", "") if message.debug_info else ""
        negative_prompt = neg_log
    
    try:
        comfy_res = await comfyui_client.generate_image(image_prompt, negative_prompt)
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