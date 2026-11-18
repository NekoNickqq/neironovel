import uuid

from config import config
from database import SessionLocal, CharacterAvatar, CharacterCard
from comfyui_client import comfyui_client
from utils import build_character_avatar_prompt, build_character_avatar_negative


async def generate_avatars_for_dialogue(dialogue_id: str, character_cards: list, world_data: dict = None) -> None:
    """Фоновая генерация аватарок для карточек персонажей, участвующих в мире.

    Промпт собирается из данных карточки (+ визуальный стиль мира), картинка
    сохраняется в backend/gallery/avatars/characters/<...> и привязывается к карточке и диалогу.
    Повторная генерация для той же пары «карточка + мир» не выполняется.
    """
    for card in character_cards or []:
        if not isinstance(card, dict):
            continue
        card_id = card.get("id")
        if not card_id:
            continue

        db = SessionLocal()
        try:
            card_exists = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
            already_generated = db.query(CharacterAvatar).filter(
                CharacterAvatar.character_card_id == card_id,
                CharacterAvatar.dialogue_id == dialogue_id,
                CharacterAvatar.source == "generated",
            ).first()
            if not card_exists or already_generated:
                continue
        finally:
            db.close()

        prompt = build_character_avatar_prompt(card, world_data)
        negative_prompt = build_character_avatar_negative(card)

        try:
            res = await comfyui_client.generate_image(
                prompt,
                negative_prompt,
                width=768,
                height=768,
                subfolder=f"avatars/characters/{card_id}",
                image_root=config.GALLERY_PATH,
                url_root="/gallery",
                filename_prefix="avatar",
            )
        except Exception as e:
            print(f"⚠️ [Avatars] Не удалось сгенерировать аватарку для {card.get('name')}: {e}")
            continue

        db = SessionLocal()
        try:
            db.add(CharacterAvatar(
                id=str(uuid.uuid4()),
                character_card_id=card_id,
                dialogue_id=dialogue_id,
                image_path=res["image_path"],
                prompt=res.get("prompt") or prompt,
                negative_prompt=res.get("negative_prompt") or negative_prompt,
                source="generated",
            ))
            db.commit()
            print(f"🖼️ [Avatars] Аватарка сохранена для {card.get('name')}: {res['image_path']}")
        except Exception as e:
            db.rollback()
            print(f"❌ [Avatars] Ошибка сохранения аватарки: {e}")
        finally:
            db.close()
