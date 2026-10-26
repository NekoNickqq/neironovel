import httpx
import json
from typing import List, Dict, Optional
from config import config
from ollama_settings import ollama_settings
from utils import extract_json_from_text, build_system_prompt


class OllamaClient:
    """
    Клиент Ollama с поддержкой двух режимов подключения:
      - local: локальный сервер Ollama (нативный /api/chat, список моделей из /api/tags)
      - api:   внешнее OpenAI-совместимое API с авторизацией по API-ключу
               (chat/completions, Bearer token)
    Модель, URL и ключ берутся из ollama_settings (можно менять через API без рестарта).
    """

    def __init__(self):
        # Статические параметры генерации (из .env)
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.top_p = config.OLLAMA_TOP_P

    # ---------- Вспомогательные свойства ----------

    @property
    def mode(self) -> str:
        return ollama_settings.mode

    @property
    def url(self) -> str:
        return ollama_settings.base_url

    @property
    def model(self) -> str:
        return ollama_settings.model

    @property
    def api_key(self) -> str:
        return ollama_settings.api_key

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.mode == "api" and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    # ---------- Основной метод ----------

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """
        Отправляет запрос в Ollama (локально или через внешний API)
        и возвращает распарсенный JSON ответ.

        Args:
            messages: История диалога [{role, content}]
            system_prompt: Системный промпт
            temperature: Температура генерации
            top_p: Top-p параметр
            model: Необязательное переопределение модели для этого запроса

        Returns:
            Dict с полями blocks и image_prompt
        """
        full_messages = [
            {"role": "system", "content": system_prompt}
        ] + messages

        use_model = model or self.model
        options = {
            "temperature": temperature or self.temperature,
            "top_p": top_p or self.top_p,
        }

        if self.mode == "api":
            content = await self._chat_openai_compatible(full_messages, use_model, options)
        else:
            content = await self._chat_native(full_messages, use_model, options)

        try:
            # Парсим JSON из ответа
            parsed = extract_json_from_text(content)

            # Валидация структуры
            if "blocks" not in parsed:
                parsed["blocks"] = [{"speaker": "narrator", "text": content}]
            if "image_prompt" not in parsed:
                parsed["image_prompt"] = ""

            return parsed
        except Exception as e:
            raise Exception(f"Ollama error: {e}")

    async def _chat_native(
        self,
        full_messages: List[Dict[str, str]],
        model: str,
        options: Dict,
    ) -> str:
        """Запрос к нативному API локального Ollama (/api/chat)."""
        payload = {
            "model": model,
            "messages": full_messages,
            "stream": False,
            "format": "json",
            "options": options,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.url}/api/chat",
                    json=payload,
                    headers=self._headers(),
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
            except httpx.TimeoutException:
                raise Exception(f"Ollama timeout after {self.timeout}s")
            except httpx.HTTPError as e:
                raise Exception(f"Ollama HTTP error: {e}")

    async def _chat_openai_compatible(
        self,
        full_messages: List[Dict[str, str]],
        model: str,
        options: Dict,
    ) -> str:
        """Запрос к OpenAI-совместимому API (chat/completions) с API-ключом."""
        if not self.api_key:
            raise Exception("API key is not set for external Ollama API mode")

        payload = {
            "model": model,
            "messages": full_messages,
            "stream": False,
            "response_format": {"type": "json_object"},
            "temperature": options.get("temperature"),
            "top_p": options.get("top_p"),
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.url}/v1/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )
                response.raise_for_status()
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise Exception("Empty response from API")
                return choices[0].get("message", {}).get("content", "")
            except httpx.TimeoutException:
                raise Exception(f"Ollama API timeout after {self.timeout}s")
            except httpx.HTTPStatusError as e:
                body = ""
                try:
                    body = e.response.text[:300]
                except Exception:
                    pass
                raise Exception(f"Ollama API HTTP error: {e} {body}")
            except httpx.HTTPError as e:
                raise Exception(f"Ollama API HTTP error: {e}")

    # ---------- Service discovery ----------

    async def is_available(self) -> bool:
        """Проверяет доступность активного подключения к Ollama."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                if self.mode == "api":
                    if not self.api_key:
                        return False
                    response = await client.get(
                        f"{self.url}/v1/models", headers=self._headers()
                    )
                    return response.status_code == 200
                else:
                    response = await client.get(f"{self.url}/api/tags")
                    return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> List[str]:
        """Возвращает список доступных моделей активного подключения."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if self.mode == "api":
                    response = await client.get(
                        f"{self.url}/v1/models", headers=self._headers()
                    )
                    response.raise_for_status()
                    data = response.json()
                    return sorted(m["id"] for m in data.get("data", []) if "id" in m)
                else:
                    response = await client.get(f"{self.url}/api/tags")
                    response.raise_for_status()
                    data = response.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []


ollama_client = OllamaClient()
