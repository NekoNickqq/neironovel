import json
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, relationship, DeclarativeBase
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
    created_at = Column(DateTime, default=datetime.utcnow)

# --- СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ ---
class Dialogue(Base):
    __tablename__ = "dialogues"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    settings = relationship("DialogueSettings", back_populates="dialogue", uselist=False, cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="dialogue", cascade="all, delete-orphan", order_by="Message.created_at")

class DialogueSettings(Base):
    __tablename__ = "dialogue_settings"
    
    dialogue_id = Column(String, ForeignKey("dialogues.id"), primary_key=True)
    # Теперь здесь храним JSON-снимок (snapshot) выбранного мира
    world_data = Column(JSON, default=dict) 
    # И JSON-массив выбранных персонажей
    character_cards = Column(JSON, default=list) 
    font_config = Column(JSON, default=lambda: {"narrator": "Cinzel, Georgia, serif", "user": "Inter, sans-serif", "hero": "Roboto, sans-serif", "sidekick": "Open Sans, sans-serif"})
    ai_controls_user = Column(Boolean, default=False)
    story_mode = Column(String, default="simple")
    
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

engine = create_engine(f"sqlite:///{config.DATABASE_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    db_dir = os.path.dirname(config.DATABASE_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()