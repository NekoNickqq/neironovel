import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { CardTilt } from './CardTilt';
import { Search, Check } from 'lucide-react';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';
import { WorldCard, CharacterCard } from '../types';
import { useNavigate } from 'react-router-dom';

interface Props {
  type: 'world' | 'character';
  onSelect: (data: any, isMulti?: boolean) => void;
  onRemove?: (data: any) => void;
  onAddSelected?: () => void;
  selectedIds?: string[];      // Постоянно выбранные (тусклые)
  tempSelectedIds?: string[];  // Выбранные через Shift
  onClose?: () => void;
  returnTo?: string;
}

export function MiniCatalog({ type, onSelect, onRemove, onAddSelected, selectedIds = [], tempSelectedIds = [], onClose, returnTo = '/catalog' }: Props) {
  const { state } = useApp();
  const navigate = useNavigate();
  const items = type === 'world' ? state.worlds : state.characters;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [cardSize, setCardSize] = useState(type === 'world' ? 220 : 140);

  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimeout.current) clearTimeout(clickTimeout.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && tempSelectedIds.length > 0 && onAddSelected) {
        onAddSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tempSelectedIds, onAddSelected]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const lowerQ = searchQuery.toLowerCase();
    return items.filter((item) => {
      const textToSearch = type === 'world' ? (item as WorldCard).history : (item as CharacterCard).appearance;
      return item.name.toLowerCase().includes(lowerQ) || textToSearch?.toLowerCase().includes(lowerQ);
    });
  }, [items, searchQuery, type]);

  const handleOpenCard = (id: string, newTab: boolean = false) => {
    const url = `/catalog/${type}/${id}`;
    if (newTab) {
      window.open(`${url}?returnTo=${encodeURIComponent(returnTo)}`, '_blank');
    } else {
      navigate(url, { state: { returnTo } });
    }
  };

  const handleCardClick = (e: React.MouseEvent, item: any) => {
    const isPermanent = selectedIds.includes(item.id);
    
    if (e.shiftKey && isPermanent) return; // Нельзя выделять через Shift уже добавленных

    if (clickTimeout.current) clearTimeout(clickTimeout.current);

    clickTimeout.current = setTimeout(() => {
      if (isPermanent) {
        if (!e.shiftKey && onRemove) onRemove(item); // Клик по тусклой карточке убирает её
      } else {
        onSelect(item, e.shiftKey); // Shift добавляет во временные, обычный клик — в постоянные
      }
    }, 210);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 relative">
      <div className="flex items-center gap-3 p-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 text-sm text-white pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        
        <input
          type="range" min="100" max="300" step="10" value={cardSize}
          onChange={(e) => setCardSize(Number(e.target.value))}
          className="w-20 accent-purple-500 cursor-pointer"
          title="Размер карточек"
        />
        {onClose && (
          <button onClick={onClose} className="px-4 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg text-sm transition-colors">
            Отмена
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin pb-28">
        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm">Ничего не найдено</div>
        ) : (
          <div 
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, ${cardSize}px))` }}
          >
            {filteredItems.map((item: any) => {
              const isPermanent = selectedIds.includes(item.id);
              const isTemp = tempSelectedIds.includes(item.id);
              
              let cardClass = 'cursor-pointer w-full relative rounded-2xl transition-all duration-300 ';
              if (isPermanent) cardClass += 'opacity-40 grayscale scale-[0.98]';
              else if (isTemp) cardClass += 'ring-4 ring-purple-500 scale-[1.02] animate-shake';
              else cardClass += 'hover:scale-[1.02]';

              return (
                <div key={item.id} className="p-1">
                  <CardTilt 
                    className={cardClass} 
                    onClick={(e) => handleCardClick(e, item)}
                    onDoubleClick={(e) => { 
                      e.stopPropagation(); 
                      if (clickTimeout.current) clearTimeout(clickTimeout.current);
                      handleOpenCard(item.id, false); 
                    }}
                    onMouseDown={(e) => { 
                      if (e.button === 1) { 
                        e.preventDefault(); 
                        if (clickTimeout.current) clearTimeout(clickTimeout.current);
                        handleOpenCard(item.id, true); 
                      } 
                    }}
                  >
                    {type === 'world' ? (
                      <WorldCardView data={item} image={item.image_variants?.[item.selected_image_index]} />
                    ) : (
                      <CharacterCardView data={item} image={item.image_variants?.[item.selected_image_index]} />
                    )}
                    
                    {/* Галочка появляется ТОЛЬКО для временного выбора (Shift) */}
                    {isTemp && (
                      <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1 shadow-lg z-30">
                        <Check size={16} strokeWidth={3} />
                      </div>
                    )}
                  </CardTilt>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Кнопка "Добавить" появляется только если есть временно выбранные */}
      {tempSelectedIds.length > 0 && onAddSelected && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <button
            onClick={onAddSelected}
            className="pointer-events-auto bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)] animate-pop flex items-center gap-2"
          >
            <Check size={20} /> Добавить ({tempSelectedIds.length})
          </button>
        </div>
      )}
    </div>
  );
}