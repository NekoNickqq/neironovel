import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Plus, Globe, User, Search, Upload, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CardTilt } from './CardTilt';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';
import { api } from '../api';
import { extractJsonFromPng, embedJsonToPng } from '../pngUtils';
import { toPng } from 'html-to-image';

export function Catalog() {
  const { state, refreshCatalog } = useApp();
  const [tab, setTab] = useState<'worlds' | 'characters'>('worlds');
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Режим экспорта (включается кнопкой)
  const [isExportMode, setIsExportMode] = useState(false);

  // Состояния для скрытого рендера при экспорте
  const [exportingCard, setExportingCard] = useState<any>(null);
  const [exportingType, setExportingType] = useState<'world' | 'character'>('world');
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        if (searchQuery === '') setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  const items = tab === 'worlds' ? state.worlds : state.characters;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const lowerQ = searchQuery.toLowerCase();
    return items.filter((item: any) => 
      item.name.toLowerCase().includes(lowerQ) || 
      (tab === 'worlds' ? item.history : item.appearance)?.toLowerCase().includes(lowerQ)
    );
  }, [items, searchQuery, tab]);

  const handleOpenCard = (id: string, type: 'world' | 'character', newTab: boolean = false) => {
    const url = `/catalog/${type}/${id}`;
    if (newTab) {
      window.open(`${url}?returnTo=/catalog`, '_blank');
    } else {
      navigate(url, { state: { returnTo: '/catalog' } });
    }
  };

  const handleCardClick = (card: any, type: 'world' | 'character') => {
    if (isExportMode) {
      setExportingCard(card);
      setExportingType(type);
      setIsExportMode(false); // Выключаем режим после клика
    } else {
      handleOpenCard(card.id, type, false);
    }
  };

  // --- ИМПОРТ ---
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await extractJsonFromPng(file);
    if (!data) return alert("В этом файле нет данных карточки!");

    try {
      if (data.type === 'world') {
        await api.createWorld(data);
      } else {
        await api.createCharacter(data);
      }
      await refreshCatalog();
      alert("Карточка успешно импортирована!");
    } catch (err) {
      alert("Ошибка импорта: " + err);
    }
  };

  // --- ЭКСПОРТ ---
  useEffect(() => {
    if (exportingCard && exportRef.current) {
      const performExport = async () => {
        try {
          await new Promise(r => setTimeout(r, 200));

          const dataUrl = await toPng(exportRef.current!, { backgroundColor: 'transparent', pixelRatio: 2 });
          const res = await fetch(dataUrl);
          const blob = await res.blob();

          const exportData = {
            type: exportingType,
            name: exportingCard.name,
            history: exportingCard.history,
            features: exportingCard.features,
            appearance: exportingCard.appearance,
            negative_prompt: exportingCard.negative_prompt,
            personality: exportingCard.personality,
            negative_appearance: exportingCard.negative_appearance,
            negative_personality: exportingCard.negative_personality,
            image_variants: exportingCard.image_variants,
          };

          const finalBlob = await embedJsonToPng(blob, exportData);
          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${exportingCard.name.replace(/\s+/g, '_')}.png`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          alert("Ошибка экспорта: " + err);
        } finally {
          setExportingCard(null);
        }
      };
      performExport();
    }
  }, [exportingCard, exportingType]);

  return (
    <div className="min-h-screen bg-gray-950 relative flex flex-col">
      
      {/* Кнопка Назад (левый верх) */}
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-10">
        <ArrowLeft size={20} /> Назад
      </button>

      {/* Кнопки Импорта и Экспорта (правый верх) */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
        <label className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/50 hover:bg-indigo-600/40 rounded-xl transition-colors cursor-pointer">
          <Upload size={18} /> Импорт
          <input type="file" accept=".png" className="hidden" onChange={handleImport} />
        </label>
        
        <button 
          onClick={() => setIsExportMode(!isExportMode)}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all ${
            isExportMode 
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse' 
              : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800'
          }`}
        >
          <Download size={18} /> 
          {isExportMode ? 'Выберите карточку' : 'Экспорт'}
        </button>
      </div>

      {/* Основной контейнер. Заменили pt-16 на pt-6, чтобы поднять вровень с кнопками */}
      <div className="w-full px-8 pt-6 pb-10 flex flex-col flex-1">
        
        {/* 3 колонки для идеального центрирования поиска */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-10 w-full">
          
          {/* Левая часть: Кнопка Миры */}
          <div className="flex justify-end pr-8">
            <button onClick={() => setTab('worlds')} className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${tab === 'worlds' ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]' : 'text-gray-500 hover:text-gray-300'}`}>
              <Globe size={18} className={tab === 'worlds' ? 'text-emerald-400' : ''} />
              <span className="font-semibold tracking-wider text-sm uppercase">Миры</span>
            </button>
          </div>

          {/* Центральная часть: Поиск */}
          <div className="flex justify-center">
            <div 
              ref={searchInputRef}
              className={`relative flex items-center transition-all duration-300 ease-in-out ${isSearchOpen ? 'w-64' : 'w-12'}`}
              onClick={() => {
                setIsSearchOpen(true);
                searchInputRef.current?.querySelector('input')?.focus();
              }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-white" size={18} />
              <input
                type="text"
                placeholder="Поиск по каталогу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-gray-900/50 border border-gray-700 text-sm text-white pl-10 pr-3 py-3 rounded-xl focus:outline-none focus:border-purple-500 cursor-pointer focus:cursor-text ${isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              />
            </div>
          </div>

          {/* Правая часть: Кнопка Персонажи */}
          <div className="flex justify-start pl-8">
            <button onClick={() => setTab('characters')} className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${tab === 'characters' ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]' : 'text-gray-500 hover:text-gray-300'}`}>
              <User size={18} className={tab === 'characters' ? 'text-emerald-400' : ''} />
              <span className="font-semibold tracking-wider text-sm uppercase">Персонажи</span>
            </button>
          </div>

        </div>

        <div className="w-full">
          {filteredItems.length === 0 && searchQuery && (
             <div className="text-center py-20 text-gray-500 text-lg">По запросу "{searchQuery}" ничего не найдено.</div>
          )}

          {tab === 'worlds' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <button onClick={() => navigate('/catalog/create-world', { state: { returnTo: '/catalog' } })} className="aspect-[16/10] rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/5 flex flex-col items-center justify-center transition-all group">
                <Plus size={48} className="text-blue-500/70 group-hover:text-blue-400 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-blue-500/70 text-sm font-medium">Новый мир</span>
              </button>
              
              {filteredItems.map((w: any) => (
                <CardTilt 
                  key={w.id} 
                  className="cursor-pointer w-full" 
                  onDoubleClick={(e) => { e.stopPropagation(); handleOpenCard(w.id, 'world', false); }}
                  onAuxClick={(e) => { if (e.button === 1) { e.stopPropagation(); handleOpenCard(w.id, 'world', true); } }}
                  onClick={() => handleCardClick(w, 'world')}
                >
                  <WorldCardView data={w} image={w.image_variants?.[w.selected_image_index]} />
                </CardTilt>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              <button onClick={() => navigate('/catalog/create-character', { state: { returnTo: '/catalog' } })} className="aspect-[9/16] rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/5 flex flex-col items-center justify-center transition-all group">
                <Plus size={32} className="text-blue-500/70 group-hover:text-blue-400 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-blue-500/70 text-xs font-medium">Новый</span>
              </button>
              
              {filteredItems.map((c: any) => (
                <CardTilt 
                  key={c.id} 
                  className="cursor-pointer w-full" 
                  onDoubleClick={(e) => { e.stopPropagation(); handleOpenCard(c.id, 'character', false); }}
                  onAuxClick={(e) => { if (e.button === 1) { e.stopPropagation(); handleOpenCard(c.id, 'character', true); } }}
                  onClick={() => handleCardClick(c, 'character')}
                >
                  <CharacterCardView data={c} image={c.image_variants?.[c.selected_image_index]} />
                </CardTilt>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* СКРЫТЫЙ БЛОК ДЛЯ ЭКСПОРТА */}
      {exportingCard && (
        <div 
          className="fixed top-0 left-0 opacity-0 pointer-events-none z-[-1]"
          style={{ width: exportingType === 'world' ? '800px' : '500px' }} 
        >
          <div ref={exportRef} className="bg-transparent rounded-2xl overflow-hidden shadow-2xl w-full">
            {exportingType === 'world' ? (
              <WorldCardView data={exportingCard} image={exportingCard.image_variants?.[exportingCard.selected_image_index]} />
            ) : (
              <CharacterCardView data={exportingCard} image={exportingCard.image_variants?.[exportingCard.selected_image_index]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}