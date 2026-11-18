from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import shutil
import re
import hashlib
from image_utils import cleanup_orphan_images

from database import get_db, WorldCard, CharacterCard, Dialogue, DialogueCharacter, CharacterAvatar, GeneratedImagePrompt
from config import config
from ollama_client import ollama_client
from comfyui_client import comfyui_client
from utils import extract_json_from_text

router = APIRouter()

# ============ Схемы данных ============
class GenerateNegativeRequest(BaseModel):
    type: str
    data: dict

class GenerateCardImageRequest(BaseModel):
    type: str
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
    image_prompt: str = ""
    image_negative_prompt: str = ""

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
    image_prompt: str = ""
    image_negative_prompt: str = ""


def _selected_variant(variants: list, index: int) -> Optional[str]:
    """Возвращает выбранный путь картинки с защитой от некорректного индекса."""
    paths = list(variants or [])
    if not paths:
        return None
    if isinstance(index, int) and 0 <= index < len(paths):
        return paths[index]
    return paths[-1]


def _apply_prompt_from_image(db: Session, card, image_variants: list, selected_index: int) -> None:
    """Дублирует промпт сгенерированной картинки в скрытое поле карточки.

    Промпт берётся из хранилища image_prompts (извлечён из PNG-метаданных ComfyUI).
    """
    path = _selected_variant(image_variants, selected_index)
    if not path:
        return
    row = db.query(GeneratedImagePrompt).filter(GeneratedImagePrompt.image_path == path).first()
    if not row:
        return
    card.image_prompt = row.prompt or ""
    card.image_negative_prompt = row.negative_prompt or ""

# ============ Эндпоинты ============

@router.get("/worlds")
async def list_worlds(db: Session = Depends(get_db)):
    worlds = db.query(WorldCard).all()
    return [{"id": w.id, "name": w.name, "history": w.history, "features": w.features, "appearance": w.appearance, "negative_prompt": w.negative_prompt, "image_variants": w.image_variants, "selected_image_index": w.selected_image_index, "image_prompt": w.image_prompt, "image_negative_prompt": w.image_negative_prompt} for w in worlds]

@router.post("/worlds")
async def create_world(req: WorldCardSchema, db: Session = Depends(get_db)):
    w = WorldCard(id=str(uuid.uuid4()), **req.dict(exclude={"id"}))
    # Скрытый промпт выбранной картинки (из PNG-метаданных ComfyUI), если он ещё не задан явно
    if not w.image_prompt:
        _apply_prompt_from_image(db, w, req.image_variants, req.selected_image_index)
    db.add(w)
    db.commit()
    return {"id": w.id}

@router.patch("/worlds/{card_id}")
async def update_world(card_id: str, req: WorldCardSchema, db: Session = Depends(get_db)):
    w = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    if not w: raise HTTPException(404, "Not found")
    w.name = req.name
    w.history = req.history
    w.features = req.features
    w.appearance = req.appearance
    w.negative_prompt = req.negative_prompt
    db.commit()
    return {"status": "updated"}

@router.get("/characters")
async def list_chars(db: Session = Depends(get_db)):
    chars = db.query(CharacterCard).all()
    return [{"id": c.id, "name": c.name, "appearance": c.appearance, "personality": c.personality, "features": c.features, "negative_appearance": c.negative_appearance, "negative_personality": c.negative_personality, "image_variants": c.image_variants, "selected_image_index": c.selected_image_index, "image_prompt": c.image_prompt, "image_negative_prompt": c.image_negative_prompt} for c in chars]

@router.post("/characters")
async def create_char(req: CharacterCardSchema, db: Session = Depends(get_db)):
    c = CharacterCard(id=str(uuid.uuid4()), **req.dict(exclude={"id"}))
    # Скрытый промпт выбранной картинки (из PNG-метаданных ComfyUI), если он ещё не задан явно
    if not c.image_prompt:
        _apply_prompt_from_image(db, c, req.image_variants, req.selected_image_index)
    db.add(c)
    db.commit()
    return {"id": c.id}

@router.patch("/characters/{card_id}")
async def update_char(card_id: str, req: CharacterCardSchema, db: Session = Depends(get_db)):
    c = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
    if not c: raise HTTPException(404, "Not found")
    c.name = req.name
    c.appearance = req.appearance
    c.personality = req.personality
    c.features = req.features
    c.negative_appearance = req.negative_appearance
    c.negative_personality = req.negative_personality
    db.commit()
    return {"status": "updated"}

@router.patch("/{card_type}/{card_id}/images")
async def update_card_images(card_type: str, card_id: str, req: UpdateImagesRequest, db: Session = Depends(get_db)):
    if card_type == "world": card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    else: card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
    if not card: raise HTTPException(404, "Card not found")
    card.image_variants = req.image_variants
    card.selected_image_index = req.selected_image_index
    # Промпт выбранной картинки дублируем в скрытое поле карточки
    _apply_prompt_from_image(db, card, req.image_variants, req.selected_image_index)
    db.commit()
    return {"status": "updated", "image_prompt": card.image_prompt, "image_negative_prompt": card.image_negative_prompt}

@router.delete("/{card_type}/{card_id}")
async def delete_card(card_type: str, card_id: str, db: Session = Depends(get_db)):
    if card_type == "world": card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    else: card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
    if not card: raise HTTPException(404, "Card not found")
    
    db.delete(card)
    db.commit()
    
    cleanup_orphan_images(db) # <-- ЗАПУСКАЕМ ОЧИСТКУ
    return {"status": "deleted"}

@router.post("/generate_negative")
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
            return {"negative": ", ".join(list(dict.fromkeys(tags)))}
        else:
            prompt = f"Create negative tags in English for a character. Name: {req.data.get('name')}. Appearance: {req.data.get('appearance')}. Personality: {req.data.get('personality')}. Return a JSON object with exactly two keys: 'negative_appearance' and 'negative_personality'. Example: {{\"negative_appearance\": \"old\", \"negative_personality\": \"dull\"}}"
            res = await ollama_client.chat([{"role": "user", "content": prompt}], "Output ONLY valid JSON.", temperature=0.1)
            raw = res.get("raw", "")
            data = extract_json_from_text(raw)
            neg_app = re.sub(r'[^a-zA-Z0-9,\s]', '', str(data.get("negative_appearance") or ""))
            neg_pers = re.sub(r'[^a-zA-Z0-9,\s]', '', str(data.get("negative_personality") or ""))
            return {"negative_appearance": neg_app, "negative_personality": neg_pers}
    except Exception as e:
        base_neg = "ugly, blurry, low quality, deformed, worst quality, low resolution, watermark, text, signature, sketch"
        if req.type == "world": return {"negative": base_neg + ", human, character, person"}
        else: return {"negative_appearance": base_neg + ", bad anatomy", "negative_personality": "dull, boring, passive"}

@router.post("/upload_image")
async def upload_image(card_type: str = Query(...), file: UploadFile = File(...)):
    contents = await file.read()
    file_ext = file.filename.split(".")[-1]
    
    # Вычисляем MD5-хэш файла для защиты от дубликатов
    file_hash = hashlib.md5(contents).hexdigest()
    filename = f"{file_hash}.{file_ext}"
    
    # Выбираем папку назначения
    if card_type == "world":
        target_dir = config.GALLERY_CARDS_WORLDS
        subpath = "cards/worlds"
    else:
        target_dir = config.GALLERY_CARDS_CHARACTERS
        subpath = "cards/characters"
        
    filepath = os.path.join(target_dir, filename)
    
    # Если файла с таким хэшем еще нет, сохраняем его
    if not os.path.exists(filepath):
        with open(filepath, "wb") as buffer:
            buffer.write(contents)
            
    return {"image_path": f"/gallery/{subpath}/{filename}"}

@router.post("/generate_image")
async def generate_card_image(req: GenerateCardImageRequest, db: Session = Depends(get_db)):
    try:
        clean_negative_words = ["ugly", "blurry", "low quality", "deformed", "bad anatomy", "worst quality", "sketch"]
        tags = [t.strip() for t in req.prompt.split(',') if t.strip()]
        final_prompt = ", ".join([tag for tag in tags if not any(bad_word in tag.lower() for bad_word in clean_negative_words)])
        
        if req.type == "world":
            res = await comfyui_client.generate_image(final_prompt, req.negative_prompt, width=1280, height=720, subfolder="cards/worlds")
        else:
            res = await comfyui_client.generate_image(final_prompt, req.negative_prompt, width=720, height=1680, subfolder="cards/characters")
            
        # Промпт из PNG-метаданных ComfyUI (фолбэк — отправленный) сохраняем,
        # чтобы позже продублировать его в скрытое поле карточки
        used_prompt = res.get("prompt") or final_prompt
        used_negative = res.get("negative_prompt") or req.negative_prompt
        db.merge(GeneratedImagePrompt(
            image_path=res["image_path"],
            prompt=used_prompt,
            negative_prompt=used_negative,
            source=res.get("prompt_source", "request"),
        ))
        db.commit()

        return {
            "image_path": res["image_path"],
            "prompt": used_prompt,
            "negative_prompt": used_negative,
            "prompt_source": res.get("prompt_source", "request"),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ============ МИРЫ И АВАТАРКИ КАРТОЧКИ ПЕРСОНАЖА ============

@router.get("/characters/{card_id}/worlds")
async def list_character_worlds(card_id: str, db: Session = Depends(get_db)):
    """Все миры (чаты), в которых используется карточка персонажа."""
    card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
    if not card: raise HTTPException(404, "Character not found")

    dialogues = (
        db.query(Dialogue)
        .join(DialogueCharacter, DialogueCharacter.dialogue_id == Dialogue.id)
        .filter(DialogueCharacter.character_card_id == card_id)
        .order_by(Dialogue.created_at.desc())
        .all()
    )

    result = []
    for d in dialogues:
        avatar_count = db.query(CharacterAvatar).filter(
            CharacterAvatar.character_card_id == card_id,
            CharacterAvatar.dialogue_id == d.id,
        ).count()
        result.append({
            "id": d.id,
            "title": d.title,
            "description": d.settings.world_data.get("name", "") if d.settings and d.settings.world_data else "",
            "message_count": len(d.messages),
            "avatar_count": avatar_count,
            "created_at": d.created_at.isoformat(),
        })
    return result

@router.get("/characters/{card_id}/avatars")
async def list_character_avatars(card_id: str, db: Session = Depends(get_db)):
    """Все сгенерированные и загруженные аватарки карточки персонажа."""
    card = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
    if not card: raise HTTPException(404, "Character not found")

    avatars = (
        db.query(CharacterAvatar)
        .filter(CharacterAvatar.character_card_id == card_id)
        .order_by(CharacterAvatar.created_at.desc())
        .all()
    )

    dialogue_titles = {
        d.id: d.title
        for d in db.query(Dialogue).filter(Dialogue.id.in_({a.dialogue_id for a in avatars if a.dialogue_id})).all()
    } if avatars else {}

    return [{
        "id": a.id,
        "character_card_id": a.character_card_id,
        "dialogue_id": a.dialogue_id,
        "dialogue_title": dialogue_titles.get(a.dialogue_id),
        "image_path": a.image_path,
        "prompt": a.prompt,
        "negative_prompt": a.negative_prompt,
        "source": a.source,
        "created_at": a.created_at.isoformat(),
    } for a in avatars]
