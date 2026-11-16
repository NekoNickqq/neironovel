import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store';
import { api } from '../api';
import { ArrowLeft, Trash2, Copy, Edit, Image as ImageIcon, User, ChevronLeft, ChevronRight } from 'lucide-react';
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

  if (!card) {
    return <div className="text-white text-center mt-20">Карточка не найдена</div>;
  }

  const isUsed = state.dialogues.some(d => 
    isWorld 
      ? d.settings.world_data?.id === id 
      : d.settings.character_cards?.some(c => c.id === id)
  );

  // Умная кнопка Назад
  const handleBack = () => {
    // Если вкладка открыта через window.open, она имеет ссылку на открывшее её окно
    if (window.opener && !window.opener.closed) {
      window.close(); // Закрываем текущую вкладку
      window.opener.focus(); // Фокусируемся на исходной вкладке
    } else {
      navigate(returnTo); // Иначе просто навигируем
    }
  };

  const handleDelete = async () => {
    if (confirm('Вы уверены, что хотите удалить эту карточку?')) {
      await api.deleteCard(type!, id!);
      await refreshCatalog();
      handleBack(); // Возвращаемся назад после удаления
    }
  };

  const handleEditClick = () => {
    navigate(`/catalog/create-${type}`, { state: { duplicateData: card, returnTo } });
  };

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
    await refreshCatalog();
    setCurrentImgIndex(newIndex);
  };

  const handleImageSaved = async (path: string) => {
    const newVariants = [...(card.image_variants || []), path];
    await api.updateCardImages(type!, card.id, newVariants, newVariants.length - 1);
    await refreshCatalog();
    setCurrentImgIndex(newVariants.length - 1);
  };

  const openImagePanel = () => {
    if (!imgPrompt.trim()) {
      setImgPrompt(((card as any).appearance || '') + ", best resolution, best quality, masterpiece");
    }
    if (!imgNegative.trim()) {
      const neg = isWorld ? (card as any).negative_prompt : (card as any).negative_appearance;
      setImgNegative((neg ? neg + ', ' : '') + "ugly, blurry, low quality, deformed, worst quality");
    }
    setShowImagePanel(true);
  };

  const currentImage = card.image_variants?.[currentImgIndex];

  return (
    <div className="min-h-screen bg-gray-950 p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft size={20} /> Назад
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Левая панель: Информация и кнопки */}
          <div className="flex-1 space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h1 className="text-3xl font-bold text-white mb-2">{getDisplayName(card.name)}</h1>
              <p className="text-gray-500 font-mono text-sm mb-6">ID: {card.id}</p>

              <div className="space-y-4">
                {isWorld ? (
                  <>
                    <InfoField label="История" value={(card as any).history} />
                    <InfoField label="Особенности" value={(card as any).features} />
                    <InfoField label="Внешний вид" value={(card as any).appearance} />
                    <InfoField label="Негатив" value={(card as any).negative_prompt} isRed />
                  </>
                ) : (
                  <>
                    <InfoField label="Внешность" value={(card as any).appearance} />
                    <InfoField label="Характер" value={(card as any).personality} />
                    <InfoField label="Особенности" value={(card as any).features} />
                    <InfoField label="Негатив (Внешность)" value={(card as any).negative_appearance} isRed />
                    <InfoField label="Негатив (Характер)" value={(card as any).negative_personality} isRed />
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 rounded-xl transition-all">
                <Trash2 size={18} /> Удалить
              </button>
              <button onClick={handleEditClick} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 rounded-xl transition-all">
                <Copy size={18} /> Дублировать
              </button>
              
              <button 
                disabled={isUsed} 
                onClick={handleEditClick} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-xl transition-all ${isUsed ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/40'}`}
                title={isUsed ? "Нельзя изменить карточку, которая используется в историях" : "Редактировать"}
              >
                <Edit size={18} /> Изменить
              </button>
            </div>
            {isUsed && <p className="text-xs text-gray-500 text-center">Карточка используется в историях. Вы можете изменить только изображение.</p>}
          </div>

          {/* Правая панель: Карточка и Карусель */}
          <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-4">
            {showImagePanel ? (
               <div className="flex flex-col gap-2">
                 <button onClick={() => setShowImagePanel(false)} className="text-gray-400 hover:text-white text-sm text-left flex items-center gap-1 mb-2">
                   <ArrowLeft size={14} /> Вернуться к карточке
                 </button>
                 <div className="h-[500px] border border-gray-700 rounded-2xl overflow-hidden relative shadow-lg">
                   <ImageCreationPanel 
                     type={type!} 
                     cardData={card}
                     images={card.image_variants || []}
                     selectedIndex={currentImgIndex}
                     prompt={imgPrompt}
                     setPrompt={setImgPrompt}
                     negative={imgNegative}
                     setNegative={setImgNegative}
                     isLocked={isLocked}
                     setIsLocked={setIsLocked}
                     onSelectImage={handleSelectImage}
                     onRemoveImage={handleRemoveImage}
                     onImageSaved={handleImageSaved}
                   />
                 </div>
               </div>
            ) : (
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
            )}

            {!showImagePanel && (
              <button onClick={openImagePanel} className="w-full py-3 bg-purple-900/20 text-purple-300 border border-purple-900/50 hover:bg-purple-900/40 rounded-xl transition-all flex items-center justify-center gap-2">
                <ImageIcon size={18} /> Управление изображениями
              </button>
            )}

            {!showImagePanel && card.image_variants && card.image_variants.length > 1 && (
              <div className="flex items-center justify-between bg-gray-900 p-2 rounded-xl border border-gray-800">
                <button onClick={() => handleSelectImage(Math.max(0, currentImgIndex - 1))} disabled={currentImgIndex === 0} className="p-2 text-gray-400 hover:text-white disabled:opacity-30">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-400">
                  {currentImgIndex + 1} / {card.image_variants.length}
                </span>
                <button onClick={() => handleSelectImage(Math.min(card.image_variants.length - 1, currentImgIndex + 1))} disabled={currentImgIndex === card.image_variants.length - 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-30">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, isRed }: { label: string, value: string, isRed?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`p-3 rounded-lg text-sm ${isRed ? 'bg-red-950/20 text-red-200' : 'bg-gray-950 text-gray-300'}`}>{value}</div>
    </div>
  );
}