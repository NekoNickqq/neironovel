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

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОМПТОВ ---

def _get_context(world_data: dict, character_cards: list):
    w_name = world_data.get("name", "Безымянный мир")
    w_hist = world_data.get("history", "")
    w_feat = world_data.get("features", "")
    w_app = world_data.get("appearance", "")
    w_neg = world_data.get("negative_prompt", "")
    
    world_context = f"МИР: {w_name}\n"
    if w_hist: world_context += f"История: {w_hist}\n"
    if w_feat: world_context += f"Особенности: {w_feat}\n"
    if w_app: world_context += f"Внешний вид (стиль): {w_app}\n"
    if w_neg: world_context += f"НЕДОПУСТИМО: {w_neg}\n"

    chars_text = ""
    for char in character_cards:
        chars_text += f"- {char.get('name', 'Безымянный')}:\n"
        if char.get('appearance'): chars_text += f"  Внешность: {char['appearance']}\n"
        if char.get('personality'): chars_text += f"  Характер: {char['personality']}\n"
        if char.get('features'): chars_text += f"  Особенности: {char['features']}\n"
        if char.get('negative_appearance'): chars_text += f"  ВНЕШНЕ НЕ ДОЛЖЕН БЫТЬ: {char['negative_appearance']}\n"
        if char.get('negative_personality'): chars_text += f"  ПО ХАРАКТЕРУ НЕ ДОЛЖЕН БЫТЬ: {char['negative_personality']}\n"

    return world_context, chars_text, w_app, w_neg

# --- 3 ВАРИАНТА ПРОМПТОВ ---

def build_simple_prompt(world_data, character_cards, ai_controls_user):
    world_context, chars_text, w_app, w_neg = _get_context(world_data, character_cards)
    user_instruction = "ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.\n" if ai_controls_user else ""
    
    return f"""Ты — мастер интерактивных визуальных новелл и опытный промпт-инженер.
КОНТЕКСТ МИРА:
{world_context}
ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей."}
{user_instruction}
ПРАВИЛА:
1. Отвечай СТРОГО в формате JSON.
2. narrator описывает окружение и действия (*звёздочки*).
3. image_prompt — детальное описание сцены на английском.
4. Стиль: {w_app}

ФОРМАТ ОТВЕТА:
{{
  "blocks": [{{"speaker": "narrator", "text": "*описание*"}}],
  "image_prompt": "detailed scene, {w_app}",
  "negative_prompt": "{w_neg}"
}}"""

def build_realistic_prompt(world_data, character_cards, ai_controls_user):
    world_context, chars_text, w_app, w_neg = _get_context(world_data, character_cards)
    user_instruction = "ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.\n" if ai_controls_user else ""
    
    return f"""Ты — движок симуляции реальной жизни в сеттинге визуальной новеллы.
Твоя задача: отыгрывать живых, реалистичных персонажей с их собственными желаниями, страхами и границами.

КОНТЕКСТ МИРА:
{world_context}
ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей."}
{user_instruction}

ПРАВИЛА РЕАЛИЗМА:
1. НИКОГДА не соглашайся со всем подряд. Если действие пользователя противоречит характеру персонажа — он должен отказать, возмутиться или испугаться.
2. У персонажей есть личное пространство и чувство собственного достоинства. Они не обязаны быть милыми.
3. Реагируй на действия пользователя естественно: если он грубит — злись, если делает комплимент — смущайся.
4. Используй внутренние монологи (speaker: narrator) чтобы показать скрытые эмоции.
5. Не подыгрывай пользователю, если он пытается сломать логику мира.
6. Стиль картинок: {w_app}

ФОРМАТ ОТВЕТА (СТРОГО JSON):
{{
  "blocks": [{{"speaker": "narrator", "text": "*описание*"}}],
  "image_prompt": "detailed scene, {w_app}",
  "negative_prompt": "{w_neg}"
}}"""

def build_game_prompt(world_data, character_cards, ai_controls_user):
    world_context, chars_text, w_app, w_neg = _get_context(world_data, character_cards)
    user_instruction = "ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.\n" if ai_controls_user else ""
    
    return f"""Ты — Гейммастер текстовой RPG с глубокой симуляцией.
КОНТЕКСТ МИРА:
{world_context}
ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей."}
{user_instruction}

ПРАВИЛА RPG:
1. Реагируй реалистично (как в режиме "Реалистичный").
2. Отслеживай скрытую статистику. Оскорбления понижают отношения, комплименты повышают.
3. Возвращай в JSON скрытый блок "game_state" (настроение и прогресс отношений).

ФОРМАТ ОТВЕТА (СТРОГО JSON):
{{
  "blocks": [{{"speaker": "narrator", "text": "*описание*"}}],
  "game_state": {{
    "mood": "angry | happy | neutral | sad",
    "relationship_progress": 15,
    "relationship_status": "Незнакомцы"
  }},
  "image_prompt": "detailed scene, {w_app}",
  "negative_prompt": "{w_neg}"
}}"""

def build_system_prompt(world_data: dict, character_cards: list, ai_controls_user: bool, story_mode: str = "simple") -> str:
    """Роутер для выбора промпта в зависимости от режима истории"""
    if story_mode == "realistic":
        return build_realistic_prompt(world_data, character_cards, ai_controls_user)
    elif story_mode == "game":
        return build_game_prompt(world_data, character_cards, ai_controls_user)
    else:
        return build_simple_prompt(world_data, character_cards, ai_controls_user)

def build_avatar_prompt(character_description: str) -> str:
    return f"close-up portrait, detailed face, {character_description}, masterpiece, best quality, 8k, sharp focus, professional lighting"

def build_avatar_negative() -> str:
    return "ugly, blurry, low quality, deformed, bad anatomy, extra fingers, cropped, worst quality, low resolution, full body"