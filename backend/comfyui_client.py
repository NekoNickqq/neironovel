import httpx
import json
import asyncio
import os
from typing import Optional
from config import config
from utils import clean_dict_keys, generate_seed

class ComfyUIClient:
    def __init__(self):
        self.url = config.COMFYUI_URL
        self.workflow_path = config.COMFYUI_WORKFLOW
        self.timeout = config.COMFYUI_TIMEOUT
        self.gallery_path = config.GALLERY_PATH
        
        # Загружаем workflow
        self.workflow = self._load_workflow()
    
    def _load_workflow(self) -> dict:
        """Загружает и очищает workflow от пробелов в ключах"""
        try:
            with open(self.workflow_path, 'r', encoding='utf-8') as f:
                workflow = json.load(f)
            return clean_dict_keys(workflow)
        except FileNotFoundError:
            raise Exception(f"Workflow file not found: {self.workflow_path}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid workflow JSON: {e}")
    
    async def generate_image(self, prompt: str, seed: Optional[int] = None) -> str:
        """
        Генерирует изображение через ComfyUI.
        
        Args:
            prompt: Позитивный промпт для генерации
            seed: Seed для воспроизводимости (если None — генерируется случайно)
        
        Returns:
            Путь к сохранённому изображению
        """
        # Создаём копию workflow
        workflow = json.loads(json.dumps(self.workflow))
        
        # Подставляем промпт в узел "21" (positive CLIPTextEncode)
        if "21" in workflow:
            workflow["21"]["inputs"]["text"] = prompt
        
        # Рандомизируем seed в узле "99" (KSampler)
        if "99" in workflow:
            workflow["99"]["inputs"]["seed"] = seed or generate_seed()
        
        # Отправляем запрос на генерацию
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                # Queue prompt
                response = await client.post(
                    f"{self.url}/prompt",
                    json={"prompt": workflow}
                )
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as e:
                    raise Exception(
                        f"ComfyUI rejected the request (HTTP {e.response.status_code}): "
                        f"{e.response.text[:200]}"
                    )
                result = response.json()
                prompt_id = result.get("prompt_id")
                
                if not prompt_id:
                    raise Exception("No prompt_id in response")
                
                # Poll for completion
                image_path = await self._wait_for_completion(prompt_id)
                return image_path
                
            except httpx.TimeoutException:
                raise Exception(f"ComfyUI timeout after {self.timeout}s (server did not respond)")
            except httpx.ConnectError:
                raise Exception(f"Cannot connect to ComfyUI at {self.url} — is the server running?")
            except httpx.HTTPError as e:
                raise Exception(f"ComfyUI HTTP error: {e}")
    
    async def _wait_for_completion(self, prompt_id: str) -> str:
        """Ожидает завершения генерации и возвращает путь к изображению"""
        start_time = asyncio.get_event_loop().time()
        
        async with httpx.AsyncClient(timeout=10) as client:
            while True:
                # Проверяем таймаут
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > self.timeout:
                    raise Exception(
                        f"Generation timeout after {self.timeout}s — ComfyUI did not finish the job"
                    )
                
                # Запрашиваем историю
                try:
                    response = await client.get(f"{self.url}/history/{prompt_id}")
                    if response.status_code == 200:
                        data = response.json()
                        
                        if prompt_id in data:
                            history = data[prompt_id]
                            outputs = history.get("outputs", {})
                            
                            # Ищем узел с изображениями (обычно "33" - PreviewImage)
                            for node_id, node_output in outputs.items():
                                if "images" in node_output:
                                    images = node_output["images"]
                                    if images:
                                        img_info = images[0]
                                        filename = img_info["filename"]
                                        img_type = img_info.get("type", "output")
                                        subfolder = img_info.get("subfolder", "")
                                        
                                        # Скачиваем изображение
                                        image_data = await self._download_image(filename, img_type, subfolder)
                                        
                                        # Сохраняем в gallery
                                        saved_path = await self._save_image(image_data, prompt_id)
                                        return saved_path

                            # Задача завершена, но изображений в outputs нет
                            status = history.get("status")
                            if isinstance(status, dict) and status.get("status_str") == "error":
                                raise Exception(f"ComfyUI workflow error: {json.dumps(status)[:300]}")
                
                except httpx.HTTPError:
                    pass  # Продолжаем опрос
                
                # Ждём 1 секунду перед следующим опросом
                await asyncio.sleep(1)
    
    async def _download_image(self, filename: str, img_type: str, subfolder: str) -> bytes:
        """Скачивает изображение из ComfyUI"""
        async with httpx.AsyncClient(timeout=30) as client:
            params = {
                "filename": filename,
                "type": img_type,
                "subfolder": subfolder
            }
            response = await client.get(f"{self.url}/view", params=params)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise Exception(f"Failed to download generated image (HTTP {e.response.status_code})")
            return response.content
    
    async def _save_image(self, image_data: bytes, prompt_id: str) -> str:
        """Сохраняет изображение в gallery"""
        os.makedirs(self.gallery_path, exist_ok=True)
        filename = f"scene_{prompt_id}.png"
        filepath = os.path.join(self.gallery_path, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        # Возвращаем относительный путь для фронтенда
        return f"/gallery/{filename}"
    
    async def is_available(self) -> bool:
        """Проверяет доступность ComfyUI"""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.url}/system_stats")
                return response.status_code == 200
        except:
            return False

comfyui_client = ComfyUIClient()
