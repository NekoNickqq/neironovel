"""
Runtime-настройки подключения к Ollama.

Поддерживаются два режима:
  - "local": локальный сервер Ollama (OLLAMA_URL), список моделей берётся из /api/tags,
             можно выбрать любую уже загруженную локальную модель;
  - "api":   внешнее OpenAI-совместимое API (например ollama.com или провайдер LLM)
             с авторизацией по API-ключу (Authorization: Bearer <key>).

Настройки хранятся в data/ollama_settings.json и могут меняться через API
без перезапуска сервера. Значения по умолчанию берутся из .env / config.py.
"""

import json
import os
import threading
from typing import List, Optional

from config import config

SETTINGS_FILE = os.path.join(
    os.path.dirname(os.path.abspath(config.DATABASE_PATH)), "ollama_settings.json"
)

DEFAULT_SETTINGS = {
    "mode": "local",  # "local" | "api"
    "ollama_url": config.OLLAMA_URL,  # базовый URL локального Ollama
    "api_base_url": config.OLLAMA_API_BASE_URL,  # внешний API
    "api_key": config.OLLAMA_API_KEY,  # API-ключ для внешнего режима
    "model_local": config.OLLAMA_MODEL,  # модель для локального режима
    "model_api": config.OLLAMA_API_MODEL,  # модель для внешнего режима
}


class OllamaSettings:
    def __init__(self):
        self._lock = threading.Lock()
        self._data = dict(DEFAULT_SETTINGS)
        self.load()

    def load(self):
        try:
            if os.path.exists(SETTINGS_FILE):
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    stored = json.load(f)
                if isinstance(stored, dict):
                    self._data.update({k: v for k, v in stored.items() if k in DEFAULT_SETTINGS})
        except Exception as e:
            print(f"⚠️ Failed to load Ollama settings: {e}")

    def save(self):
        try:
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ Failed to save Ollama settings: {e}")

    def get_all(self) -> dict:
        with self._lock:
            return dict(self._data)

    @property
    def mode(self) -> str:
        return self.get_all().get("mode", "local")

    @property
    def base_url(self) -> str:
        """Активный базовый URL в зависимости от режима."""
        d = self.get_all()
        if d.get("mode") == "api":
            return (d.get("api_base_url") or DEFAULT_SETTINGS["api_base_url"]).rstrip("/")
        return (d.get("ollama_url") or DEFAULT_SETTINGS["ollama_url"]).rstrip("/")

    @property
    def model(self) -> str:
        """Активная модель в зависимости от режима."""
        d = self.get_all()
        if d.get("mode") == "api":
            return d.get("model_api") or DEFAULT_SETTINGS["model_api"]
        return d.get("model_local") or DEFAULT_SETTINGS["model_local"]

    @property
    def api_key(self) -> str:
        """API-ключ (только для режима 'api')."""
        d = self.get_all()
        if d.get("mode") == "api":
            return d.get("api_key") or ""
        return ""

    def update(self, values: dict) -> dict:
        """Обновляет переданные поля настроек и сохраняет их."""
        with self._lock:
            for key in DEFAULT_SETTINGS:
                if key in values and values[key] is not None:
                    self._data[key] = str(values[key]).strip()
            # Валидация режима
            if self._data["mode"] not in ("local", "api"):
                self._data["mode"] = "local"
            self.save()
            return dict(self._data)


ollama_settings = OllamaSettings()
