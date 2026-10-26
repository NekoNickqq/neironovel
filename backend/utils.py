import re
import json
import random
from typing import Any, Dict

def clean_dict_keys(obj: Any) -> Any:
    """
    Рекурсивно очищает ключи словаря от пробелов в конце.
    ComfyUI при экспорте workflow в API-формат добавляет пробелы в концах ключей.
    """
    if isinstance(obj, dict):
        return {k.strip(): clean_dict_keys(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_dict_keys(item) for item in obj]
    else:
        return obj

def extract_json_from_text(text: str) -> dict:
    """
    Извлекает JSON из текста ответа Ollama.
    Ollama иногда оборачивает JSON в markdown-блоки или добавляет лишний текст.
    """
    # Убираем markdown обёртку
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    
    # Ищем первый { и последний }
    start = text.find('{')
    end = text.rfind('}')
    
    if start == -1 or end == -1:
        raise ValueError("JSON not found in response")
    
    json_str = text[start:end + 1]
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        # Попробуем починить частые проблемы
        # Заменить одинарные кавычки на двойные
        json_str = json_str.replace("'", '"')
        try:
            return json.loads(json_str)
        except:
            raise ValueError(f"Failed to parse JSON: {e}\nOriginal text: {text[:500]}")

def generate_seed() -> int:
    """Генерирует случайный seed для ComfyUI"""
    return random.randint(0, 2**32 - 1)

def build_system_prompt(world_lore: str, character_cards: list, style_preset: str, ai_controls_user: bool) -> str:
    """
    Формирует системный промпт для Ollama.
    """
    chars_text = ""
    for char in character_cards:
        chars_text += f"- {char['name']}: {char['description']}\n"
    
    user_instruction = ""
    if ai_controls_user:
        user_instruction = """
ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.
Если пользователь написал простое действие, преврати его в художественное описание.
В блоках с speaker: "user" сохраняй оригинальный смысл, но улучшай форму.
"""
    
    prompt = f"""Ты отыгрываешь роли в интерактивной визуальной новелле.

КОНТЕКСТ МИРА:
{world_lore}

ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей. Создавай по мере необходимости."}

СТИЛЬ ИЗОБРАЖЕНИЙ: {style_preset}
{user_instruction}
ПРАВИЛА:
1. Отвечай СТРОГО в формате JSON (без markdown, без пояснений до и после).
2. Массив blocks должен содержать реплики персонажей и описания narrатива.
3. speaker может быть: "narrator", "hero", "sidekick", "user".
4. narrator описывает окружение, действия, атмосферу (используй *звёздочки* для действий).
5. image_prompt — детальное визуальное описание текущей сцены на английском для генерации картинки. ПОЛЯ image_prompt ОБЯЗАТЕЛЬНА В КАЖДОМ ОТВЕТЕ, без исключений — никогда не опускай её и не оставляй пустой.
6. В image_prompt обязательно добавь стиль: {style_preset}
7. Отвечай на языке пользователя (обычно русский).

ФОРМАТ ОТВЕТА:
{{
  "blocks": [
    {{"speaker": "narrator", "text": "*описание сцены*"}},
    {{"speaker": "hero", "text": "Реплика героя"}},
    {{"speaker": "sidekick", "text": "Реплика спутника"}}
  ],
  "image_prompt": "detailed visual scene description in English, characters, poses, lighting, environment, {style_preset}"
}}

Помни: ответ всегда должен содержать И blocks, И непустую image_prompt."""
    
    return prompt

def build_avatar_prompt(character_description: str) -> str:
    """Промпт для генерации аватарки персонажа"""
    return f"close-up portrait, detailed face, {character_description}, masterpiece, best quality, 8k, sharp focus, professional lighting"

def build_avatar_negative() -> str:
    """Негативный промпт для аватарок"""
    return "ugly, blurry, low quality, deformed, bad anatomy, extra fingers, cropped, worst quality, low resolution, full body"
