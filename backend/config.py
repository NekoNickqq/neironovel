import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Ollama
    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "huihui_ai/gemma-4-abliterated:26b")
    OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))
    OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.8"))
    OLLAMA_TOP_P = float(os.getenv("OLLAMA_TOP_P", "0.9"))
    
    # ComfyUI
    COMFYUI_URL = os.getenv("COMFYUI_URL", "http://192.168.1.107:1215")
    COMFYUI_WORKFLOW = os.getenv("COMFYUI_WORKFLOW", "workflow.json")
    COMFYUI_TIMEOUT = int(os.getenv("COMFYUI_TIMEOUT", "180"))
    
    # Database
    DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/novel.db")
    
    # Storage
    GALLERY_PATH = os.getenv("GALLERY_PATH", "./gallery")
    AVATARS_PATH = os.getenv("AVATARS_PATH", "./avatars")
    
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))

config = Config()
