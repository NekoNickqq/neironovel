import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { MiniCatalog } from './MiniCatalog';
import { ImageCreationPanel } from './ImageCreationPanel';

export function CreateWorldPage() {
  const { refreshCatalog } = useApp(); 
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || '/catalog';
  const duplicateData = location.state?.duplicateData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [w, setW] = useState({ 
    name: duplicateData ? duplicateData.name + " (Копия)" : '', 
    history: duplicateData ? duplicateData.history : '', 
    features: duplicateData ? duplicateData.features : '', 
    appearance: duplicateData ? duplicateData.appearance : '', 
    negative_prompt: duplicateData ? duplicateData.negative_prompt : '', 
    image_variants: duplicateData ? duplicateData.image_variants : [] as string[], 
    selected_image_index: duplicateData ? duplicateData.selected_image_index : 0 
  });

  const [activeField, setActiveField] = useState<keyof typeof w | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'catalog' | 'image'>('catalog');
  const [isLocked, setIsLocked] = useState(false);

  const [imgPrompt, setImgPrompt] = useState('');
  const [imgNegative, setImgNegative] = useState('');

  const [leftWidth, setLeftWidth] = useState(50);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => { isResizing.current = true; };
  const handleMouseUp = () => { isResizing.current = false; };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(Math.max(newWidth, 30), 70)); 
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);

  const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  };

  const isWorldValid = w.name && w.history && w.features && w.appearance;

  const handleFocus = (field: keyof typeof w) => {
    setActiveField(field);
    if (!isLocked) setRightPanelMode('catalog');
  };

  const handleSelectCard = (card: any) => {
    if (!activeField) return;
    setW(prev => ({ ...prev, [activeField]: card[activeField] || '' }));
    setActiveField(null); 
  };

  const handleGenerateNegative = async () => {
    if (!isWorldValid) return;
    setLoading(true);
    try {
      const res: any = await api.generateNegative('world', w);
      setW({ ...w, negative_prompt: res.negative });
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.createWorld(w);
      await refreshCatalog();
      navigate(returnTo, { state: { newCardId: res.id } });
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  const openImagePanel = () => {
    if (!imgPrompt.trim()) {
      // Для мира без "cute"
      setImgPrompt((w.appearance || '') + ", best resolution, best quality, masterpiece");
    }
    if (!imgNegative.trim()) {
      // Для мира без "bad anatomy"
      setImgNegative((w.negative_prompt || '') + ", bad quality, bad resolution, ugly");
    }
    setRightPanelMode('image');
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(returnTo)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} /> Назад
        </button>
        <div className="flex gap-3">
          <button onClick={handleGenerateNegative} disabled={loading || !isWorldValid} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-medium transition-all">
            <Sparkles size={16} /> Негатив
          </button>
          <button onClick={handleSave} disabled={loading || !isWorldValid} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-medium transition-all">
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <div style={{ width: `${leftWidth}%` }} className="h-full overflow-y-auto p-8 scrollbar-thin bg-gray-950">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="text-emerald-400" /> Создание мира
          </h2>
          
          <div className="space-y-4 w-full">
            <input 
              placeholder="Название мира *" 
              value={w.name} onChange={e => setW({...w, name: e.target.value})} 
              onFocus={() => handleFocus('name')}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border ${activeField === 'name' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="История мира *" 
              value={w.history} onChange={e => setW({...w, history: e.target.value})} 
              onFocus={() => handleFocus('history')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'history' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Особенности мира *" 
              value={w.features} onChange={e => setW({...w, features: e.target.value})} 
              onFocus={() => handleFocus('features')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'features' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Внешний вид (Стиль) *" 
              value={w.appearance} onChange={e => setW({...w, appearance: e.target.value})} 
              onFocus={() => handleFocus('appearance')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'appearance' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Негативный промпт" 
              value={w.negative_prompt} onChange={e => setW({...w, negative_prompt: e.target.value})} 
              onFocus={() => handleFocus('negative_prompt')}
              onInput={handleAutoResize}
              className={`w-full bg-red-950/20 text-red-200 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'negative_prompt' ? 'border-red-500 ring-1 ring-red-500' : 'border-red-900/50'}`} 
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button 
              onClick={openImagePanel}
              className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {w.image_variants.length > 0 ? "Изменить картинку мира" : "Добавить картинку мира"}
            </button>
          </div>
        </div>

        <div onMouseDown={handleMouseDown} className="w-2 cursor-col-resize bg-gray-900 hover:bg-purple-600 transition-colors flex items-center justify-center shrink-0 z-20">
          <div className="w-0.5 h-8 bg-gray-700 rounded-full pointer-events-none" />
        </div>

        <div style={{ width: `${100 - leftWidth}%` }} className="h-full bg-gray-900 overflow-hidden border-l border-gray-800">
          {rightPanelMode === 'catalog' ? (
            <MiniCatalog type="world" onSelect={handleSelectCard} />
          ) : (
            <ImageCreationPanel 
              type="world" 
              cardData={w}
              images={w.image_variants}
              selectedIndex={w.selected_image_index}
              prompt={imgPrompt}
              setPrompt={setImgPrompt}
              negative={imgNegative}
              setNegative={setImgNegative}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              onSelectImage={(idx) => setW(prev => ({ ...prev, selected_image_index: idx }))}
              onRemoveImage={() => setW(prev => {
                const newVariants = prev.image_variants.filter((_: string, i: number) => i !== prev.selected_image_index);
                return { ...prev, image_variants: newVariants, selected_image_index: Math.max(0, prev.selected_image_index - 1) };
              })}
              onImageSaved={(path) => {
                setW(prev => {
                  const newVariants = [...prev.image_variants, path];
                  return { ...prev, image_variants: newVariants, selected_image_index: newVariants.length - 1 };
                });
              }} 
            />
          )}
        </div>
      </div>
    </div>
  );
}