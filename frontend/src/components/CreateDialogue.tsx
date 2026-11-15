import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, BookOpen, Plus } from 'lucide-react';
import { DialogueConfigurator } from './DialogueConfigurator';
import { useNavigate, useLocation } from 'react-router-dom';

export function CreateDialogue() {
  const { state, createDialogue, clearDraft } = useApp();
  const draft = state.draftDialogue;
  const navigate = useNavigate();
  const location = useLocation();
  
  // Достаем данные из sessionStorage (если мы переходили создавать карточку)
  const saved = sessionStorage.getItem('createDialogueDraft');
  const savedData = saved ? JSON.parse(saved) : null;

  const [title, setTitle] = useState(savedData?.title || (draft ? draft.title + " (Копия)" : ''));
  const [description, setDescription] = useState(savedData?.description || (draft ? draft.description : ''));
  const [selectedWorldId, setSelectedWorldId] = useState(savedData?.selectedWorldId || draft?.settings.world_data?.id || '');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(savedData?.selectedCharIds || draft?.settings.character_cards?.map(c => c.id) || []);
  const [aiControlsUser, setAiControlsUser] = useState(savedData?.aiControlsUser ?? (draft ? draft.settings.ai_controls_user : false));
  const [submitting, setSubmitting] = useState(false);

  // Сохраняем в sessionStorage при каждом изменении
  useEffect(() => {
    sessionStorage.setItem('createDialogueDraft', JSON.stringify({
      title, description, selectedWorldId, selectedCharIds, aiControlsUser
    }));
  }, [title, description, selectedWorldId, selectedCharIds, aiControlsUser]);

  // Обработка возврата после создания карточки
  useEffect(() => {
    if (location.state?.newCardId) {
      // Если вернулись после создания мира
      if (state.worlds.some(w => w.id === location.state.newCardId)) {
        setSelectedWorldId(location.state.newCardId);
      }
      // Если вернулись после создания персонажа
      else if (state.characters.some(c => c.id === location.state.newCardId)) {
        setSelectedCharIds(prev => [...prev, location.state.newCardId]);
      }
      // Очищаем state, чтобы при обновлении страницы это не срабатывало повторно
      window.history.replaceState({}, document.title);
    }
  }, [location.state, state.worlds, state.characters]);

  useEffect(() => { 
    return () => { clearDraft(); }; 
  }, [clearDraft]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedWorldId || submitting) return;
    const world_data = state.worlds.find(w => w.id === selectedWorldId);
    if (!world_data) return alert("Выберите мир!");
    const character_cards = state.characters.filter(c => selectedCharIds.includes(c.id));

    setSubmitting(true);
    try {
      const newId = await createDialogue({ title, description, world_data, character_cards, ai_controls_user: aiControlsUser });
      sessionStorage.removeItem('createDialogueDraft'); // Очищаем черновик
      if (newId) navigate('/chat/' + newId); 
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('createDialogueDraft'); // Очищаем при отмене
    clearDraft(); 
    navigate('/'); 
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={handleCancel} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
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

          <DialogueConfigurator 
            selectedWorldId={selectedWorldId} 
            setSelectedWorldId={setSelectedWorldId} 
            selectedCharIds={selectedCharIds} 
            setSelectedCharIds={setSelectedCharIds} 
          />

          <div className="flex gap-3 justify-center">
            {/* Переходим на новые страницы и передаем returnTo */}
            <button onClick={() => navigate('/catalog/create-world', { state: { returnTo: '/create' } })} className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"><Plus size={16} /> Создать мир</button>
            <button onClick={() => navigate('/catalog/create-character', { state: { returnTo: '/create' } })} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"><Plus size={16} /> Создать персонажа</button>
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