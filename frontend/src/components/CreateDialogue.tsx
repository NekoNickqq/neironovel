import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, BookOpen, Plus, Users, Check, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MiniCatalog } from './MiniCatalog';
import { CardTilt } from './CardTilt';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';

import { DndContext, DragOverlay, useDraggable, useDroppable, rectIntersection } from '@dnd-kit/core';

// --- КОМПОНЕНТЫ ДЛЯ DND ---

function DraggableCharacterCard({ char, isSelectedForRemove, onClick, isDragging, onOpen, onOpenNewTab }: { char: any, isSelectedForRemove: boolean, onClick: (e: React.MouseEvent) => void, isDragging: boolean, onOpen: () => void, onOpenNewTab: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: char.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(); }}
      onMouseDown={(e) => { 
        if (e.button === 1) { 
          e.preventDefault(); e.stopPropagation(); onOpenNewTab(); 
        } 
      }}
      className={`cursor-grab active:cursor-grabbing outline-none transition-all rounded-2xl relative p-1 ${
        isDragging ? 'opacity-0' : ''
      } ${isSelectedForRemove ? 'ring-4 ring-red-500 scale-[1.02]' : ''}`}
    >
      <CardTilt>
        <CharacterCardView data={char} image={char.image_variants?.[char.selected_image_index]} />
        {isSelectedForRemove && (
          <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-lg z-30">
            <Check size={16} strokeWidth={3} />
          </div>
        )}
      </CardTilt>
    </div>
  );
}

function DroppableTrash({ onRemoveSelected, isDragging }: { onRemoveSelected: () => void, isDragging: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'trash' });

  return (
    <div 
      ref={setNodeRef}
      className={`transition-all duration-300 ease-in-out flex justify-center items-center ${
        isDragging ? 'w-[220px] h-[100px] opacity-100 mx-2 relative z-[9999] overflow-visible' : 'w-0 h-0 opacity-0 overflow-hidden pointer-events-none'
      }`}
    >
      <button
        onClick={onRemoveSelected}
        className={`flex items-center justify-center gap-2 py-3 px-6 text-white rounded-xl font-medium whitespace-nowrap transition-all duration-200 ${
          isOver ? 'bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,1)] ring-4 ring-red-400' : 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]'
        }`}
        title="Убрать (перетащите сюда)"
      >
        <Trash2 size={18} /> Убрать
      </button>
    </div>
  );
}

// --- ОСНОВНОЙ КОМПОНЕНТ ---

export function CreateDialogue() {
  const { state, createDialogue, clearDraft } = useApp();
  const draft = state.draftDialogue;
  const navigate = useNavigate();
  const location = useLocation();
  
  const saved = sessionStorage.getItem('createDialogueDraft');
  const savedData = saved ? JSON.parse(saved) : null;

  const [title, setTitle] = useState(savedData?.title || (draft ? draft.title + " (Копия)" : ''));
  const [description, setDescription] = useState(savedData?.description || (draft ? draft.description : ''));
  const [selectedWorldId, setSelectedWorldId] = useState(savedData?.selectedWorldId || draft?.settings.world_data?.id || '');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(savedData?.selectedCharIds || draft?.settings.character_cards?.map(c => c.id) || []);
  const [aiControlsUser, setAiControlsUser] = useState(savedData?.aiControlsUser ?? (draft ? draft.settings.ai_controls_user : false));
  
  // Стейт для режима истории
  const [storyMode, setStoryMode] = useState<'simple' | 'realistic' | 'game'>(
    savedData?.storyMode || draft?.settings.story_mode || 'simple'
  );

  const [submitting, setSubmitting] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<'world' | 'characters' | null>(null);
  const [tempCharIds, setTempCharIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);

  useEffect(() => {
    sessionStorage.setItem('createDialogueDraft', JSON.stringify({
      title, description, selectedWorldId, selectedCharIds, aiControlsUser, storyMode
    }));
  }, [title, description, selectedWorldId, selectedCharIds, aiControlsUser, storyMode]);

  useEffect(() => {
    if (location.state?.newCardId) {
      if (state.worlds.some(w => w.id === location.state.newCardId)) {
        setSelectedWorldId(location.state.newCardId);
      } else if (state.characters.some(c => c.id === location.state.newCardId)) {
        setSelectedCharIds(prev => [...prev, location.state.newCardId]);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, state.worlds, state.characters]);

  useEffect(() => { return () => { clearDraft(); }; }, [clearDraft]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedWorldId || submitting) return;
    const world_data = state.worlds.find(w => w.id === selectedWorldId);
    if (!world_data) return alert("Выберите мир!");
    
    const character_cards = state.characters.filter(c => selectedCharIds.includes(c.id));

    setSubmitting(true);
    try {
      // Передаем storyMode
      const newId = await createDialogue({ 
        title, description, world_data, character_cards, 
        ai_controls_user: aiControlsUser, 
        story_mode: storyMode 
      });
      sessionStorage.removeItem('createDialogueDraft');
      if (newId) navigate('/chat/' + newId); 
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('createDialogueDraft');
    clearDraft(); 
    navigate('/'); 
  };

  const handleSelectWorld = (world: any) => { setSelectedWorldId(world.id); setActiveCatalog(null); };
  const handleRemoveWorld = () => { setSelectedWorldId(''); };

  const handleSelectChar = (char: any, isMulti?: boolean) => {
    if (isMulti) {
      setTempCharIds(prev => prev.includes(char.id) ? prev.filter(id => id !== char.id) : [...prev, char.id]);
    } else {
      setSelectedCharIds(prev => [...prev, char.id]);
      setActiveCatalog(null);
    }
  };

  const handleRemoveChar = (char: any) => {
    setSelectedCharIds(prev => prev.filter(id => id !== char.id));
    setTempCharIds(prev => prev.filter(id => id !== char.id));
  };

  const handleAddSelectedChars = () => {
    setSelectedCharIds(prev => Array.from(new Set([...prev, ...tempCharIds])));
    setTempCharIds([]);
    setActiveCatalog(null);
  };

  const handleCardClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedToRemove(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedToRemove(prev => prev.includes(id) && prev.length === 1 ? [] : [id]);
    }
  };

  const handleRemoveSelected = () => {
    if (selectedToRemove.length > 0) {
      setSelectedCharIds(prev => prev.filter(id => !selectedToRemove.includes(id)));
      setSelectedToRemove([]);
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    if (event.over && event.over.id === 'trash') {
      setSelectedCharIds(prev => prev.filter(id => id !== event.active.id));
      setSelectedToRemove(prev => prev.filter(id => id !== event.active.id));
    }
  };

  const selectedWorld = state.worlds.find(w => w.id === selectedWorldId);
  const selectedChars = state.characters.filter(c => selectedCharIds.includes(c.id));
  const showTrash = activeId !== null || selectedToRemove.length > 0;
  const activeChar = selectedChars.find(c => c.id === activeId);

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden relative">
      
      <button onClick={handleCancel} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-50">
        <ArrowLeft size={20} /> Назад
      </button>

      <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
        <div className="max-w-5xl mx-auto space-y-8 pb-20 mt-8">
          
          <h2 className="text-3xl font-bold text-white text-center mb-10 flex items-center justify-center gap-3">
            <Sparkles className="text-purple-400" />
            {draft ? 'Копирование истории' : 'Новая история'}
          </h2>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-purple-400" /> Основная информация
            </h3>
            <div className="space-y-4">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название истории *" className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none focus:border-purple-500 transition-colors" />
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание" className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none focus:border-purple-500 transition-colors" />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">🌍 Мир</h3>
            
            <div className="mb-8 flex justify-center">
              {selectedWorld ? (
                <div className="w-full max-w-2xl p-2">
                  <CardTilt 
                    onDoubleClick={(e) => { e.stopPropagation(); navigate(`/catalog/world/${selectedWorld.id}`, { state: { returnTo: '/create' } }); }}
                    onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); window.open(`/catalog/world/${selectedWorld.id}?returnTo=/create`, '_blank'); } }}
                    className="cursor-pointer"
                  >
                    <WorldCardView data={selectedWorld} image={selectedWorld.image_variants?.[selectedWorld.selected_image_index]} />
                  </CardTilt>
                </div>
              ) : null}
            </div>

            {activeCatalog === 'world' ? (
              <div className="h-[600px] w-full border border-gray-700 rounded-xl overflow-hidden mt-4">
                <MiniCatalog 
                  type="world" 
                  onSelect={handleSelectWorld} 
                  onRemove={handleRemoveWorld} 
                  selectedIds={selectedWorldId ? [selectedWorldId] : []}
                  tempSelectedIds={[]}
                  onClose={() => setActiveCatalog(null)} 
                  returnTo="/create" 
                />
              </div>
            ) : (
              <div className="flex gap-4 mt-6">
                <button onClick={() => navigate('/catalog/create-world', { state: { returnTo: '/create' } })} className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors">
                  <Plus size={18} /> Создать мир
                </button>
                <button onClick={() => setActiveCatalog('world')} className="flex-1 flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
                  Выбрать из каталога
                </button>
              </div>
            )}
          </div>

          <DndContext collisionDetection={rectIntersection} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6"><Users className="text-blue-400"/> Персонажи</h3>
              
              <div className="mb-6">
                {selectedChars.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {selectedChars.map(c => (
                      <DraggableCharacterCard 
                        key={c.id}
                        char={c} 
                        isDragging={activeId === c.id}
                        isSelectedForRemove={selectedToRemove.includes(c.id)} 
                        onClick={(e) => handleCardClick(e, c.id)} 
                        onOpen={() => navigate(`/catalog/character/${c.id}`, { state: { returnTo: '/create' } })} 
                        onOpenNewTab={() => window.open(`/catalog/character/${c.id}?returnTo=/create`, '_blank')}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {activeCatalog === 'characters' ? (
                <div className="h-[600px] w-full border border-gray-700 rounded-xl overflow-hidden mt-4">
                  <MiniCatalog 
                    type="character" 
                    onSelect={handleSelectChar} 
                    onRemove={handleRemoveChar} 
                    selectedIds={selectedCharIds} 
                    tempSelectedIds={tempCharIds}
                    onAddSelected={handleAddSelectedChars}
                    onClose={() => setActiveCatalog(null)} 
                    returnTo="/create"
                  />
                </div>
              ) : (
                <div className="flex gap-4 mt-6 items-center">
                  <button onClick={() => navigate('/catalog/create-character', { state: { returnTo: '/create' } })} className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors">
                    <Plus size={18} /> Создать персонажа
                  </button>

                  <DroppableTrash onRemoveSelected={handleRemoveSelected} isDragging={showTrash} />

                  <button onClick={() => { setTempCharIds([]); setActiveCatalog('characters'); }} className="flex-1 flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
                    Выбрать из каталога
                  </button>
                </div>
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeChar ? (
                <div className="animate-shake cursor-grabbing scale-105 shadow-2xl rounded-2xl">
                  <CardTilt>
                    <CharacterCardView data={activeChar} image={activeChar.image_variants?.[activeChar.selected_image_index]} />
                  </CardTilt>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* НОВЫЙ БЛОК НАСТРОЕК ИИ И РЕЖИМА */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚙️ Характер истории</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <button 
                onClick={() => setStoryMode('simple')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${storyMode === 'simple' ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-600'}`}
              >
                <span className="text-2xl mb-2">🎭</span>
                <span className="font-bold text-white text-sm">Простой</span>
                <span className="text-xs text-gray-500 text-center mt-1">Классическое отыгрывание</span>
              </button>

              <button 
                onClick={() => setStoryMode('realistic')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${storyMode === 'realistic' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-600'}`}
              >
                <span className="text-2xl mb-2">🌍</span>
                <span className="font-bold text-white text-sm">Реалистичный</span>
                <span className="text-xs text-gray-500 text-center mt-1">Живые персонажи со своим мнением</span>
              </button>

              <button 
                onClick={() => setStoryMode('game')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${storyMode === 'game' ? 'border-amber-500 bg-amber-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-600'}`}
              >
                <span className="text-2xl mb-2">🎲</span>
                <span className="font-bold text-white text-sm">Игровой (Beta)</span>
                <span className="text-xs text-gray-500 text-center mt-1">Отслеживание отношений и настроения</span>
              </button>
            </div>

            <label className="flex items-center gap-4 cursor-pointer group pt-4 border-t border-gray-800">
              <div className="relative flex items-center justify-center">
                <input type="checkbox" checked={aiControlsUser} onChange={e => setAiControlsUser(e.target.checked)} className="peer sr-only" />
                <div className="w-6 h-6 rounded border border-gray-600 bg-gray-950 peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all flex items-center justify-center">
                  <Check size={16} className={`text-white transition-opacity ${aiControlsUser ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
              <div>
                <div className="text-white font-medium group-hover:text-purple-300 transition-colors">ИИ контролирует реплики пользователя</div>
                <div className="text-gray-500 text-sm">ИИ может переписывать ваши действия в литературной форме</div>
              </div>
            </label>
          </div>

          <button onClick={handleCreate} disabled={!title.trim() || !selectedWorldId || submitting} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 rounded-xl text-white font-semibold text-lg transition-all shadow-lg">
            {submitting ? 'Создаём…' : draft ? '✨ Создать копию' : '✨ Создать историю'}
          </button>
        </div>
      </div>
    </div>
  );
}