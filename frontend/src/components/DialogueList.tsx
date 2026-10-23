import { useApp } from '../store';
import { Plus, MessageSquare, Trash2, Sparkles, BookOpen, Image } from 'lucide-react';

export function DialogueList() {
  const { state, dispatch, openDialogue, deleteDialogue } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              🎭 RP Novel Engine
            </h1>
            <p className="text-gray-400 mt-2">Интерактивные истории с ИИ-генерацией текста и изображений</p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'create' })}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-purple-600/20"
          >
            <Plus size={20} />
            Новый диалог
          </button>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-surface/30 border border-purple-900/20 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <BookOpen size={18} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Режим ВН</h3>
              <p className="text-xs text-gray-500 mt-1">Полноэкранный визуальный роман с навигацией</p>
            </div>
          </div>
          <div className="bg-surface/30 border border-purple-900/20 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <Image size={18} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Генерация артов</h3>
              <p className="text-xs text-gray-500 mt-1">ComfyUI + апскейл для каждой сцены</p>
            </div>
          </div>
          <div className="bg-surface/30 border border-purple-900/20 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <Sparkles size={18} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Мульти-персонажи</h3>
              <p className="text-xs text-gray-500 mt-1">Каждый персонаж со своим шрифтом и стилем</p>
            </div>
          </div>
        </div>

        {/* Dialogue Cards */}
        {state.isLoadingList ? (
          <div className="text-center py-20 text-gray-400">Загрузка диалогов…</div>
        ) : state.dialogues.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📖</div>
            <p className="text-gray-400 text-lg">Нет диалогов. Создай первый!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {state.dialogues.map(dialogue => (
              <div
                key={dialogue.id}
                className="group bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6 hover:border-purple-600/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-purple-900/20"
                onClick={() => {
                  void openDialogue(dialogue.id).then(() => {
                    dispatch({ type: 'SET_VIEW', payload: 'chat' });
                  });
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare size={20} className="text-purple-400" />
                      <h3 className="text-xl font-semibold text-white">{dialogue.title}</h3>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{dialogue.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{dialogue.messages.length || dialogue.message_count || 0} сообщений</span>
                      <span>{dialogue.settings.character_cards.length} персонажей</span>
                      <span>Стиль: {dialogue.settings.style_preset.split(',')[0]}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Удалить диалог?')) {
                        void deleteDialogue(dialogue.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
