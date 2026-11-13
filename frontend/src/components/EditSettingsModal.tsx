import { useState } from 'react';
import { useApp } from '../store';
import { X, Save } from 'lucide-react';

export function EditSettingsModal({ onClose }: { onClose: () => void }) {
  const { currentDialogue, updateDialogueSettings } = useApp();
  const [lore, setLore] = useState(currentDialogue?.settings.world_lore || '');
  const [style, setStyle] = useState(currentDialogue?.settings.style_preset || '');
  const [charsJson, setCharsJson] = useState(JSON.stringify(currentDialogue?.settings.character_cards || [], null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let parsedChars = [];
      try {
        parsedChars = JSON.parse(charsJson);
        if (!Array.isArray(parsedChars)) throw new Error("Должен быть массивом");
      } catch (e) {
        throw new Error("Ошибка в JSON персонажей. Проверьте формат.");
      }
      await updateDialogueSettings({ world_lore: lore, style_preset: style, character_cards: parsedChars });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!currentDialogue) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-950">
          <h2 className="font-semibold text-white">Редактировать мир и персонажей</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Лор мира (World Lore)</label>
            <textarea value={lore} onChange={e => setLore(e.target.value)} className="w-full h-32 p-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:border-purple-500 outline-none resize-none font-mono" placeholder="Опишите мир, правила магии, историю..." />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Стиль изображений (Style Preset)</label>
            <textarea value={style} onChange={e => setStyle(e.target.value)} className="w-full h-16 p-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:border-purple-500 outline-none resize-none font-mono" placeholder="dark fantasy, masterpiece..." />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex justify-between">
              <span>Персонажи (JSON формат)</span>
              <span className="text-gray-500">[{`"id"`}, {`"name"`}, {`"description"`}, {`"color"`}]</span>
            </label>
            <textarea value={charsJson} onChange={e => setCharsJson(e.target.value)} className="w-full h-48 p-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:border-purple-500 outline-none resize-y font-mono text-emerald-300" />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-800 p-3 bg-gray-950">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Отмена</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition">
            <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}