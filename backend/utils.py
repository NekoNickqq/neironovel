import re
import json
import random
from typing import Any, Dict

def clean_dict_keys(obj: Any) -> Any:
    if isinstance(obj, dict): return {k.strip(): clean_dict_keys(v) for k, v in obj.items()}
    elif isinstance(obj, list): return [clean_dict_keys(item) for item in obj]
    else: return obj

def extract_json_from_text(text: str) -> dict:
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1: raise ValueError("JSON not found in response")
    json_str = text[start:end + 1]
    try: return json.loads(json_str)
    except json.JSONDecodeError as e:
        json_str = json_str.replace("'", '"')
        try: return json.loads(json_str)
        except: raise ValueError(f"Failed to parse JSON: {e}\nOriginal text: {text[:500]}")

def generate_seed() -> int:
    return random.randint(0, 2**32 - 1)

def build_system_prompt(world_data: dict, character_cards: list, ai_controls_user: bool) -> str:
    """Формирует системный промпт для Ollama с новыми карточками."""
    
    # Мир
    w_name = world_data.get("name", "Безымянный мир")
    w_hist = world_data.get("history", "")
    w_feat = world_data.get("features", "")
    w_app = world_data.get("appearance", "")
    w_neg = world_data.get("negative_prompt", "")
    
    world_context = f"МИР: {w_name}\n"
    if w_hist: world_context += f"История: {w_hist}\n"
    if w_feat: world_context += f"Особенности: {w_feat}\n"
    if w_app: world_context += f"Внешний вид (стиль): {w_app}\n"
    if w_neg: world_context += f"В ЭТОМ МИРЕ НЕДОПУСТИМО: {w_neg}\n"

    # Персонажи
    chars_text = ""
    for char in character_cards:
        chars_text += f"- {char.get('name', 'Безымянный')}:\n"
        if char.get('appearance'): chars_text += f"  Внешность: {char['appearance']}\n"
        if char.get('personality'): chars_text += f"  Характер: {char['personality']}\n"
        if char.get('features'): chars_text += f"  Особенности: {char['features']}\n"
        if char.get('negative_appearance'): chars_text += f"  ВНЕШНЕ НЕ ДОЛЖЕН БЫТЬ: {char['negative_appearance']}\n"
        if char.get('negative_personality'): chars_text += f"  ПО ХАРАКТЕРУ НЕ ДОЛЖЕН БЫТЬ: {char['negative_personality']}\n"

    user_instruction = ""
    if ai_controls_user:
        user_instruction = "ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.\n"
    
    prompt = f"""Ты — мастер интерактивных визуальных новелл и опытный промпт-инженер для нейросетей-художников (Stable Diffusion).
Твоя задача: вести повествование и генерировать точные визуальные промпты (image_prompt и negative_prompt) на английском языке.

КОНТЕКСТ МИРА:
{world_context}

ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей."}

{user_instruction}
ПРАВИЛА НАРРАТИВА (для поля blocks):
1. Отвечай СТРОГО в формате JSON.
2. Массив blocks содержит реплики (speaker: narrator, hero, sidekick, user).
3. narrator описывает окружение, действия, атмосферу (используй *звёздочки*).

КРИТИЧЕСКИЕ ПРАВИЛА ДЛЯ ВИЗУАЛЬНЫХ ПРОМПТОВ:
1. Язык: Английский (теги).
2. НИКАКИХ ИМЁН в image_prompt. Заменяй на описание внешности.
3. ФОКУС НА ДЕЙСТВИИ и ОБЪЕКТАХ. Если персонаж совершает действие, он и объект должны быть в промпте.
4. ИЗМЕНЕНИЕ СОСТОЯНИЯ: Учитывай состояние (снял футболку = shirtless).
5. ВЗГЛЯД ПОЛЬЗОВАТЕЛЯ (POV): Если пользователь смотрит, покажи крупным планом ("close-up on...").
6. ЭМОЦИИ: Отражай мимику ("angry expression").
7. НЕГАТИВНЫЙ ПРОМПТ: Включи в negative_prompt ограничения из карточек и противоположности эмоций.
8. СТИЛЬ: В конце image_prompt добавь: {w_app}

ФОРМАТ ОТВЕТА (строго JSON):
{{
  "blocks": [{{"speaker": "narrator", "text": "*описание*"}}],
  "image_prompt": "detailed scene, close-up if needed, {w_app}",
  "negative_prompt": "specific things to avoid, {w_neg}"
}}"""
    return prompt

def build_avatar_prompt(character_description: str) -> str:
    return f"close-up portrait, detailed face, {character_description}, masterpiece, best quality, 8k, sharp focus, professional lighting"

def build_avatar_negative() -> str:
    return "ugly, blurry, low quality, deformed, bad anatomy, extra fingers, cropped, worst quality, low resolution, full body"