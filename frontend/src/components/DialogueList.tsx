import { useState } from 'react';
import { useApp } from '../store';
import { Plus, MessageSquare, Trash2, BookOpen, Image, Pencil, Copy, LayoutGrid } from 'lucide-react';
import { EditSettingsModal } from './EditSettingsModal';

export function DialogueList() {
  const { state, dispatch, openDialogue, deleteDialogue, setDraftForReuse } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEditClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await openDialogue(id);
    setEditingId(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 p-8">
      {editingId && <EditSettingsModal onClose={() => setEditingId(null)} />}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">🎭 RP Novel Engine</h1>
            <p className="text-gray-400 mt-2">Интерактивные истории с ИИ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'catalog' })} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white font-medium transition-all shadow-lg shadow-emerald-600/20">
              <LayoutGrid size={20} /> Каталог
            </button>
            <button onClick={() => { dispatch({ type: 'SET_DRAFT_DIALOGUE', payload: null }); dispatch({ type: 'SET_VIEW', payload: 'create' }); }} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-medium transition-all shadow-lg shadow-purple-600/20">
              <Plus size={20} /> Новый диалог
            </button>
          </div>
        </div>

        {state.isLoadingList ? <div className="text-center text-gray-400">Загрузка…</div> : state.dialogues.length === 0 ? (
          <div className="text-center py-20"><div className="text-6xl mb-4">📖</div><p className="text-gray-400">Нет диалогов.</p></div>
        ) : (
          <div className="grid gap-4">
            {state.dialogues.map(dialogue => (
              <div key={dialogue.id} onClick={() => { void openDialogue(dialogue.id).then(() => dispatch({ type: 'SET_VIEW', payload: 'chat' })); }} className="group bg-surface/50 border border-purple-900/30 rounded-2xl p-6 hover:border-purple-600/50 cursor-pointer flex justify-between transition-all">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-3"><MessageSquare size={20} className="text-purple-400" /> {dialogue.title}</h3>
                  <p className="text-gray-400 text-sm mt-2">{dialogue.settings.world_data?.name || "Без мира"}</p>
                  <div className="flex gap-4 text-xs text-gray-500 mt-3">
                    <span>{dialogue.messages.length || dialogue.message_count || 0} сообщений</span>
                    <span>{dialogue.settings.character_cards?.length || 0} персонажей</span>
                  </div>
                </div>
                
                {/* ВЕРТИКАЛЬНЫЕ КНОПКИ */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all justify-center" onClick={e => e.stopPropagation()}>
                  <button onClick={(e) => handleEditClick(dialogue.id, e)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg" title="Редактировать"><Pencil size={16} /></button>
                  <button onClick={() => setDraftForReuse(dialogue)} className="p-2 text-emerald-400 hover:bg-emerald-900/20 rounded-lg" title="Дублировать"><Copy size={16} /></button>
                  <button onClick={() => { if(confirm('Удалить?')) void deleteDialogue(dialogue.id) }} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg" title="Удалить"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}