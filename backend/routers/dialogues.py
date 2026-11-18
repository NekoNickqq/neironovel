from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks, File, Form, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import time
import os
import hashlib
import asyncio
from datetime import datetime
from world_builder import generate_world_state

from database import get_db, Dialogue, DialogueSettings, Message, CharacterCard, CharacterAvatar, DialogueCharacter, sync_dialogue_characters
from config import config
from ollama_client import ollama_client
from comfyui_client import comfyui_client
from utils import build_system_prompt, apply_presets
from helpers import _run_with_cancel_check
from image_utils import cleanup_orphan_images

router = APIRouter()

# ============ Схемы данных ============
class CreateDialogueRequest(BaseModel):
    title: str
    description: str = ""
    world_data: dict = {}
    character_cards: list = []
    ai_controls_user: bool = False
    story_mode: str = "simple"

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

class UpdateDialogueSettingsRequest(BaseModel):
    world_data: Optional[dict] = None
    character_cards: Optional[list] = None
    ai_controls_user: Optional[bool] = None

# ============ Эндпоинты ============

@router.get("/dialogues")
async def list_dialogues(db: Session = Depends(get_db)):
    dialogues = db.query(Dialogue).order_by(Dialogue.created_at.desc()).all()
    return [{"id": d.id, "title": d.title, "description": d.settings.world_data.get("name", "") if d.settings else "", "message_count": len(d.messages), "character_count": len(d.settings.character_cards) if d.settings else 0, "created_at": d.created_at.isoformat()} for d in dialogues]

@router.post("/dialogues")
async def create_dialogue(req: CreateDialogueRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dialogue_id = str(uuid.uuid4())
    dialogue = Dialogue(id=dialogue_id, title=req.title, created_at=datetime.utcnow())
    settings = DialogueSettings(
        dialogue_id=dialogue_id, 
        world_data=req.world_data, 
        character_cards=req.character_cards, 
        ai_controls_user=req.ai_controls_user, 
        story_mode=req.story_mode
    )
    db.add(dialogue)
    db.add(settings)
    db.commit()

    # Привязываем карточки персонажей к миру (одна карточка — много миров)
    sync_dialogue_characters(db, dialogue_id, req.character_cards)
    
    # ЗАПУСКАЕМ ФОНОВУЮ ГЕНЕРАЦИЮ МИРА
    # Это не заблокирует ответ, пользователь сразу перейдет в чат
    background_tasks.add_task(generate_world_state, dialogue_id, req.world_data, req.character_cards)
    
    return {"dialogue_id": dialogue_id, "status": "created"}

@router.patch("/dialogues/{dialogue_id}/settings")
async def update_dialogue_settings(dialogue_id: str, req: UpdateDialogueSettingsRequest, db: Session = Depends(get_db)):
    settings = db.query(DialogueSettings).filter(DialogueSettings.dialogue_id == dialogue_id).first()
    if not settings: raise HTTPException(status_code=404, detail="Settings not found")
    if req.world_data is not None: settings.world_data = req.world_data
    if req.character_cards is not None: settings.character_cards = req.character_cards
    if req.ai_controls_user is not None: settings.ai_controls_user = req.ai_controls_user
    db.commit()

    # Пересобираем связи «мир ↔ карточки персонажей» при изменении состава персонажей
    if req.character_cards is not None:
        sync_dialogue_characters(db, dialogue_id, req.character_cards)
    return {"status": "updated"}

@router.get("/dialogues/{dialogue_id}")
async def get_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    messages = [{"id": m.id, "dialogue_id": m.dialogue_id, "role": m.role, "blocks": m.content, "image_path": m.image_path, "image_variants": m.image_variants, "selected_image_index": m.selected_image_index, "has_image": m.has_image, "image_prompt": m.image_prompt, "debug_info": m.debug_info, "text_versions": m.text_versions, "selected_version_index": m.selected_version_index, "original_user_text": m.original_user_text, "parent_id": m.parent_id, "created_at": m.created_at.isoformat()} for m in dialogue.messages]

    # Аватарки, привязанные к этому миру (нужны для круглых аватарок в чате)
    dialogue_avatars = (
        db.query(CharacterAvatar)
        .filter(CharacterAvatar.dialogue_id == dialogue_id)
        .order_by(CharacterAvatar.created_at.desc())
        .all()
    )

    return {"id": dialogue.id, "title": dialogue.title, "settings": {
        "world_data": dialogue.settings.world_data if dialogue.settings else {},
        "character_cards": dialogue.settings.character_cards if dialogue.settings else [],
        "font_config": dialogue.settings.font_config if dialogue.settings else {},
        "ai_controls_user": dialogue.settings.ai_controls_user if dialogue.settings else False,
        "story_mode": dialogue.settings.story_mode if dialogue.settings else "simple",
        "world_state": dialogue.settings.world_state if dialogue.settings else {},
        "user_avatar_path": (dialogue.settings.user_avatar_path or "") if dialogue.settings else ""},
        "avatars": [{
            "id": a.id,
            "character_card_id": a.character_card_id,
            "image_path": a.image_path,
            "source": a.source,
            "created_at": a.created_at.isoformat(),
        } for a in dialogue_avatars],
        "messages": messages, "created_at": dialogue.created_at.isoformat()}

@router.delete("/dialogues/{dialogue_id}")
async def delete_dialogue(dialogue_id: str, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    db.delete(dialogue)
    db.commit()
    
    cleanup_orphan_images(db)
    return {"status": "deleted"}

@router.post("/message")
async def send_message(req: SendMessageRequest, request: Request, db: Session = Depends(get_db)):
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not dialogue: raise HTTPException(status_code=404, detail="Dialogue not found")
    
    user_msg_id = str(uuid.uuid4())
    last_msg = dialogue.messages[-1] if dialogue.messages else None
    user_message = Message(id=user_msg_id, dialogue_id=req.dialogue_id, role="user", content=[{"speaker": "user", "text": req.user_text}], has_image=False, parent_id=last_msg.id if last_msg else None, created_at=datetime.utcnow())
    db.add(user_message)
    db.commit()
    
    history = [{"role": "user", "content": m.content[0]["text"]} if m.role == "user" else {"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])} for m in dialogue.messages]
    system_prompt = build_system_prompt(dialogue.settings.world_data if dialogue.settings else {},
                                        dialogue.settings.character_cards if dialogue.settings else [],
                                        dialogue.settings.ai_controls_user if dialogue.settings else False,
                                        dialogue.settings.story_mode if dialogue.settings else "simple",
                                        dialogue.settings.world_state if dialogue.settings else {}
                                        )
    
    assistant_msg_id = str(uuid.uuid4())
    assistant_message = Message(id=assistant_msg_id, dialogue_id=req.dialogue_id, role="assistant", content=[{"speaker": "narrator", "text": "*Генерация...*"}], image_path=None, image_variants=[], selected_image_index=0, has_image=False, image_prompt="", debug_info={"status": "generating"}, text_versions=[], selected_version_index=0, parent_id=user_msg_id, created_at=datetime.utcnow())
    db.add(assistant_message)
    db.commit()

    debug_info = {"status": "generating", "system_prompt": system_prompt, "history_sent": history, "model": req.model or ollama_client.model, "timings_ms": {}}

    try:
        t0 = time.perf_counter()
        ollama_res = await _run_with_cancel_check(request, ollama_client.chat(history, system_prompt, model=req.model))
        ai_response = ollama_res["parsed"]
        debug_info["timings_ms"]["ollama"] = round((time.perf_counter() - t0) * 1000)
        debug_info["raw_response"] = ollama_res.get("raw", "")
        debug_info["thinking"] = ollama_res.get("thinking", "")

        image_path, has_image, image_variants, comfy_info = None, False, [], {}
        image_prompt = (ai_response.get("image_prompt") or "").strip()
        negative_prompt = (ai_response.get("negative_prompt") or "").strip()
        scene_type = ai_response.get("scene_type", "character")
        prompt_source = "model"

        if req.generate_image:
            if not image_prompt:
                scene_text = " ".join(b.get("text", "") for b in ai_response.get("blocks", [])).strip() or req.user_text
                style_preset = dialogue.settings.world_data.get("appearance", "") if dialogue.settings else ""
                image_prompt = f"{scene_text[:400]}, {style_preset}".strip(", ")
                prompt_source = "fallback"

            # ПРИМЕНЯЕМ ПРЕСЕТЫ
            final_pos, final_neg = apply_presets(image_prompt, negative_prompt, scene_type)

            t1 = time.perf_counter()
            comfy_res = await _run_with_cancel_check(
                request, 
                comfyui_client.generate_image(
                    final_pos, 
                    final_neg, 
                    subfolder=f"Narrative/{req.dialogue_id}"
                )
            )
            image_path = comfy_res["image_path"]
            comfy_info = {"prompt_id": comfy_res["prompt_id"], "seed": comfy_res["seed"]}
            has_image, image_variants = True, [image_path]
            debug_info["timings_ms"]["comfyui"] = round((time.perf_counter() - t1) * 1000)

        debug_info.update({
            "status": "success", 
            "image_prompt_used": final_pos if req.generate_image else image_prompt, 
            "negative_prompt_used": final_neg if req.generate_image else negative_prompt, 
            "scene_type_used": scene_type,
            "image_prompt_source": prompt_source, 
            "comfyui_info": comfy_info
        })
        
        assistant_message.content = ai_response.get("blocks", [])
        assistant_message.image_path = image_path
        assistant_message.image_variants = image_variants
        assistant_message.has_image = has_image
        assistant_message.image_prompt = image_prompt # Сохраняем оригинальный промпт модели
        assistant_message.debug_info = dict(debug_info)

    except asyncio.CancelledError:
        debug_info["status"] = "aborted_by_user"
        assistant_message.content = [{"speaker": "narrator", "text": "*Генерация прервана пользователем.*"}]
        assistant_message.debug_info = dict(debug_info)
        await comfyui_client.interrupt()
    except Exception as e:
        debug_info["status"] = "error"
        debug_info["error_message"] = str(e)
        assistant_message.content = [{"speaker": "narrator", "text": f"*Ошибка: {str(e)}*"}]
        assistant_message.debug_info = dict(debug_info)
        await comfyui_client.interrupt()
    finally:
        db.commit()
    
    return {"user_message_id": user_msg_id, "assistant_message_id": assistant_msg_id, "ai_text": assistant_message.content, "has_image": assistant_message.has_image, "image_path": assistant_message.image_path}

@router.post("/regenerate/text")
async def regenerate_text(req: RegenerateRequest, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req.message_id).first()
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not message or not dialogue or message.dialogue_id != req.dialogue_id: raise HTTPException(404, "Not found")
    
    history = [{"role": "user", "content": m.content[0]["text"]} if m.role == "user" else {"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])} for m in dialogue.messages if m.id != req.message_id]
    last_user_msg = next((m for m in reversed(dialogue.messages) if m.role == "user" and m.id != req.message_id), None)
    if last_user_msg: history.append({"role": "user", "content": last_user_msg.content[0]["text"]})
    
    system_prompt = build_system_prompt(dialogue.settings.world_data, dialogue.settings.character_cards, dialogue.settings.ai_controls_user, dialogue.settings.story_mode)
    
    try:
        ollama_res = await ollama_client.chat(history, system_prompt, model=req.model)
        new_blocks = ollama_res["parsed"].get("blocks", [])
    except Exception as e: raise HTTPException(500, f"Ollama error: {str(e)}")
    
    # Безопасное создание нового списка: JSON-колонки SQLAlchemy не отслеживают
    # in-place мутации (append), поэтому вариант не сохранился бы в БД
    text_versions = [*(message.text_versions or []), new_blocks]
    message.text_versions = text_versions
    message.selected_version_index = len(text_versions)
    db.commit()
    return {"message_id": message.id, "new_blocks": new_blocks, "version_count": len(text_versions) + 1}

@router.post("/regenerate/image")
async def regenerate_image(req: RegenerateRequest, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req.message_id).first()
    dialogue = db.query(Dialogue).filter(Dialogue.id == req.dialogue_id).first()
    if not message or not dialogue or message.dialogue_id != req.dialogue_id: raise HTTPException(404, "Not found")
    
    image_prompt = message.image_prompt
    negative_prompt = ""
    scene_type = "character" # Дефолтный пресет
    
    if req.mode == "new" or not image_prompt:
        history = [{"role": "user", "content": m.content[0]["text"]} if m.role == "user" else {"role": "assistant", "content": "\n".join([f"[{b['speaker']}]: {b['text']}" for b in m.content])} for m in dialogue.messages if m.id != req.message_id]
        # Просим нейросеть заново описать сцену и вернуть scene_type
        system_prompt = build_system_prompt(dialogue.settings.world_data, dialogue.settings.character_cards, dialogue.settings.ai_controls_user, dialogue.settings.story_mode) + "\n\nОтвечай ТОЛЬКО полями image_prompt, negative_prompt и scene_type. Формат: {\"image_prompt\": \"...\", \"negative_prompt\": \"...\", \"scene_type\": \"character\"}"
        try:
            ollama_res = await ollama_client.chat(history, system_prompt, model=req.model)
            image_prompt = ollama_res["parsed"].get("image_prompt", "")
            negative_prompt = ollama_res["parsed"].get("negative_prompt", "")
            scene_type = ollama_res["parsed"].get("scene_type", "character")
        except Exception as e: raise HTTPException(500, f"Ollama error: {str(e)}")
        if not image_prompt: raise HTTPException(400, "No image prompt generated")
        message.image_prompt = image_prompt
    else:
        # Берем сохраненные данные из debug_info
        neg_log = message.debug_info.get("negative_prompt_used", "") if message.debug_info else ""
        negative_prompt = neg_log
        scene_type = message.debug_info.get("scene_type_used", "character") if message.debug_info else "character"
    
    # ПРИМЕНЯЕМ ПРЕСЕТЫ
    final_pos, final_neg = apply_presets(image_prompt, negative_prompt, scene_type)

    try:
        comfy_res = await comfyui_client.generate_image(
            final_pos, 
            final_neg, 
            subfolder=f"Narrative/{req.dialogue_id}"
        )
        new_image_path = comfy_res["image_path"]
    except Exception as e: raise HTTPException(500, f"ComfyUI error: {str(e)}")
    
    # ВАЖНО: создаём новый список. JSON-колонки SQLAlchemy не отслеживают
    # in-place мутации, из-за чего новый вариант терялся при commit
    image_variants = [*(message.image_variants or []), new_image_path]
    
    # Обновляем debug_info для этого нового варианта
    if not message.debug_info: message.debug_info = {}
    message.debug_info["scene_type_used"] = scene_type
    message.debug_info["image_prompt_used"] = final_pos
    message.debug_info["negative_prompt_used"] = final_neg
    # Обязательно пересохраняем словарь, чтобы SQLAlchemy заметил изменения
    message.debug_info = dict(message.debug_info)

    message.image_variants = image_variants
    message.selected_image_index = len(image_variants) - 1
    message.has_image = True
    message.image_path = new_image_path
    db.commit()
    
    return {"message_id": message.id, "new_image_path": new_image_path, "variant_count": len(image_variants), "prompt_source": "new" if req.mode == "new" else "same"}

@router.post("/select/image")
async def select_image(req: dict, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message: raise HTTPException(404, "Not found")
    message.selected_image_index = req["index"]
    db.commit()
    return {"status": "ok"}

@router.post("/select/version")
async def select_version(req: dict, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == req["message_id"]).first()
    if not message: raise HTTPException(404, "Not found")
    message.selected_version_index = req["index"]
    db.commit()
    return {"status": "ok"}

# ============ АВАТАРКИ МИРА (ЧАТА) ============

@router.get("/dialogues/{dialogue_id}/avatars")
async def list_dialogue_avatars(dialogue_id: str, db: Session = Depends(get_db)):
    """Все аватарки, привязанные к конкретному миру (чату)."""
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(404, "Dialogue not found")

    avatars = (
        db.query(CharacterAvatar)
        .filter(CharacterAvatar.dialogue_id == dialogue_id)
        .order_by(CharacterAvatar.created_at.desc())
        .all()
    )
    card_names = {
        c.id: c.name
        for c in db.query(CharacterCard).filter(CharacterCard.id.in_({a.character_card_id for a in avatars})).all()
    } if avatars else {}

    return [{
        "id": a.id,
        "character_card_id": a.character_card_id,
        "character_name": card_names.get(a.character_card_id),
        "dialogue_id": a.dialogue_id,
        "image_path": a.image_path,
        "prompt": a.prompt,
        "negative_prompt": a.negative_prompt,
        "source": a.source,
        "created_at": a.created_at.isoformat(),
    } for a in avatars]

@router.post("/dialogues/{dialogue_id}/avatar")
async def upload_dialogue_avatar(
    dialogue_id: str,
    file: UploadFile = File(...),
    character_card_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Загрузка пользовательской аватарки с привязкой к миру (чату) и карточке персонажа."""
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(404, "Dialogue not found")

    # Если карточка не передана — берём первую привязанную к миру
    if not character_card_id:
        link = db.query(DialogueCharacter).filter(DialogueCharacter.dialogue_id == dialogue_id).first()
        character_card_id = link.character_card_id if link else None
    if not character_card_id:
        raise HTTPException(400, "К этому миру не привязана ни одна карточка персонажа")

    card = db.query(CharacterCard).filter(CharacterCard.id == character_card_id).first()
    if not card: raise HTTPException(404, "Character card not found")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Пустой файл")

    ext = (file.filename or "png").rsplit(".", 1)[-1].lower()
    if ext not in {"png", "jpg", "jpeg", "webp"}:
        raise HTTPException(400, "Поддерживаются только png, jpg, jpeg и webp")

    file_hash = hashlib.md5(contents).hexdigest()
    filename = f"{file_hash}.{ext}"
    target_dir = os.path.join(config.AVATARS_PATH, "uploads", character_card_id)
    os.makedirs(target_dir, exist_ok=True)
    filepath = os.path.join(target_dir, filename)

    if not os.path.exists(filepath):
        with open(filepath, "wb") as buffer:
            buffer.write(contents)

    image_path = f"/avatars/uploads/{character_card_id}/{filename}"
    avatar = CharacterAvatar(
        id=str(uuid.uuid4()),
        character_card_id=character_card_id,
        dialogue_id=dialogue_id,
        image_path=image_path,
        prompt="",
        negative_prompt="",
        source="upload",
    )
    db.add(avatar)
    db.commit()

    return {
        "id": avatar.id,
        "character_card_id": character_card_id,
        "dialogue_id": dialogue_id,
        "image_path": image_path,
        "source": "upload",
        "created_at": avatar.created_at.isoformat(),
    }

@router.post("/dialogues/{dialogue_id}/user-avatar")
async def upload_user_avatar(
    dialogue_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Индивидуальный аватар пользователя для конкретного мира (чата)."""
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue: raise HTTPException(404, "Dialogue not found")
    settings = dialogue.settings
    if not settings: raise HTTPException(404, "Dialogue settings not found")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Пустой файл")

    ext = (file.filename or "png").rsplit(".", 1)[-1].lower()
    if ext not in {"png", "jpg", "jpeg", "webp"}:
        raise HTTPException(400, "Поддерживаются только png, jpg, jpeg и webp")

    file_hash = hashlib.md5(contents).hexdigest()
    filename = f"{file_hash}.{ext}"
    target_dir = os.path.join(config.AVATARS_PATH, "users", dialogue_id)
    os.makedirs(target_dir, exist_ok=True)
    filepath = os.path.join(target_dir, filename)

    if not os.path.exists(filepath):
        with open(filepath, "wb") as buffer:
            buffer.write(contents)

    image_path = f"/avatars/users/{dialogue_id}/{filename}"
    settings.user_avatar_path = image_path
    db.commit()

    return {"dialogue_id": dialogue_id, "image_path": image_path}

