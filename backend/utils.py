import re
import json
import random
from typing import Any, Dict

def clean_dict_keys(obj: Any) -> Any:
    """Рекурсивно очищает ключи словаря от пробелов в конце."""
    if isinstance(obj, dict):
        return {k.strip(): clean_dict_keys(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_dict_keys(item) for item in obj]
    else:
        return obj

def extract_json_from_text(text: str) -> dict:
    """Извлекает JSON из текста ответа Ollama."""
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    
    start = text.find('{')
    end = text.rfind('}')
    
    if start == -1 or end == -1:
        raise ValueError("JSON not found in response")
    
    json_str = text[start:end + 1]
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        json_str = json_str.replace("'", '"')
        try:
            return json.loads(json_str)
        except:
            raise ValueError(f"Failed to parse JSON: {e}\nOriginal text: {text[:500]}")

def generate_seed() -> int:
    """Генерирует случайный seed для ComfyUI"""
    return random.randint(0, 2**32 - 1)

def build_system_prompt(world_lore: str, character_cards: list, style_preset: str, ai_controls_user: bool) -> str:
    """Формирует системный промпт для Ollama с улучшенными правилами визуализации."""
    
    chars_text = ""
    for char in character_cards:
        chars_text += f"- {char['name']}: {char['description']}\n"
    
    user_instruction = ""
    if ai_controls_user:
        user_instruction = """
ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.
Если пользователь написал простое действие, преврати его в художественное описание.
"""
    
    prompt = f"""Ты — мастер интерактивных визуальных новелл и опытный промпт-инженер для нейросетей-художников (Stable Diffusion).
Твоя задача: вести повествование и генерировать точные визуальные промпты (image_prompt) на английском языке для каждой сцены.

КОНТЕКСТ МИРА:
{world_lore}

ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей. Создавай по мере необходимости."}

СТИЛЬ ИЗОБРАЖЕНИЙ: {style_preset}
{user_instruction}
ПРАВИЛА НАРРАТИВА (для поля blocks):
1. Отвечай СТРОГО в формате JSON (без markdown, без пояснений).
2. Массив blocks содержит реплики персонажей и описания нарратива.
3. speaker может быть: "narrator", "hero", "sidekick", "user".
4. narrator описывает окружение, действия, атмосферу (используй *звёздочки* для действий).

КРИТИЧЕСКИЕ ПРАВИЛА ДЛЯ IMAGE_PROMPT (нейросеть-художник не знает контекста, она видит только этот промпт):
1. Язык: Английский. 
2. НИКАКИХ ИМЁН: В промпте запрещено использовать имена (Каэль, Лира). Заменяй их на детальное описание внешности из карточек персонажей (например: "silver-haired dark mage in black cloak", "elven archer with green eyes").
3. ФОКУС НА ДЕЙСТВИИ: Если в сцене персонаж совершает какое-то действие, и нет других действующих лиц, он ОБЯЗАТЕЛЬНО должен присутствовать в промпте.
4. ФОКУС НА ОБЪЕКТЕ: Если действие завязано на предмете (держит меч, смотрит на кристалл, читает книгу), этот объект ОБЯЗАТЕЛЬНО должен быть детально описан в промпте.
5. ИЗМЕНЕНИЕ СОСТОЯНИЯ: Учитывай текущее состояние персонажа! Если персонаж снял футболку, в промпте должно быть "shirtless" (без футболки) или "taking off shirt" (в процессе снятия). Нельзя рисовать его в футболке, если в тексте он её снял.
6. ВЗГЛЯД ПОЛЬЗОВАТЕЛЯ (POV): Если пользователь (hero) на что-то смотрит, изучает или осматривает, старайся показать это крупным планом (например: "close-up on ancient runes", "focus on glowing crystal in hands").
7. ПРЕЕМСТВЕННОСТЬ: Если персонаж или важная деталь появились в истории ранее и всё ещё уместны в сцене, упоминай их в промпте, чтобы сохранить консистентность.
8. СТИЛЬ: В самом конце промпта ОБЯЗАТЕЛЬНО добавляй стиль: {style_preset}.

ФОРМАТ ОТВЕТА (строго JSON):
{{
  "blocks": [
    {{"speaker": "narrator", "text": "*описание сцены*"}},
    {{"speaker": "hero", "text": "Реплика героя"}}
  ],
  "image_prompt": "detailed visual scene description in English, characters, poses, lighting, environment, close-up if needed, {style_preset}"
}}"""
    return prompt

def build_avatar_prompt(character_description: str) -> str:
    """Промпт для генерации аватарки персонажа"""
    return f"close-up portrait, detailed face, {character_description}, masterpiece, best quality, 8k, sharp focus, professional lighting"

def build_avatar_negative() -> str:
    """Негативный промпт для аватарок"""
    return "ugly, blurry, low quality, deformed, bad anatomy, extra fingers, cropped, worst quality, low resolution, full body"