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
    
    async def generate_image(self, prompt: str, seed: Optional[int] = None) -> dict:
        workflow = json.loads(json.dumps(self.workflow))
        if "21" in workflow: workflow["21"]["inputs"]["text"] = prompt
        used_seed = seed or generate_seed()
        if "99" in workflow: workflow["99"]["inputs"]["seed"] = used_seed
        
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(f"{self.url}/prompt", json={"prompt": workflow})
                response.raise_for_status()
                prompt_id = response.json().get("prompt_id")
                if not prompt_id: raise Exception("No prompt_id in response")
                
                image_path = await self._wait_for_completion(prompt_id)
                return {"image_path": image_path, "prompt_id": prompt_id, "seed": used_seed}
            except httpx.HTTPError as e:
                raise Exception(f"ComfyUI HTTP error: {e}")

    async def interrupt(self):
        """Посылает сигнал в ComfyUI прервать текущую генерацию"""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(f"{self.url}/interrupt")
        except Exception as e:
            print(f"Failed to interrupt ComfyUI: {e}")
    
    async def _wait_for_completion(self, prompt_id: str) -> str:
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
                                        return await self._save_image(image_data, prompt_id)
                except httpx.HTTPError: pass
                await asyncio.sleep(1)
    
    async def _download_image(self, filename: str, img_type: str, subfolder: str) -> bytes:
        async with httpx.AsyncClient(timeout=30) as client:
            params = {"filename": filename, "type": img_type, "subfolder": subfolder}
            response = await client.get(f"{self.url}/view", params=params)
            response.raise_for_status()
            return response.content
    
    async def _save_image(self, image_data: bytes, prompt_id: str) -> str:
        os.makedirs(self.gallery_path, exist_ok=True)
        filename = f"scene_{prompt_id}.png"
        filepath = os.path.join(self.gallery_path, filename)
        with open(filepath, 'wb') as f: f.write(image_data)
        return f"/gallery/{filename}"
    
    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.url}/system_stats")
                return response.status_code == 200
        except Exception: return False

comfyui_client = ComfyUIClient()