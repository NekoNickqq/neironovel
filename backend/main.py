import uuid
import os
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import config
from database import init_db, get_db, Dialogue, DialogueSettings, Message
from ollama_client import ollama_client
from comfyui_client import comfyui_client
from utils import build_system_prompt, build_avatar_prompt, build_avatar_negative

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print("✅ Database initialized")
    print(f"🦙 Ollama: {config.OLLAMA_URL}")
    print(f"🎨 ComfyUI: {config.COMFYUI_URL}")
    yield
    # Shutdown
    print("👋 Shutting down...")

app = FastAPI(title="RP Novel Engine API", version="1.0.0", lifespan=lifespan)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы для галереи
os.makedirs(config.GALLERY_PATH, exist_ok=True)
os.makedirs(config.AVATARS_PATH, exist_ok=True)
app.mount("/gallery", StaticFiles(directory=config.GALLERY_PATH), name="gallery")
app.mount("/avatars", StaticFiles(directory=config.AVATARS_PATH), name="avatars")

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

class RegenerateRequest(BaseModel):
    dialogue_id: str
    message_id: str

# ============ Эндпоинты ============



@app.get("/health")
async def health_check():
    """Проверка здоровья всех сервисов"""
    ollama_ok = await ollama_client.is_available()
    comfyui_ok = await comfyui_client.is_available()
    
    return {
        "status": "ok",
        "services": {
            "ollama": ollama_ok,
            "comfyui": comfyui_ok
        }
    }

@app.get("/dialogues")
async def list_dialogues(db: Session = Depends(get_db)):
    """Получить список всех диалогов"""
    dialogues = db.query(Dialogue).order_by(Dialogue.created_at.desc()).all()
    
    result = []
    for d in dialogues:
        result.append({
            "id": d.id,
            "title": d.title,
            "description": d.settings.world_lore[:100] if d.settings else "",
            "message_count": len(d.messages),
            "character_count": len(d.settings.character_cards) if d.settings else 0,
            "style_preset": d.settings.style_preset if d.settings else "",
            "created_at": d.created_at.isoformat()
        })
    
    return result

@app.post("/dialogues")
async def create_dialogue(req: CreateDialogueRequest, db: Session = Depends(get_db)):
    """Создать новый диалог"""
    dialogue_id = str(uuid.uuid4())
    
    dialogue = Dialogue(
        id=dialogue_id,
        title=req.title,
        created_at=datetime.utcnow()
    )
    
    settings = DialogueSettings(
        dialogue_id=dialogue_id,
        world_lore=req.world_lore,
        character_cards=req.character_cards,
        style_preset=req.style_preset,
        ai_controls_user=req.ai_controls_user
    )
    
    db.add(dialogue)
    db.add(settings)
    db.commit()
    
    return {"dialogue_id": dialogue_id, "status": "created"}

@app.get("/dialogues/{dialogue_id}")
async def get_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    """Получить диалог с сообщениями и настройками"""
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    messages = []
    for m in dialogue.messages:
        messages.append({
            "id": m.id,
            "dialogue_id": m.dialogue_id,
            "role": m.role,
            "blocks": m.content,
            "image_path": m.image_path,
            "image_variants": m.image_variants,
            "selected_image_index": m.selected_image_index,
            "has_image": m.has_image,
            "text_versions": m.text_versions,
            "selected_version_index": m.selected_version_index,
            "original_user_text": m.original_user_text,
            "parent_id": m.parent_id,
            "created_at": m.created_at.isoformat()
        })
    
    return {
        "id": dialogue.id,
        "title": dialogue.title,
        "settings": {
            "world_lore": dialogue.settings.world_lore if dialogue.settings else "",
            "character_cards": dialogue.settings.character_cards if dialogue.settings else [],
            "style_preset": dialogue.settings.style_preset if dialogue.settings else "",
            "font_config": dialogue.settings.font_config if dialogue.settings else {},
            "ai_controls_user": dialogue.settings.ai_controls_user if dialogue.settings else False
        },
        "messages": messages,
        "created_at": dialogue.created_at.isoformat()
    }

@app.delete("/dialogues/{dialogue_id}")
async def delete_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    """Удалить диалог"""
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    db.delete(dialogue)
    db.commit()
    return {"status": "deleted"}

@app.post("/message")
async def send_message(req: SendMessageRequest, db: Session = Depends(get_db)):
    """
    Отправить сообщение и получить ответ от ИИ.
    Если generate_image=True — генерирует картинку через ComfyUI.
    """
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not dialogue:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    # 1. Сохраняем сообщение пользователя
    user_msg_id = str(uuid.uuid4())
    last_msg = dialogue.messages[-1] if dialogue.messages else None
    
    user_message = Message(
        id=user_msg_id,
        dialogue_id=req.dialogue_id,
        role="user",
        content=[{"speaker": "user", "text": req.user_text}],
        has_image=False,
        parent_id=last_msg.id if last_msg else None,
        created_at=datetime.utcnow()
    )
    db.add(user_message)
    db.commit()
    
    # 2. Формируем историю для Ollama
    history = []
    for m in dialogue.messages:
        if m.role == "user":
            text = m.content[0]["text"] if m.content else ""
            history.append({"role": "user", "content": text})
        elif m.role == "assistant":
            # Форматируем блоки в текст
            blocks_text = "\n".join([
                f"[{b['speaker']}]: {b['text']}" for b in m.content
            ])
            history.append({"role": "assistant", "content": blocks_text})
    
    # 3. Системный промпт
    system_prompt = build_system_prompt(
        world_lore=dialogue.settings.world_lore if dialogue.settings else "",
        character_cards=dialogue.settings.character_cards if dialogue.settings else [],
        style_preset=dialogue.settings.style_preset if dialogue.settings else "",
        ai_controls_user=dialogue.settings.ai_controls_user if dialogue.settings else False
    )
    
    # 4. Запрос в Ollama
    try:
        ai_response = await ollama_client.chat(history, system_prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
    
    # 5. Генерация картинки (если нужно)
    image_path = None
    has_image = False
    image_variants = []
    
    if req.generate_image and ai_response.get("image_prompt"):
        try:
            image_path = await comfyui_client.generate_image(ai_response["image_prompt"])
            has_image = True
            image_variants = [image_path]
        except Exception as e:
            print(f"⚠️ Image generation failed: {e}")
            # Продолжаем без картинки
    
    # 6. Сохраняем ответ ассистента
    assistant_msg_id = str(uuid.uuid4())
    assistant_message = Message(
        id=assistant_msg_id,
        dialogue_id=req.dialogue_id,
        role="assistant",
        content=ai_response.get("blocks", []),
        image_path=image_path,
        image_variants=image_variants,
        selected_image_index=0,
        has_image=has_image,
        text_versions=[],
        selected_version_index=0,
        parent_id=user_msg_id,
        created_at=datetime.utcnow()
    )
    db.add(assistant_message)
    db.commit()
    
    return {
        "user_message_id": user_msg_id,
        "assistant_message_id": assistant_msg_id,
        "ai_text": ai_response.get("blocks", []),
        "has_image": has_image,
        "image_path": image_path
    }

@app.post("/regenerate/text")
async def regenerate_text(req: RegenerateRequest, db: Session = Depends(get_db)):
    """Перегенерировать текст сообщения"""
    message = db.query(Message).filter(Message.id == req.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not dialogue:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    # Формируем историю до этого сообщения
    history = []
    for m in dialogue.messages:
        if m.id == req.message_id:
            break
        if m.role == "user":
            text = m.content[0]["text"] if m.content else ""
            history.append({"role": "user", "content": text})
        elif m.role == "assistant":
            blocks_text = "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])
            history.append({"role": "assistant", "content": blocks_text})
    
    # Добавляем последнее сообщение пользователя
    last_user_msg = None
    for m in reversed(dialogue.messages):
        if m.role == "user" and m.id != req.message_id:
            last_user_msg = m
            break
    
    if last_user_msg:
        text = last_user_msg.content[0]["text"] if last_user_msg.content else ""
        history.append({"role": "user", "content": text})
    
    system_prompt = build_system_prompt(
        world_lore=dialogue.settings.world_lore if dialogue.settings else "",
        character_cards=dialogue.settings.character_cards if dialogue.settings else [],
        style_preset=dialogue.settings.style_preset if dialogue.settings else "",
        ai_controls_user=dialogue.settings.ai_controls_user if dialogue.settings else False
    )
    
    try:
        ai_response = await ollama_client.chat(history, system_prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
    
    # Сохраняем новую версию
    new_blocks = ai_response.get("blocks", [])
    text_versions = message.text_versions or []
    text_versions.append(new_blocks)
    
    message.text_versions = text_versions
    message.selected_version_index = len(text_versions)
    db.commit()
    
    return {
        "message_id": message.id,
        "new_blocks": new_blocks,
        "version_count": len(text_versions) + 1
    }

@app.post("/regenerate/image")
async def regenerate_image(req: RegenerateRequest, db: Session = Depends(get_db)):
    """Перегенерировать картинку сообщения"""
    message = db.query(Message).filter(Message.id == req.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not dialogue:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    # Получаем image_prompt из оригинального ответа
    # Для простоты — генерируем новый промпт через Ollama
    history = []
    for m in dialogue.messages:
        if m.id == req.message_id:
            break
        if m.role == "user":
            text = m.content[0]["text"] if m.content else ""
            history.append({"role": "user", "content": text})
        elif m.role == "assistant":
            blocks_text = "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])
            history.append({"role": "assistant", "content": blocks_text})
    
    system_prompt = build_system_prompt(
        world_lore=dialogue.settings.world_lore if dialogue.settings else "",
        character_cards=dialogue.settings.character_cards if dialogue.settings else [],
        style_preset=dialogue.settings.style_preset if dialogue.settings else "",
        ai_controls_user=dialogue.settings.ai_controls_user if dialogue.settings else False
    )
    system_prompt += "\n\nОтвечай ТОЛЬКО полем image_prompt, без blocks. Формат: {\"image_prompt\": \"...\"}"
    
    try:
        ai_response = await ollama_client.chat(history, system_prompt)
        image_prompt = ai_response.get("image_prompt", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")
    
    if not image_prompt:
        raise HTTPException(status_code=400, detail="No image prompt generated")
    
    try:
        new_image_path = await comfyui_client.generate_image(image_prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ComfyUI error: {str(e)}")
    
    # Добавляем вариант
    image_variants = message.image_variants or []
    image_variants.append(new_image_path)
    
    message.image_variants = image_variants
    message.selected_image_index = len(image_variants) - 1
    message.has_image = True
    message.image_path = new_image_path
    db.commit()
    
    return {
        "message_id": message.id,
        "new_image_path": new_image_path,
        "variant_count": len(image_variants)
    }

@app.post("/select/image")
async def select_image(req: dict, db: Session = Depends(get_db)):
    """Выбрать вариант изображения"""
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    message.selected_image_index = req["index"]
    db.commit()
    
    return {"status": "ok"}

@app.post("/select/version")
async def select_version(req: dict, db: Session = Depends(get_db)):
    """Выбрать версию текста"""
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    message.selected_version_index = req["index"]
    db.commit()
    
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
