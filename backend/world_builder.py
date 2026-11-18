import json
import re
from database import SessionLocal, DialogueSettings
from ollama_client import ollama_client
from utils import extract_json_from_text

async def generate_world_state(dialogue_id: str, world_data: dict, character_cards: list):
    print(f"🌍 [World Builder] Начинаю генерацию мира для диалога {dialogue_id}...")
    
    world_info = f"Мир: {world_data.get('name')}. История: {world_data.get('history')}. Особенности: {world_data.get('features')}."
    chars_info = "Персонажи:\n" + "\n".join([f"- {c.get('name')}: {c.get('appearance')}. Характер: {c.get('personality')}" for c in character_cards])

    final_state = {
        "character_backstory": "",
        "start_location": {},
        "base_locations": [],
        "outfit_sets": []
    }

    try:
        # === ЭТАП 1: Предыстория и Стартовая локация ===
        print("🌍 [World Builder] Этап 1: Предыстория и стартовая локация...")
        prompt1 = f"""Ты — сценарист RPG. На основе этого контекста:
{world_info}
{chars_info}

Придумай краткую предысторию для персонажей и опиши стартовую локацию.
Верни СТРОГО JSON без markdown:
{{
  "character_backstory": "краткое описание",
  "start_location": {{
    "name": "Название локации",
    "visual": "Детальное визуальное описание на английском для нейросети",
    "atmosphere": "Описание атмосферы на русском"
  }}
}}"""
        res1 = await ollama_client.chat([{"role": "user", "content": prompt1}], "Отвечай только валидным JSON.", temperature=0.6)
        data1 = extract_json_from_text(res1["raw"])
        final_state["character_backstory"] = data1.get("character_backstory", "")
        final_state["start_location"] = data1.get("start_location", {})

        # === ЭТАП 2: Базовые локации мира ===
        print("🌍 [World Builder] Этап 2: Базовые локации...")
        prompt2 = f"""На основе этого мира:
{world_info}
Стартовая локация: {final_state['start_location'].get('name')}

Придумай 5 других важных локаций в этом мире.
Верни СТРОГО JSON-массив без markdown:
[
  {{"name": "Название", "visual": "Детальное описание на английском"}}
]"""
        res2 = await ollama_client.chat([{"role": "user", "content": prompt2}], "Отвечай только валидным JSON-массивом.", temperature=0.6)
        array_match = re.search(r'\[.*\]', res2["raw"], re.DOTALL)
        if array_match:
            final_state["base_locations"] = json.loads(array_match.group(0))

        # === ЭТАП 3: Сеты одежды ===
        print("🌍 [World Builder] Этап 3: Сеты одежды...")
        prompt3 = f"""На основе этого мира и персонажей:
{world_info}
{chars_info}

Придумай 2-3 сета одежды для главного персонажа.
Верни СТРОГО JSON-массив без markdown:
[
  {{"name": "casual", "tags": "oversized hoodie, jeans, sneakers"}}
]"""
        res3 = await ollama_client.chat([{"role": "user", "content": prompt3}], "Отвечай только валидным JSON-массивом.", temperature=0.6)
        array_match3 = re.search(r'\[.*\]', res3["raw"], re.DOTALL)
        if array_match3:
            final_state["outfit_sets"] = json.loads(array_match3.group(0))

        # === СОХРАНЕНИЕ ===
        print(f"✅ [World Builder] Успешно сгенерировано! Сохраняю в БД.")
        # Создаем НОВУЮ сессию для фоновой задачи, чтобы не было конфликтов
        db = SessionLocal()
        try:
            settings = db.query(DialogueSettings).filter(DialogueSettings.dialogue_id == dialogue_id).first()
            if settings:
                settings.world_state = final_state
                db.commit()
                print("✅ [World Builder] Состояние мира сохранено!")
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ [World Builder] Ошибка: {e}")