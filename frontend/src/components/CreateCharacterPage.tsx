import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { ArrowLeft, Sparkles, Save, Terminal } from 'lucide-react'; // <-- ДОБАВЛЕН Terminal
import { MiniCatalog } from './MiniCatalog';
import { ImageCreationPanel } from './ImageCreationPanel';
import { TerminalModal } from './TerminalModal';

export function CreateCharacterPage() {
  const { refreshCatalog } = useApp(); 
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || '/catalog';
  const duplicateData = location.state?.duplicateData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // НОВОЕ СОСТОЯНИЕ ДЛЯ ТЕРМИНАЛА
  const [showTerminal, setShowTerminal] = useState(false);

  const [c, setC] = useState({ 
    name: duplicateData ? duplicateData.name + " (Копия)" : '', 
    appearance: duplicateData ? duplicateData.appearance : '', 
    personality: duplicateData ? duplicateData.personality : '', 
    features: duplicateData ? duplicateData.features : '', 
    negative_appearance: duplicateData ? duplicateData.negative_appearance : '', 
    negative_personality: duplicateData ? duplicateData.negative_personality : '', 
    image_variants: duplicateData ? duplicateData.image_variants : [] as string[], 
    selected_image_index: duplicateData ? duplicateData.selected_image_index : 0 
  });

  const [activeField, setActiveField] = useState<keyof typeof c | null>(null);
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

  const isCharValid = c.name && c.appearance && c.personality;

  const handleFocus = (field: keyof typeof c) => {
    setActiveField(field);
    if (!isLocked) setRightPanelMode('catalog'); 
  };

  const handleSelectCard = (card: any) => {
    if (!activeField) return;
    setC(prev => ({ ...prev, [activeField]: card[activeField] || '' }));
    setActiveField(null);
  };

  const handleGenerateNegative = async () => {
    if (!isCharValid) return;
    setLoading(true);
    try {
      const res: any = await api.generateNegative('character', c);
      setC({ ...c, negative_appearance: res.negative_appearance, negative_personality: res.negative_personality });
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.createCharacter(c);
      await refreshCatalog();
      navigate(returnTo, { state: { newCardId: res.id } });
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  const openImagePanel = () => {
    const basePositive = "solo, best resolution, best quality, ultra detailed, masterpiece, cute, ";
    const baseNegative = "ugly, blurry, low quality, deformed, bad anatomy, mutated, disfigured, worst quality, low resolution, watermark, text, signature, jpeg artifacts, sketch, multiple people, extra characters, ";

    if (!imgPrompt.trim()) {
      setImgPrompt(basePositive + (c.appearance || ''));
    }
    if (!imgNegative.trim()) {
      setImgNegative(baseNegative + (c.negative_appearance || ''));
    }
    setRightPanelMode('image');
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden relative">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(returnTo)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} /> Назад
        </button>
        <div className="flex gap-3">
          {/* НОВАЯ КНОПКА ЛОГОВ */}
          <button onClick={() => setShowTerminal(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-all">
            <Terminal size={16} /> Логи
          </button>
          
          <button onClick={handleGenerateNegative} disabled={loading || !isCharValid} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-medium transition-all">
            <Sparkles size={16} /> Негатив
          </button>
          <button onClick={handleSave} disabled={loading || !isCharValid} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-medium transition-all">
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <div style={{ width: `${leftWidth}%` }} className="h-full overflow-y-auto p-8 scrollbar-thin bg-gray-950">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="text-blue-400" /> Создание персонажа
          </h2>
          
          <div className="space-y-4 w-full">
            <input 
              placeholder="Имя *" value={c.name} onChange={e => setC({...c, name: e.target.value})} 
              onFocus={() => handleFocus('name')}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border ${activeField === 'name' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Внешность *" value={c.appearance} onChange={e => setC({...c, appearance: e.target.value})} 
              onFocus={() => handleFocus('appearance')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'appearance' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Характер *" value={c.personality} onChange={e => setC({...c, personality: e.target.value})} 
              onFocus={() => handleFocus('personality')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'personality' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Особенности" value={c.features} onChange={e => setC({...c, features: e.target.value})} 
              onFocus={() => handleFocus('features')}
              onInput={handleAutoResize}
              className={`w-full bg-gray-900 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'features' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-800'}`} 
            />
            <textarea 
              placeholder="Негатив (Внешность)" value={c.negative_appearance} onChange={e => setC({...c, negative_appearance: e.target.value})} 
              onFocus={() => handleFocus('negative_appearance')}
              onInput={handleAutoResize}
              className={`w-full bg-red-950/20 text-red-200 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'negative_appearance' ? 'border-red-500 ring-1 ring-red-500' : 'border-red-900/50'}`} 
            />
            <textarea 
              placeholder="Негатив (Характер)" value={c.negative_personality} onChange={e => setC({...c, negative_personality: e.target.value})} 
              onFocus={() => handleFocus('negative_personality')}
              onInput={handleAutoResize}
              className={`w-full bg-red-950/20 text-red-200 p-3 rounded-xl outline-none border min-h-[120px] resize-none overflow-hidden ${activeField === 'negative_personality' ? 'border-red-500 ring-1 ring-red-500' : 'border-red-900/50'}`} 
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button 
              onClick={openImagePanel}
              className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {c.image_variants.length > 0 ? "Изменить аватар персонажа" : "Добавить аватар персонажа"}
            </button>
          </div>
        </div>

        <div onMouseDown={handleMouseDown} className="w-2 cursor-col-resize bg-gray-900 hover:bg-blue-600 transition-colors flex items-center justify-center shrink-0 z-20">
          <div className="w-0.5 h-8 bg-gray-700 rounded-full pointer-events-none" />
        </div>

        <div style={{ width: `${100 - leftWidth}%` }} className="h-full bg-gray-900 overflow-hidden border-l border-gray-800">
          {rightPanelMode === 'catalog' ? (
            <MiniCatalog type="character" onSelect={handleSelectCard} />
          ) : (
            <ImageCreationPanel 
              type="character" 
              cardData={c}
              images={c.image_variants}
              selectedIndex={c.selected_image_index}
              prompt={imgPrompt}
              setPrompt={setImgPrompt}
              negative={imgNegative}
              setNegative={setImgNegative}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              onSelectImage={(idx) => setC(prev => ({ ...prev, selected_image_index: idx }))}
              onRemoveImage={() => setC(prev => {
                const newVariants = prev.image_variants.filter((_: string, i: number) => i !== prev.selected_image_index);
                return { ...prev, image_variants: newVariants, selected_image_index: Math.max(0, prev.selected_image_index - 1) };
              })}
              onImageSaved={(path) => {
                setC(prev => {
                  const newVariants = [...prev.image_variants, path];
                  return { ...prev, image_variants: newVariants, selected_image_index: newVariants.length - 1 };
                });
              }} 
            />
          )}
        </div>
      </div>

      {/* РЕНДЕР МОДАЛКИ ЛОГОВ */}
      {showTerminal && <TerminalModal onClose={() => setShowTerminal(false)} />}
    </div>
  );
}