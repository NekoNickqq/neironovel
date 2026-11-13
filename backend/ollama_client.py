import httpx
import json
import asyncio
from typing import List, Dict, Optional
from config import config
from ollama_settings import ollama_settings
from utils import extract_json_from_text

class OllamaClient:
    def __init__(self):
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.top_p = config.OLLAMA_TOP_P

    @property
    def mode(self) -> str: return ollama_settings.mode
    @property
    def url(self) -> str: return ollama_settings.base_url
    @property
    def model(self) -> str: return ollama_settings.model
    @property
    def api_key(self) -> str: return ollama_settings.api_key

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.mode == "api" and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _check_loop(self, text: str) -> bool:
        """Проверяет, не началось ли зацикливание (повторение текста)"""
        if len(text) < 300:
            return False
        # Берем последние 100 символов
        chunk = text[-100:]
        # Если этот же кусок был 200 символов назад и 300 символов назад — это цикл
        if text[-200:-100] == chunk and text[-300:-200] == chunk:
            return True
        return False

    async def chat(self, messages: List[Dict[str, str]], system_prompt: str, temperature: Optional[float] = None, top_p: Optional[float] = None, model: Optional[str] = None) -> Dict:
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        use_model = model or self.model
        options = {"temperature": temperature or self.temperature, "top_p": top_p or self.top_p}

        thinking_text = ""
        content = ""

        if self.mode == "api":
            content = await self._chat_openai_compatible(full_messages, use_model, options)
        else:
            content, thinking_text = await self._chat_native_stream(full_messages, use_model, options)

        try:
            parsed = extract_json_from_text(content)
        except Exception as e:
            # Если парсинг не удался (например, оборвалось из-за цикла), возвращаем сырой текст
            parsed = {"blocks": [{"speaker": "narrator", "text": content}], "image_prompt": ""}
            
        if not parsed.get("blocks"):
            parsed["blocks"] = [{"speaker": "narrator", "text": content}]

        image_prompt = parsed.get("image_prompt") or ""
        if isinstance(image_prompt, dict): image_prompt = image_prompt.get("prompt", "") or ""
        parsed["image_prompt"] = str(image_prompt).strip()

        return {"parsed": parsed, "raw": content, "thinking": thinking_text}

    async def _chat_native_stream(self, full_messages: List[Dict[str, str]], model: str, options: Dict) -> tuple[str, str]:
        payload = {
            "model": model,
            "messages": full_messages,
            "stream": True, # ВКЛЮЧАЕМ СТРИМИНГ ДЛЯ ДЕТЕКЦИИ ЦИКЛОВ
            "format": "json",
            "options": options,
        }

        content = ""
        thinking = ""

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", f"{self.url}/api/chat", json=payload, headers=self._headers()) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line: continue
                        data = json.loads(line)
                        msg = data.get("message", {})
                        
                        # Собираем thinking (если есть)
                        if msg.get("thinking"):
                            thinking += msg["thinking"]
                        
                        # Собираем контент
                        if msg.get("content"):
                            content += msg["content"]
                            # ПРОВЕРКА НА ЗАЦИКЛИВАНИЕ
                            if self._check_loop(content):
                                print("⚠️ Loop detected in Ollama! Aborting generation.")
                                # Принудительно рвем соединение
                                await response.aclose()
                                raise Exception("Model generation loop detected. Aborted.")
                        
                        if data.get("done"):
                            break
                return content, thinking
            except httpx.TimeoutException:
                raise Exception(f"Ollama timeout after {self.timeout}s")
            except httpx.HTTPError as e:
                raise Exception(f"Ollama HTTP error: {e}")

    async def _chat_openai_compatible(self, full_messages, model, options) -> str:
        # Оставляем без изменений (стриминг для API не критичен для локальных нужд)
        if not self.api_key: raise Exception("API key is not set")
        payload = {
            "model": model, "messages": full_messages, "stream": False,
            "response_format": {"type": "json_object"}, "temperature": options.get("temperature"), "top_p": options.get("top_p"),
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(f"{self.url}/v1/chat/completions", json=payload, headers=self._headers())
                response.raise_for_status()
                data = response.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
            except httpx.HTTPError as e:
                raise Exception(f"Ollama API HTTP error: {e}")

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                if self.mode == "api":
                    if not self.api_key: return False
                    response = await client.get(f"{self.url}/v1/models", headers=self._headers())
                    return response.status_code == 200
                else:
                    response = await client.get(f"{self.url}/api/tags")
                    return response.status_code == 200
        except Exception: return False

    async def list_models(self) -> List[str]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if self.mode == "api":
                    response = await client.get(f"{self.url}/v1/models", headers=self._headers())
                    response.raise_for_status()
                    return sorted(m["id"] for m in response.json().get("data", []) if "id" in m)
                else:
                    response = await client.get(f"{self.url}/api/tags")
                    response.raise_for_status()
                    return [m["name"] for m in response.json().get("models", [])]
        except Exception: return []

ollama_client = OllamaClient()