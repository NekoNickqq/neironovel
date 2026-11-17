import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store';
import { api } from '../api';
import { ArrowLeft, Trash2, Copy, Edit, Image as ImageIcon, User, ChevronLeft, ChevronRight, Save, X, Loader2 } from 'lucide-react';
import { CardTilt } from './CardTilt';
import { ImageCreationPanel } from './ImageCreationPanel';
import { getDisplayName } from '../utils';

export function CardViewPage() {
  const { type, id } = useParams<{ type: 'world' | 'character', id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, refreshCatalog } = useApp();

  const queryParams = new URLSearchParams(location.search);
  const returnTo = location.state?.returnTo || queryParams.get('returnTo') || '/catalog';

  const isWorld = type === 'world';
  const items = isWorld ? state.worlds : state.characters;
  const card = items.find((c: any) => c.id === id);

  const [showImagePanel, setShowImagePanel] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(card?.selected_image_index || 0);
  
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgNegative, setImgNegative] = useState('');
  const [isLocked, setIsLocked] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card && !isEditing && !editData) {
      setEditData({ ...card });
    }
  }, [card, isEditing, editData]);

  if (state.isLoadingList) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-purple-500" size={32} />
          <p className="text-gray-400">Загрузка карточки...</p>
        </div>
      </div>
    );
  }

  if (!card) return <div className="text-white text-center mt-20 text-xl">Карточка не найдена</div>;

  const isUsed = state.dialogues?.some(d => 
    isWorld ? d.settings.world_data?.id === id : d.settings.character_cards?.some(c => c.id === id)
  ) || false;

  const handleBack = () => {
    if (window.opener && !window.opener.closed) {
      window.close(); window.opener.focus();
    } else { navigate(returnTo); }
  };

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить эту карточку?')) {
      await api.deleteCard(type!, id!); await refreshCatalog(); handleBack();
    }
  };

  const handleDuplicate = () => navigate(`/catalog/create-${type}`, { state: { duplicateData: card, returnTo } });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isWorld) await api.updateWorld(id!, editData);
      else await api.updateCharacter(id!, editData);
      await refreshCatalog(); setIsEditing(false);
    } catch (e) { alert("Ошибка: " + e); } finally { setSaving(false); }
  };

  const handleCancelEdit = () => { setEditData({ ...card }); setIsEditing(false); };

  const handleSelectImage = async (index: number) => {
    setCurrentImgIndex(index);
    await api.updateCardImages(type!, card.id, card.image_variants, index);
    await refreshCatalog();
  };

  const handleRemoveImage = async () => {
    if (!card.image_variants || card.image_variants.length === 0) return;
    const newVariants = card.image_variants.filter((_: string, i: number) => i !== currentImgIndex);
    const newIndex = Math.max(0, currentImgIndex - 1);
    await api.updateCardImages(type!, card.id, newVariants, newIndex);
    await refreshCatalog(); setCurrentImgIndex(newIndex);
  };

  const handleImageSaved = async (path: string) => {
    const newVariants = [...(card.image_variants || []), path];
    await api.updateCardImages(type!, card.id, newVariants, newVariants.length - 1);
    await refreshCatalog(); setCurrentImgIndex(newVariants.length - 1);
  };

  const openImagePanel = () => {
    if (!imgPrompt.trim()) setImgPrompt(((card as any).appearance || '') + ", best resolution, best quality, masterpiece");
    if (!imgNegative.trim()) {
      const neg = isWorld ? (card as any).negative_prompt : (card as any).negative_appearance;
      setImgNegative((neg ? neg + ', ' : '') + "ugly, blurry, low quality, deformed, worst quality");
    }
    setShowImagePanel(true);
  };

  const currentImage = card.image_variants?.[currentImgIndex];

  return (
    <div className="min-h-screen bg-gray-950 relative flex flex-col">
      
      {/* Кнопка Назад (фиксирована в левом верхнем углу) */}
      <button onClick={handleBack} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-50">
        <ArrowLeft size={20} /> Назад
      </button>

      {/* Расширенный контейнер на всю ширину экрана с отступами */}
      <div className="w-full max-w-[1600px] mx-auto px-8 pt-20 pb-8 flex flex-col lg:flex-row gap-16 items-stretch flex-1">
        
        {/* Левая панель (Информация) */}
        <div className="flex-1 min-w-[400px] max-w-[900px] flex flex-col gap-6">
          
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative group flex-1">
            
            {isEditing && (
              <div className="absolute top-6 right-6 flex gap-2 animate-pop z-10">
                <button onClick={handleCancelEdit} disabled={saving} className="p-2 bg-red-900/40 text-red-400 hover:bg-red-800 rounded-full transition-colors"><X size={18} /></button>
                <button onClick={handleSave} disabled={saving} className="p-2 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800 rounded-full transition-colors">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                </button>
              </div>
            )}

            {isEditing ? (
              <input 
                type="text" 
                value={editData?.name || ''} 
                onChange={e => setEditData({...editData, name: e.target.value})}
                // Ширина calc(100%-110px) оставляет ровно 110px справа для кнопок, не заезжая под них
                className="text-3xl font-bold text-white bg-gray-950 border border-gray-700 rounded-lg px-3 py-1 mb-2 w-[calc(100%-110px)] focus:border-blue-500 outline-none" 
              />
            ) : (
              <h1 className="text-3xl font-bold text-white mb-2 pr-16">{getDisplayName(card.name)}</h1>
            )}
            <p className="text-gray-500 font-mono text-sm mb-6">ID: {card.id}</p>

            <div className="space-y-4">
              {isWorld ? (
                <>
                  <EditField label="История" field="history" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Особенности" field="features" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Внешний вид" field="appearance" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Негатив" field="negative_prompt" isEditing={isEditing} editData={editData} setEditData={setEditData} isRed />
                </>
              ) : (
                <>
                  <EditField label="Внешность" field="appearance" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Характер" field="personality" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Особенности" field="features" isEditing={isEditing} editData={editData} setEditData={setEditData} />
                  <EditField label="Негатив (Внешность)" field="negative_appearance" isEditing={isEditing} editData={editData} setEditData={setEditData} isRed />
                  <EditField label="Негатив (Характер)" field="negative_personality" isEditing={isEditing} editData={editData} setEditData={setEditData} isRed />
                </>
              )}
            </div>
          </div>

          {/* Кнопки под информацией */}
          {!isEditing && (
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 rounded-xl transition-all">
                <Trash2 size={18} /> Удалить
              </button>
              <button onClick={handleDuplicate} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 rounded-xl transition-all">
                <Copy size={18} /> Дублировать
              </button>
              <button 
                disabled={isUsed} 
                onClick={() => setIsEditing(true)} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-xl transition-all ${isUsed ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/40'}`}
              >
                <Edit size={18} /> Изменить
              </button>
            </div>
          )}
          {isUsed && !isEditing && <p className="text-xs text-gray-500 text-center">Карточка используется в историях. Вы можете изменить только изображение.</p>}
        </div>

        {/* Правая панель (Карточка или Редактор изображений) */}
        <div className={`w-full shrink-0 flex flex-col transition-all duration-300 ${showImagePanel ? 'lg:w-[750px]' : 'lg:w-[400px]'}`}>
          {showImagePanel ? (
             <div className="flex flex-col gap-2 h-full">
               <button onClick={() => setShowImagePanel(false)} className="text-gray-400 hover:text-white text-sm text-left flex items-center gap-1 mb-2">
                 <ArrowLeft size={14} /> Вернуться к карточке
               </button>
               {/* Панель занимает всю доступную высоту (h-full), повторяя высоту левого блока */}
               <div className="flex-1 min-h-[500px] border border-gray-700 rounded-2xl overflow-hidden relative shadow-lg">
                 <ImageCreationPanel 
                   type={type!} cardData={card} images={card.image_variants || []} selectedIndex={currentImgIndex}
                   prompt={imgPrompt} setPrompt={setImgPrompt} negative={imgNegative} setNegative={setImgNegative}
                   isLocked={isLocked} setIsLocked={setIsLocked} onSelectImage={handleSelectImage}
                   onRemoveImage={handleRemoveImage} onImageSaved={handleImageSaved}
                 />
               </div>
             </div>
          ) : (
            <div className="flex flex-col gap-4 h-full">
              <CardTilt>
                <div className={`relative w-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-700 shadow-2xl ${isWorld ? 'aspect-[16/10]' : 'aspect-[9/16]'}`}>
                  <div className="absolute top-4 left-0 right-0 z-20 flex flex-col items-center">
                    <h3 className="text-white font-bold text-xl drop-shadow-lg">{getDisplayName(card.name)}</h3>
                  </div>
                  
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center overflow-hidden">
                    {currentImage ? (
                      <img src={currentImage} alt={card.name} className="w-full h-full object-cover" />
                    ) : (
                      isWorld ? <ImageIcon size={64} className="text-gray-600"/> : <User size={64} className="text-gray-600"/>
                    )}
                  </div>

                  {isWorld && (
                     <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/80 to-transparent">
                        <p className="text-gray-300 text-sm line-clamp-3">{(card as any).history}</p>
                     </div>
                  )}
                </div>
              </CardTilt>

              <button onClick={openImagePanel} className="w-full py-3 bg-purple-900/20 text-purple-300 border border-purple-900/50 hover:bg-purple-900/40 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0">
                <ImageIcon size={18} /> Управление изображениями
              </button>

              {card.image_variants && card.image_variants.length > 1 && (
                <div className="flex items-center justify-between bg-gray-900 p-2 rounded-xl border border-gray-800 shrink-0">
                  <button onClick={() => handleSelectImage(Math.max(0, currentImgIndex - 1))} disabled={currentImgIndex === 0} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={20} /></button>
                  <span className="text-sm text-gray-400">{currentImgIndex + 1} / {card.image_variants.length}</span>
                  <button onClick={() => handleSelectImage(Math.min(card.image_variants.length - 1, currentImgIndex + 1))} disabled={currentImgIndex === card.image_variants.length - 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight size={20} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditField({ label, field, isEditing, editData, setEditData, isRed }: { label: string, field: string, isEditing: boolean, editData: any, setEditData: any, isRed?: boolean }) {
  if (!editData) return null;
  if (!isEditing && !editData[field]) return null;

  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      {isEditing ? (
        <textarea value={editData[field] || ''} onChange={e => setEditData({ ...editData, [field]: e.target.value })}
          className={`w-full p-3 rounded-lg text-sm outline-none resize-none border focus:border-blue-500 transition-colors ${isRed ? 'bg-red-950/20 text-red-200 border-red-900/50' : 'bg-gray-950 text-gray-300 border-gray-800'}`}
          rows={field === 'history' ? 4 : 3}
        />
      ) : (
        <div className={`p-3 rounded-lg text-sm ${isRed ? 'bg-red-950/20 text-red-200' : 'bg-gray-950 text-gray-300'}`}>{editData[field]}</div>
      )}
    </div>
  );
}