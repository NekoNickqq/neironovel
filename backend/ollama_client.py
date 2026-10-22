import httpx
import json
from typing import List, Dict, Optional
from config import config
from utils import extract_json_from_text, build_system_prompt

class OllamaClient:
    def __init__(self):
        self.url = config.OLLAMA_URL
        self.model = config.OLLAMA_MODEL
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.top_p = config.OLLAMA_TOP_P
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None
    ) -> Dict:
        """
        Отправляет запрос в Ollama и возвращает распарсенный JSON ответ.
        
        Args:
            messages: История диалога [{role, content}]
            system_prompt: Системный промпт
            temperature: Температура генерации
            top_p: Top-p параметр
        
        Returns:
            Dict с полями blocks и image_prompt
        """
        full_messages = [
            {"role": "system", "content": system_prompt}
        ] + messages
        
        payload = {
            "model": self.model,
            "messages": full_messages,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature or self.temperature,
                "top_p": top_p or self.top_p
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.url}/api/chat",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                # Извлекаем контент ответа
                content = data.get("message", {}).get("content", "")
                
                # Парсим JSON из ответа
                parsed = extract_json_from_text(content)
                
                # Валидация структуры
                if "blocks" not in parsed:
                    parsed["blocks"] = [{"speaker": "narrator", "text": content}]
                if "image_prompt" not in parsed:
                    parsed["image_prompt"] = ""
                
                return parsed
                
            except httpx.TimeoutException:
                raise Exception(f"Ollama timeout after {self.timeout}s")
            except httpx.HTTPError as e:
                raise Exception(f"Ollama HTTP error: {e}")
            except Exception as e:
                raise Exception(f"Ollama error: {e}")
    
    async def is_available(self) -> bool:
        """Проверяет доступность Ollama"""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.url}/api/tags")
                return response.status_code == 200
        except:
            return False
    
    async def list_models(self) -> List[str]:
        """Возвращает список доступных моделей"""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.url}/api/tags")
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except:
            return []

ollama_client = OllamaClient()
