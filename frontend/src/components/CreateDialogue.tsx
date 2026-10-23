import { useState } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, BookOpen, Palette } from 'lucide-react';
import { CharacterCard } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function CreateDialogue() {
  const { dispatch, createDialogue } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [worldLore, setWorldLore] = useState('');
  const [stylePreset, setStylePreset] = useState('dark fantasy, cinematic lighting, masterpiece, best quality, 8k');
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [aiControlsUser, setAiControlsUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const STYLE_PRESETS = [
    { name: 'Тёмное фэнтези', value: 'dark fantasy, cinematic lighting, masterpiece, best quality, 8k, dramatic shadows' },
    { name: 'Киберпанк', value: 'cyberpunk, neon lights, rain, futuristic city, masterpiece, best quality, 8k' },
    { name: 'Аниме', value: 'anime style, vibrant colors, detailed, masterpiece, best quality, studio ghibli inspired' },
    { name: 'Реализм', value: 'photorealistic, hyper detailed, natural lighting, 8k, cinematic composition' },
    { name: 'Акварель', value: 'watercolor painting, soft colors, artistic, dreamy, masterpiece, best quality' },
  ];

  const addCharacter = () => {
    if (!newCharName.trim()) return;
    const colors = ['#8b5cf6', '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#ef4444'];
    setCharacters([...characters, {
      id: uuidv4(),
      name: newCharName,
      description: newCharDesc,
      avatar_path: null,
      color: colors[characters.length % colors.length],
    }]);
    setNewCharName('');
    setNewCharDesc('');
  };

  const removeCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  const handleCreate = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createDialogue({
        title,
        description,
        world_lore: worldLore,
        character_cards: characters,
        style_preset: stylePreset,
        ai_controls_user: aiControlsUser,
      });
    } catch {
      /* ошибка в store.apiError */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'list' })}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Назад к списку
        </button>

        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
          <Sparkles className="text-purple-400" />
          Новый диалог
        </h2>

        <div className="space-y-8">
          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-purple-400" />
              Основная информация
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Название</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Например: Храм Забытых Рун"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Описание</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Краткое описание истории"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              🌍 Лор мира
            </h3>
            <textarea
              value={worldLore}
              onChange={e => setWorldLore(e.target.value)}
              placeholder="Опиши мир, в котором происходит действие..."
              rows={6}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Palette size={20} className="text-purple-400" />
              Стиль изображений
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setStylePreset(preset.value)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    stylePreset === preset.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <textarea
              value={stylePreset}
              onChange={e => setStylePreset(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors resize-none text-sm font-mono"
            />
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              👥 Персонажи
            </h3>
            <div className="space-y-3 mb-4">
              {characters.map(char => (
                <div key={char.id} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: char.color }}>
                    {char.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{char.name}</div>
                    <div className="text-gray-400 text-sm">{char.description || 'Без описания'}</div>
                  </div>
                  <button
                    onClick={() => removeCharacter(char.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="border border-dashed border-gray-700 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={newCharName}
                onChange={e => setNewCharName(e.target.value)}
                placeholder="Имя персонажа"
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
              />
              <input
                type="text"
                value={newCharDesc}
                onChange={e => setNewCharDesc(e.target.value)}
                placeholder="Описание"
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
              />
              <button
                onClick={addCharacter}
                disabled={!newCharName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm transition-all"
              >
                + Добавить персонажа
              </button>
            </div>
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚙️ Настройки ИИ</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiControlsUser}
                onChange={e => setAiControlsUser(e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="text-white">ИИ контролирует реплики пользователя</div>
                <div className="text-gray-400 text-sm">ИИ может переписывать ваши действия в более литературной форме</div>
              </div>
            </label>
          </div>

          <button
            onClick={() => void handleCreate()}
            disabled={!title.trim() || submitting}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] shadow-lg shadow-purple-600/20"
          >
            {submitting ? 'Создаём…' : '✨ Создать диалог'}
          </button>
        </div>
      </div>
    </div>
  );
}
