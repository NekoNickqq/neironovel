import { useState, useRef } from 'react';
import { ImagePlus, Sparkles, Loader2, Lock, Unlock, Trash2, Maximize2, Image as ImageIcon, User, X } from 'lucide-react';
import { api } from '../api';
import { CardTilt } from './CardTilt';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';

interface Props {
  type: 'world' | 'character';
  cardData: any; 
  images: string[];
  selectedIndex: number;
  prompt: string;
  setPrompt: (p: string) => void;
  negative: string;
  setNegative: (p: string) => void;
  isLocked: boolean;
  setIsLocked: (l: boolean) => void;
  onSelectImage: (idx: number) => void;
  onRemoveImage: () => void;
  onImageSaved: (path: string) => void;
}

export function ImageCreationPanel({ 
  type, cardData, images, selectedIndex, prompt, setPrompt, negative, setNegative, 
  isLocked, setIsLocked, onSelectImage, onRemoveImage, onImageSaved 
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'image' | 'card'>('image');
  
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentImage = images[selectedIndex];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.uploadImage(file);
      onImageSaved(res.image_path!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return setError("Введите промпт для генерации");
    setLoading(true);
    setError('');
    try {
      const res = await api.generateCardImage(type, prompt, negative);
      onImageSaved(res.image_path!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCard = () => {
    return type === 'world' 
      ? <WorldCardView data={cardData} image={currentImage} />
      : <CharacterCardView data={cardData} image={currentImage} />;
  };

  return (
    <>
      {fullscreen && (currentImage || viewMode === 'card') && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center overflow-hidden cursor-move"
          onWheel={(e) => {
            const delta = e.deltaY * -0.001;
            const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3);
            setZoom(newZoom);
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;
            setCursorPos({ x, y });
          }}
          onClick={() => { setFullscreen(false); setZoom(1); }}
        >
          <button className="absolute top-6 right-6 text-white hover:text-red-400 p-2 z-50" onClick={(e) => { e.stopPropagation(); setFullscreen(false); setZoom(1); }}>
            <X size={32} />
          </button>
          
          <div 
            style={{ transform: `scale(${zoom})`, transformOrigin: `${cursorPos.x}% ${cursorPos.y}%`, transition: 'transform 0.1s ease-out' }}
            className="w-full h-full flex items-center justify-center p-8 pointer-events-none"
          >
            {viewMode === 'image' ? (
              <img src={currentImage} alt="Fullscreen" className="max-w-full max-h-full object-contain drop-shadow-2xl" />
            ) : (
              <CardTilt className={`pointer-events-auto rounded-2xl ${type === 'world' ? 'w-[600px]' : 'w-[400px]'}`}>
                {renderCard()}
              </CardTilt>
            )}
          </div>
        </div>
      )}

      <div className="h-full flex flex-col bg-gray-900 p-4">
        
        {/* Контейнер отображения */}
        <div className="w-full bg-black rounded-2xl border border-gray-700 relative mb-2 shrink-0 h-[35vh] min-h-[250px] overflow-visible">
          
          {/* Кнопки сверху */}
          <div className="absolute top-2 left-2 z-20 flex gap-1 bg-black/60 p-1 rounded-lg backdrop-blur-md">
            <button onClick={() => setViewMode('image')} className={`p-1.5 rounded ${viewMode === 'image' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Изображение"><ImageIcon size={16} /></button>
            <button onClick={() => setViewMode('card')} className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Превью карточки"><User size={16} /></button>
          </div>

          <div className="absolute top-2 right-2 z-20 flex gap-1 bg-black/60 p-1 rounded-lg backdrop-blur-md">
            <button onClick={() => setIsLocked(!isLocked)} className={`p-1.5 rounded ${isLocked ? 'text-emerald-400' : 'text-gray-400 hover:text-white'}`} title={isLocked ? "Разблокировать" : "Заблокировать"}>
              {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <button onClick={onRemoveImage} disabled={!currentImage} className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-30" title="Удалить">
              <Trash2 size={16} />
            </button>
            <button onClick={() => setFullscreen(true)} disabled={!currentImage && viewMode === 'image'} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30" title="На весь экран">
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Контент: абсолютное позиционирование, чтобы картинка не раздувала контейнер */}
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-30 rounded-2xl">
                <Loader2 className="animate-spin text-purple-500 mb-2" size={32} />
                <span className="text-white text-sm">Генерация...</span>
              </div>
            )}

            {viewMode === 'image' ? (
              <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                {currentImage ? (
                  <img src={currentImage} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-gray-600 text-sm">Нет картинки</span>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center overflow-visible">
                <CardTilt className={`flex items-center justify-center rounded-2xl ${type === 'world' ? 'w-full max-w-[380px]' : 'h-full max-h-[95%] aspect-[9/16]'}`}>
                  {renderCard()}
                </CardTilt>
              </div>
            )}
          </div>
        </div>

        {/* Карусель */}
        {images.length > 1 && (
          <div className="h-20 bg-gray-950 rounded-xl flex items-center justify-center px-2 mb-2 overflow-hidden border border-gray-800 shrink-0">
             <div className="flex items-center justify-center gap-2 w-full">
               {images.map((img, idx) => {
                 const isCenter = idx === selectedIndex;
                 const isNear = Math.abs(idx - selectedIndex) === 1;
                 return (
                   <div 
                     key={idx} onClick={() => onSelectImage(idx)}
                     className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-300 ${
                       isCenter ? 'w-16 h-16 border-2 border-purple-500 scale-110 z-10 shadow-lg' 
                       : isNear ? 'w-12 h-12 opacity-60 blur-[2px] hover:blur-none' 
                       : 'w-8 h-8 opacity-30 blur-[4px] hover:blur-none'
                     }`}
                   >
                     <img src={img} className="w-full h-full object-cover" />
                   </div>
                 )
               })}
             </div>
          </div>
        )}

        {/* Кнопки генерации */}
        <div className="flex gap-2 mb-2 shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all disabled:opacity-50 text-sm">
            <ImagePlus size={16} /> Загрузить
          </button>
          <button onClick={handleGenerate} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-50 text-sm">
            <Sparkles size={16} /> Сгенерировать
          </button>
        </div>

        {/* Промпты */}
        <div className={`flex flex-col gap-2 flex-1 min-h-[100px] transition-all duration-300 ${images.length > 1 ? 'h-24' : 'h-40'}`}>
          <textarea 
            value={prompt} onChange={e => setPrompt(e.target.value)} 
            placeholder="Positive Prompt (англ.)" 
            className="flex-1 w-full bg-gray-950 border border-gray-800 p-2 rounded-lg text-sm text-white outline-none focus:border-purple-500 resize-none overflow-y-auto scrollbar-thin" 
          />
          <textarea 
            value={negative} onChange={e => setNegative(e.target.value)} 
            placeholder="Negative Prompt (англ.)" 
            className="flex-1 w-full bg-gray-950 border border-gray-800 p-2 rounded-lg text-sm text-red-200 outline-none focus:border-red-500 resize-none overflow-y-auto scrollbar-thin" 
          />
        </div>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    </>
  );
}