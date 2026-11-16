def build_prompt(world_lore, character_cards, style_preset, ai_controls_user, is_game_mode=False):
    chars_text = ""
    for char in character_cards:
        chars_text += f"- {char['name']}: {char['description']}\n"
        if char.get('negative_description'):
            chars_text += f"  (КАТЕГОРИЧЕСКИ НЕ ДОЛЖЕН БЫТЬ: {char['negative_description']})\n"
    
    user_instruction = ""
    if ai_controls_user:
        user_instruction = "ВАЖНО: Ты можешь переписывать реплики пользователя в более литературной форме.\n"
    
    return f"""Ты — мастер интерактивных визуальных новелл.
Твоя задача: вести повествование и генерировать визуальные промпты.

КОНТЕКСТ МИРА:
{world_lore}

ПЕРСОНАЖИ:
{chars_text if chars_text else "Нет заданных персонажей."}

СТИЛЬ: {style_preset}
{user_instruction}
ПРАВИЛА:
1. Отвечай СТРОГО в формате JSON.
2. Массив blocks содержит реплики (speaker: narrator, hero, sidekick, user).
3. image_prompt — детальное описание сцены на английском.
4. negative_prompt — что не должно быть на картинке.

ФОРМАТ ОТВЕТА:
{{
  "blocks": [{{"speaker": "narrator", "text": "*описание*"}}],
  "image_prompt": "detailed scene, {style_preset}",
  "negative_prompt": "specific things to avoid"
}}"""