import { useState } from 'react';
import { useApp } from '../store';
import { X, Save } from 'lucide-react';
import { DialogueConfigurator } from './DialogueConfigurator';

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
        
        <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* ИСПОЛЬЗУЕМ НОВЫЙ КОМПОНЕНТ */}
          <DialogueConfigurator 
            selectedWorldId={selectedWorldId} 
            setSelectedWorldId={setSelectedWorldId} 
            selectedCharIds={selectedCharIds} 
            setSelectedCharIds={setSelectedCharIds} 
          />
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