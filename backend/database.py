import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from config import config

Base = declarative_base()

class Dialogue(Base):
    __tablename__ = "dialogues"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    settings = relationship("DialogueSettings", back_populates="dialogue", uselist=False, cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="dialogue", cascade="all, delete-orphan", order_by="Message.created_at")

class DialogueSettings(Base):
    __tablename__ = "dialogue_settings"
    
    dialogue_id = Column(String, ForeignKey("dialogues.id"), primary_key=True)
    world_lore = Column(Text, default="")
    character_cards = Column(JSON, default=list)  # [{name, description, avatar_path, color}]
    style_preset = Column(String, default="dark fantasy, cinematic lighting, masterpiece, best quality, 8k")
    font_config = Column(JSON, default=lambda: {
        "narrator": "Cinzel, Georgia, serif",
        "user": "Inter, sans-serif",
        "hero": "Roboto, sans-serif",
        "sidekick": "Open Sans, sans-serif"
    })
    ai_controls_user = Column(Boolean, default=False)
    
    # Relationship
    dialogue = relationship("Dialogue", back_populates="settings")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True)
    dialogue_id = Column(String, ForeignKey("dialogues.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(JSON, default=list)  # Array of {speaker, text}
    original_user_text = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    image_variants = Column(JSON, default=list)  # Array of image paths
    selected_image_index = Column(Integer, default=0)
    has_image = Column(Boolean, default=False)
    text_versions = Column(JSON, default=list)  # Array of content versions
    selected_version_index = Column(Integer, default=0)
    parent_id = Column(String, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    dialogue = relationship("Dialogue", back_populates="messages")

# Database setup
engine = create_engine(f"sqlite:///{config.DATABASE_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Create all tables"""
    import os
    os.makedirs(os.path.dirname(config.DATABASE_PATH), exist_ok=True)
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
