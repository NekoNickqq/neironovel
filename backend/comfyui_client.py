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
        self.workflow = self._load_workflow()
    
    def _load_workflow(self) -> dict:
        try:
            with open(self.workflow_path, 'r', encoding='utf-8') as f:
                workflow = json.load(f)
            return clean_dict_keys(workflow)
        except Exception as e:
            raise Exception(f"Workflow load error: {e}")
    
    async def generate_image(self, prompt: str, negative_prompt: str = "", seed: Optional[int] = None, width: int = 1280, height: int = 720, subfolder: str = "", image_root: Optional[str] = None, url_root: str = "/gallery", filename_prefix: str = "scene") -> dict:
        """Генерирует картинку и возвращает путь + использованные промпты.

        image_root/url_root позволяют сохранять не в gallery (например, в avatars/),
        filename_prefix задаёт префикс имени файла (scene_/avatar_).
        """
        workflow = json.loads(json.dumps(self.workflow))
        
        if "21" in workflow: 
            workflow["21"]["inputs"]["text"] = prompt
            
        if "20" in workflow:
            workflow["20"]["inputs"]["text"] = negative_prompt
                
        if "5" in workflow:
            workflow["5"]["inputs"]["width"] = width
            workflow["5"]["inputs"]["height"] = height

        used_seed = seed or generate_seed()
        if "99" in workflow: 
            workflow["99"]["inputs"]["seed"] = used_seed
        
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(f"{self.url}/prompt", json={"prompt": workflow})
                response.raise_for_status()
                prompt_id = response.json().get("prompt_id")
                if not prompt_id: raise Exception("No prompt_id in response")
                
                # Передаем subfolder/каталог сохранения в ожидание и сохранение
                image_path, meta = await self._wait_for_completion(
                    prompt_id,
                    subfolder=subfolder,
                    image_root=image_root,
                    url_root=url_root,
                    filename_prefix=filename_prefix,
                    expected_prompt=prompt,
                    expected_negative=negative_prompt,
                )
                return {
                    "image_path": image_path,
                    "prompt_id": prompt_id,
                    "seed": used_seed,
                    # Промпт из PNG-метаданных ComfyUI, с фолбэком на отправленный
                    "prompt": meta.get("prompt") or prompt,
                    "negative_prompt": meta.get("negative_prompt") or negative_prompt,
                    "prompt_source": meta.get("source", "request"),
                }
            except httpx.HTTPError as e:
                raise Exception(f"ComfyUI HTTP error: {e}")

    async def interrupt(self):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(f"{self.url}/interrupt")
        except Exception as e:
            print(f"Failed to interrupt ComfyUI: {e}")
    
    async def _wait_for_completion(self, prompt_id: str, subfolder: str = "", image_root: Optional[str] = None, url_root: str = "/gallery", filename_prefix: str = "scene", expected_prompt: str = "", expected_negative: str = "") -> tuple[str, dict]:
        start_time = asyncio.get_event_loop().time()
        async with httpx.AsyncClient(timeout=10) as client:
            while True:
                if asyncio.get_event_loop().time() - start_time > self.timeout:
                    raise Exception(f"Generation timeout after {self.timeout}s")
                
                try:
                    response = await client.get(f"{self.url}/history/{prompt_id}")
                    if response.status_code == 200:
                        data = response.json()
                        if prompt_id in data:
                            outputs = data[prompt_id].get("outputs", {})
                            for node_id, node_output in outputs.items():
                                if "images" in node_output:
                                    images = node_output["images"]
                                    if images:
                                        img_info = images[0]
                                        image_data = await self._download_image(img_info["filename"], img_info.get("type", "output"), img_info.get("subfolder", ""))
                                        return await self._save_image(
                                            image_data, prompt_id, subfolder,
                                            image_root=image_root,
                                            url_root=url_root,
                                            filename_prefix=filename_prefix,
                                            expected_prompt=expected_prompt,
                                            expected_negative=expected_negative,
                                        )
                except httpx.HTTPError: pass
                await asyncio.sleep(1)
    
    async def _download_image(self, filename: str, img_type: str, subfolder: str) -> bytes:
        async with httpx.AsyncClient(timeout=30) as client:
            params = {"filename": filename, "type": img_type, "subfolder": subfolder}
            response = await client.get(f"{self.url}/view", params=params)
            response.raise_for_status()
            return response.content
    
    async def _save_image(self, image_data: bytes, prompt_id: str, subfolder: str, image_root: Optional[str] = None, url_root: str = "/gallery", filename_prefix: str = "scene", expected_prompt: str = "", expected_negative: str = "") -> tuple[str, dict]:
        # Формируем полный путь с учетом подпапки и корня (gallery по умолчанию, avatars для аватарок)
        base_root = image_root or self.gallery_path
        target_dir = os.path.join(base_root, subfolder) if subfolder else base_root
        os.makedirs(target_dir, exist_ok=True)
        
        filename = f"{filename_prefix}_{prompt_id}.png"
        filepath = os.path.join(target_dir, filename)
        
        with open(filepath, 'wb') as f: 
            f.write(image_data)

        # Использованный промпт берём из PNG-метаданных ComfyUI
        meta = self._extract_prompt_metadata(filepath, expected_prompt, expected_negative)
        
        # Формируем корректный URL для БД (убираем возможные двойные слеши)
        clean_subfolder = subfolder.strip("/")
        clean_root = (url_root or "/gallery").rstrip("/")
        if clean_subfolder:
            return f"{clean_root}/{clean_subfolder}/{filename}", meta
        return f"{clean_root}/{filename}", meta

    @staticmethod
    def _extract_prompt_metadata(filepath: str, expected_prompt: str = "", expected_negative: str = "") -> dict:
        """Достаёт использованные промпты из PNG-метаданных ComfyUI.

        ComfyUI пишет JSON-узлы графа в текстовый чанк PNG: Image.open(path).info["prompt"].
        Если Pillow не установлен — чанк читается вручную (tEXt/zTXt/iTXt).
        """
        raw_meta = ComfyUIClient._read_png_prompt_chunk(filepath)
        if not raw_meta:
            return {}

        try:
            graph = json.loads(raw_meta) if isinstance(raw_meta, str) else raw_meta
        except Exception:
            return {}
        if not isinstance(graph, dict):
            return {}

        # Тексты всех узлов CLIPTextEncode: {"21": "...", "20": "..."} в нашем workflow
        texts: dict[str, str] = {}
        for node_id, node in graph.items():
            if not isinstance(node, dict) or node.get("class_type") != "CLIPTextEncode":
                continue
            text = (node.get("inputs") or {}).get("text")
            if isinstance(text, str) and text.strip():
                texts[str(node_id)] = text

        positive = texts.get("21", "")
        negative = texts.get("20", "")

        # Если id узлов другие — сверяем с тем, что отправляли в ComfyUI
        for text in texts.values():
            if expected_prompt and text.strip() == expected_prompt.strip():
                positive = text
            if expected_negative and text.strip() == expected_negative.strip():
                negative = text

        return {
            "prompt": positive,
            "negative_prompt": negative,
            "source": "png_metadata" if (positive or negative) else "request",
        }

    @staticmethod
    def _read_png_prompt_chunk(filepath: str) -> Optional[str]:
        """Возвращает значение текстового чанка "prompt" из PNG (через PIL или ручной парсинг)."""
        try:
            from PIL import Image  # Pillow — предпочтительный путь
            with Image.open(filepath) as img:
                value = img.info.get("prompt")
            if value:
                return value if isinstance(value, str) else json.dumps(value)
        except ImportError:
            pass
        except Exception as e:
            print(f"⚠️ PIL не смог прочитать метаданные {filepath}: {e}")

        # Ручной парсинг чанков PNG (tEXt / zTXt / iTXt)
        try:
            import struct
            import zlib
            with open(filepath, "rb") as fh:
                if fh.read(8) != b"\x89PNG\r\n\x1a\n":
                    return None
                while True:
                    header = fh.read(8)
                    if len(header) < 8:
                        return None
                    length, chunk_type = struct.unpack(">I4s", header)
                    payload = fh.read(length)
                    fh.read(4)  # CRC
                    if chunk_type == b"tEXt":
                        key, _, value = payload.partition(b"\x00")
                        if key == b"prompt":
                            return value.decode("utf-8", errors="replace")
                    elif chunk_type == b"zTXt":
                        key, _, rest = payload.partition(b"\x00")
                        if key == b"prompt" and len(rest) > 1:
                            return zlib.decompress(rest[1:]).decode("utf-8", errors="replace")
                    elif chunk_type == b"iTXt":
                        key, _, rest = payload.partition(b"\x00")
                        if key == b"prompt":
                            compressed = rest[0]
                            body = rest[2:]
                            _, _, body = body.partition(b"\x00")       # language tag
                            _, _, text = body.partition(b"\x00")       # translated keyword
                            if compressed:
                                text = zlib.decompress(text)
                            return text.decode("utf-8", errors="replace")
                    elif chunk_type == b"IEND":
                        return None
        except Exception as e:
            print(f"⚠️ Не удалось извлечь prompt из PNG {filepath}: {e}")
            return None
    
    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.url}/system_stats")
                return response.status_code == 200
        except Exception: return False

comfyui_client = ComfyUIClient()