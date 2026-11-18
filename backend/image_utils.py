import os
from sqlalchemy.orm import Session
from database import Message, WorldCard, CharacterCard, CharacterAvatar, DialogueSettings
from config import config

def cleanup_orphan_images(db: Session):
    """Удаляет картинки из папок gallery и avatars, на которые больше нет ссылок в БД"""
    print("🧹 Запуск очистки мусора...")
    used_paths = set()
    
    # Собираем все используемые пути из БД
    for m in db.query(Message).all():
        if m.image_path: used_paths.add(m.image_path)
        if m.image_variants:
            for v in m.image_variants: used_paths.add(v)
            
    for w in db.query(WorldCard).all():
        if w.image_variants:
            for v in w.image_variants: used_paths.add(v)
            
    for c in db.query(CharacterCard).all():
        if c.image_variants:
            for v in c.image_variants: used_paths.add(v)

    # Аватарки (сгенерированные и загруженные) лежат в отдельной папке
    for a in db.query(CharacterAvatar).all():
        if a.image_path: used_paths.add(a.image_path)

    # Индивидуальные аватары пользователей по мирам
    for s in db.query(DialogueSettings).all():
        if s.user_avatar_path: used_paths.add(s.user_avatar_path)

    # Проверяем файлы в gallery (/gallery/...) и avatars (/avatars/...)
    roots = ((config.GALLERY_PATH, "/gallery"), (config.AVATARS_PATH, "/avatars"))
    for base_path, url_prefix in roots:
        if not os.path.exists(base_path):
            continue
        for root, _, files in os.walk(base_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_path).replace("\\", "/")
                rel_path = f"{url_prefix}/{rel_path}"
                
                if rel_path not in used_paths:
                    try:
                        os.remove(full_path)
                        print(f"🗑️ Удален неиспользуемый файл: {rel_path}")
                    except Exception as e:
                        print(f"Не удалось удалить {rel_path}: {e}")
                    
    # Удаляем пустые папки в Narrative (опционально)
    narrative_path = config.GALLERY_NARRATIVE
    if os.path.exists(narrative_path):
        for folder in os.listdir(narrative_path):
            folder_path = os.path.join(narrative_path, folder)
            if os.path.isdir(folder_path) and not os.listdir(folder_path):
                try:
                    os.rmdir(folder_path)
                    print(f"🗑️ Удалена пустая папка истории: {folder}")
                except: pass