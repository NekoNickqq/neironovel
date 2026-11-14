import { useState } from 'react';
import { useApp } from '../store';
import { X, Save } from 'lucide-react';

export function EditSettingsModal({ onClose }: { onClose: () => void }) {
  const { state, currentDialogue, updateDialogueSettings } = useApp();
  
  const [selectedWorldId, setSelectedWorldId] = useState(currentDialogue?.settings.world_data?.id || '');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(currentDialogue?.settings.character_cards?.map(c => c.id) || []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const world_data = state.worlds.find(w => w.id === selectedWorldId);
      const character_cards = state.characters.filter(c => selectedCharIds.includes(c.id));
      await updateDialogueSettings({ world_data, character_cards });
      onClose();
    } finally { setSaving(false); }
  };

  if (!currentDialogue) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-950">
          <h2 className="font-semibold text-white">Редактировать настройки диалога</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Мир</label>
            <select value={selectedWorldId} onChange={e => setSelectedWorldId(e.target.value)} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none">
              <option value="">-- Выберите мир --</option>
              {state.worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">Персонажи</label>
            <div className="grid grid-cols-2 gap-2">
              {state.characters.map(c => (
                <label key={c.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${selectedCharIds.includes(c.id) ? 'bg-purple-900/30 border-purple-500' : 'bg-gray-800 border-transparent'}`}>
                  <input type="checkbox" checked={selectedCharIds.includes(c.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedCharIds([...selectedCharIds, c.id]);
                    else setSelectedCharIds(selectedCharIds.filter(id => id !== c.id));
                  }} className="w-4 h-4" />
                  <span className="text-white text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
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