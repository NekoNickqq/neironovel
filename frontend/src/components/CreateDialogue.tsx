import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, BookOpen, Users, Plus } from 'lucide-react';
import { CardModal } from './CardModal';

export function CreateDialogue() {
  const { state, dispatch, createDialogue, clearDraft } = useApp();
  const draft = state.draftDialogue;
  
  const [title, setTitle] = useState(draft ? draft.title + " (Копия)" : '');
  const [description, setDescription] = useState(draft ? draft.description : '');
  
  // Выбор из каталога
  const [selectedWorldId, setSelectedWorldId] = useState(draft?.settings.world_data?.id || '');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(draft?.settings.character_cards?.map(c => c.id) || []);
  const [aiControlsUser, setAiControlsUser] = useState(draft ? draft.settings.ai_controls_user : false);
  
  const [submitting, setSubmitting] = useState(false);
  
  // Состояния для модалок
  const [modalType, setModalType] = useState<'world' | 'character' | null>(null);

  useEffect(() => { return () => { clearDraft(); }; }, [clearDraft]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedWorldId || submitting) return;
    
    const world_data = state.worlds.find(w => w.id === selectedWorldId);
    if (!world_data) return alert("Выберите мир!");

    const character_cards = state.characters.filter(c => selectedCharIds.includes(c.id));

    setSubmitting(true);
    try {
      await createDialogue({ title, description, world_data, character_cards, ai_controls_user: aiControlsUser });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-8">
      {modalType && <CardModal type={modalType} onClose={() => setModalType(null)} />}
      
      <div className="max-w-3xl mx-auto">
        <button onClick={() => { clearDraft(); dispatch({ type: 'SET_VIEW', payload: 'list' }); }} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft size={20} /> Назад к списку
        </button>

        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
          <Sparkles className="text-purple-400" /> {draft ? 'Копирование диалога' : 'Новый диалог'}
        </h2>

        <div className="space-y-8">
          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><BookOpen size={20} className="text-purple-400" /> Основная информация</h3>
            <div className="space-y-4">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название истории *" className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white outline-none focus:border-purple-500" />
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание" className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white outline-none focus:border-purple-500" />
            </div>
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">🌍 Мир (Обязательно)</h3>
              <button onClick={() => setModalType('world')} className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"><Plus size={16} /> Создать мир</button>
            </div>
            <select value={selectedWorldId} onChange={e => setSelectedWorldId(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-emerald-500">
              <option value="">-- Выберите мир из каталога --</option>
              {state.worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="text-blue-400"/> Персонажи</h3>
              <button onClick={() => setModalType('character')} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"><Plus size={16} /> Создать персонажа</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {state.characters.length === 0 && <p className="text-gray-500 text-sm">В каталоге нет персонажей.</p>}
              {state.characters.map(c => (
                <label key={c.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${selectedCharIds.includes(c.id) ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500'}`}>
                  <input type="checkbox" checked={selectedCharIds.includes(c.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedCharIds([...selectedCharIds, c.id]);
                    else setSelectedCharIds(selectedCharIds.filter(id => id !== c.id));
                  }} className="w-4 h-4 mt-1" />
                  <div>
                    <div className="text-white font-medium text-sm">{c.name}</div>
                    <div className="text-gray-400 text-xs line-clamp-1">{c.appearance}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚙️ Настройки ИИ</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={aiControlsUser} onChange={e => setAiControlsUser(e.target.checked)} className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500" />
              <div>
                <div className="text-white">ИИ контролирует реплики пользователя</div>
                <div className="text-gray-400 text-sm">ИИ может переписывать ваши действия в литературной форме</div>
              </div>
            </label>
          </div>

          <button onClick={handleCreate} disabled={!title.trim() || !selectedWorldId || submitting} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 rounded-xl text-white font-semibold text-lg transition-all shadow-lg">
            {submitting ? 'Создаём…' : draft ? '✨ Создать копию' : '✨ Создать диалог'}
          </button>
        </div>
      </div>
    </div>
  );
}