import json
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, relationship, DeclarativeBase, Session
from config import config

class Base(DeclarativeBase):
    pass

# --- НОВЫЕ ТАБЛИЦЫ ДЛЯ КАТАЛОГА ---
class WorldCard(Base):
    __tablename__ = "world_cards"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    history = Column(Text, default="")
    features = Column(Text, default="")
    appearance = Column(Text, default="")
    negative_prompt = Column(Text, default="")
    image_variants = Column(JSON, default=list)
    selected_image_index = Column(Integer, default=0)
    # Скрытое поле: промпт, которым была сгенерирована выбранная картинка карточки
    image_prompt = Column(Text, default="")
    image_negative_prompt = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class CharacterCard(Base):
    __tablename__ = "character_cards"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    appearance = Column(Text, default="")
    personality = Column(Text, default="")
    features = Column(Text, default="")
    negative_appearance = Column(Text, default="")
    negative_personality = Column(Text, default="")
    image_variants = Column(JSON, default=list)
    selected_image_index = Column(Integer, default=0)
    # Скрытое поле: промпт, которым была сгенерирована выбранная картинка карточки
    image_prompt = Column(Text, default="")
    image_negative_prompt = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Один-ко-многим: карточка используется в нескольких мирах (чатах) и имеет несколько аватарок
    dialogue_links = relationship("DialogueCharacter", back_populates="character_card", cascade="all, delete-orphan")
    avatars = relationship("CharacterAvatar", back_populates="character_card", cascade="all, delete-orphan")

# --- СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ ---
class Dialogue(Base):
    __tablename__ = "dialogues"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    settings = relationship("DialogueSettings", back_populates="dialogue", uselist=False, cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="dialogue", cascade="all, delete-orphan", order_by="Message.created_at")
    # Связи «мир (чат) ↔ карточки персонажей» и аватарки, созданные в рамках этого мира
    character_links = relationship("DialogueCharacter", back_populates="dialogue", cascade="all, delete-orphan")
    avatars = relationship("CharacterAvatar", back_populates="dialogue")

class DialogueSettings(Base):
    __tablename__ = "dialogue_settings"
    
    dialogue_id = Column(String, ForeignKey("dialogues.id"), primary_key=True)
    world_data = Column(JSON, default=dict) 
    character_cards = Column(JSON, default=list) 
    font_config = Column(JSON, default=lambda: {"narrator": "Cinzel, Georgia, serif", "user": "Inter, sans-serif", "hero": "Roboto, sans-serif", "sidekick": "Open Sans, sans-serif"})
    ai_controls_user = Column(Boolean, default=False)
    story_mode = Column(String, default="simple")
    world_state = Column(JSON, default=dict)
    # Индивидуальный аватар пользователя для этого мира (чата)
    user_avatar_path = Column(String, default="")
    # Выбранные аватарки персонажей: {character_card_id: character_avatar_id}
    selected_avatar_ids = Column(JSON, default=dict)
    dialogue = relationship("Dialogue", back_populates="settings")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True)
    dialogue_id = Column(String, ForeignKey("dialogues.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(JSON, default=list)
    original_user_text = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    image_variants = Column(JSON, default=list)
    selected_image_index = Column(Integer, default=0)
    has_image = Column(Boolean, default=False)
    image_prompt = Column(Text, nullable=True)
    debug_info = Column(JSON, default=dict)
    text_versions = Column(JSON, default=list)
    selected_version_index = Column(Integer, default=0)
    parent_id = Column(String, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dialogue = relationship("Dialogue", back_populates="messages")

# --- СВЯЗИ КАРТОЧЕК ПЕРСОНАЖЕЙ С МИРАМИ И АВАТАРКИ ---
class DialogueCharacter(Base):
    """Связь «мир (чат) ↔ карточка персонажа». Одна карточка — много миров."""
    __tablename__ = "dialogue_characters"

    dialogue_id = Column(String, ForeignKey("dialogues.id"), primary_key=True)
    character_card_id = Column(String, ForeignKey("character_cards.id"), primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dialogue = relationship("Dialogue", back_populates="character_links")
    character_card = relationship("CharacterCard", back_populates="dialogue_links")

class CharacterAvatar(Base):
    """Сгенерированная или загруженная вручную аватарка карточки персонажа."""
    __tablename__ = "character_avatars"

    id = Column(String, primary_key=True)
    character_card_id = Column(String, ForeignKey("character_cards.id"), nullable=False, index=True)
    # Мир (чат), в рамках которого получена аватарка. NULL — общая аватарка карточки
    dialogue_id = Column(String, ForeignKey("dialogues.id"), nullable=True, index=True)
    image_path = Column(String, nullable=False)
    prompt = Column(Text, default="")
    negative_prompt = Column(Text, default="")
    source = Column(String, default="generated")  # generated | upload
    created_at = Column(DateTime, default=datetime.utcnow)

    character_card = relationship("CharacterCard", back_populates="avatars")
    dialogue = relationship("Dialogue", back_populates="avatars")

class GeneratedImagePrompt(Base):
    """Скрытое хранилище промптов, использованных при генерации картинки.
    Ключ — путь файла в галерее, чтобы позже продублировать промпт в скрытое поле карточки."""
    __tablename__ = "image_prompts"

    image_path = Column(String, primary_key=True)
    prompt = Column(Text, default="")
    negative_prompt = Column(Text, default="")
    source = Column(String, default="comfyui_metadata")  # comfyui_metadata | request
    created_at = Column(DateTime, default=datetime.utcnow)

engine = create_engine(f"sqlite:///{config.DATABASE_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Простая миграция для существующих SQLite-БД: create_all не добавляет колонки в готовые таблицы
COLUMN_MIGRATIONS = {
    "world_cards": {"image_prompt": "TEXT", "image_negative_prompt": "TEXT"},
    "character_cards": {"image_prompt": "TEXT", "image_negative_prompt": "TEXT"},
    "dialogue_settings": {"user_avatar_path": "TEXT", "selected_avatar_ids": "JSON"},
}

def _apply_column_migrations():
    with engine.begin() as conn:
        for table, columns in COLUMN_MIGRATIONS.items():
            existing = {row[1] for row in conn.exec_driver_sql(f'PRAGMA table_info("{table}")')}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {ddl}')
                    print(f"🛠️ Добавлена колонка {table}.{name}")

def sync_dialogue_characters(db: Session, dialogue_id: str, character_cards: list) -> None:
    """Синхронизирует связи «мир (чат) ↔ карточки персонажей» по JSON-составу настроек."""
    card_ids = [
        card.get("id") for card in (character_cards or [])
        if isinstance(card, dict) and card.get("id")
    ]
    # Уникализируем с сохранением порядка
    card_ids = list(dict.fromkeys(card_ids))

    existing = {
        link.character_card_id
        for link in db.query(DialogueCharacter).filter(DialogueCharacter.dialogue_id == dialogue_id).all()
    }

    # Удаляем связи с карточками, которые больше не участвуют в мире
    for link in db.query(DialogueCharacter).filter(DialogueCharacter.dialogue_id == dialogue_id).all():
        if link.character_card_id not in card_ids:
            db.delete(link)

    # Добавляем новые связи (только для реально существующих карточек каталога)
    for card_id in card_ids:
        if card_id in existing:
            continue
        exists = db.query(CharacterCard).filter(CharacterCard.id == card_id).first()
        if exists:
            db.add(DialogueCharacter(dialogue_id=dialogue_id, character_card_id=card_id))

    db.commit()

def backfill_dialogue_characters(db: Session) -> None:
    """Восстанавливает связи для миров, созданных до появления таблицы связей."""
    for settings in db.query(DialogueSettings).all():
        sync_dialogue_characters(db, settings.dialogue_id, settings.character_cards)

def init_db():
    db_dir = os.path.dirname(config.DATABASE_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()

    db = SessionLocal()
    try:
        backfill_dialogue_characters(db)
    except Exception as e:
        db.rollback()
        print(f"⚠️ Не удалось восстановить связи персонажей: {e}")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()