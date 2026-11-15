import { useState, useMemo } from 'react';
import { useApp } from '../store';
import { CardTilt } from './CardTilt';
import { Search } from 'lucide-react';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';
import { WorldCard, CharacterCard } from '../types';

interface Props {
  type: 'world' | 'character';
  onSelect: (data: any) => void;
}

export function MiniCatalog({ type, onSelect }: Props) {
  const { state } = useApp();
  const items = type === 'world' ? state.worlds : state.characters;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [cardSize, setCardSize] = useState(type === 'world' ? 220 : 140);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const lowerQ = searchQuery.toLowerCase();
    
    return items.filter((item) => {
      const textToSearch = type === 'world' 
        ? (item as WorldCard).history 
        : (item as CharacterCard).appearance;
        
      return (
        item.name.toLowerCase().includes(lowerQ) || 
        textToSearch?.toLowerCase().includes(lowerQ)
      );
    });
  }, [items, searchQuery, type]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
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
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm">Ничего не найдено</div>
        ) : (
          <div 
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, ${cardSize}px))` }}
          >
            {filteredItems.map((item: any) => (
              <CardTilt key={item.id} className="cursor-pointer w-full" onClick={() => onSelect(item)}>
                {type === 'world' ? (
                  <WorldCardView data={item} image={item.image_variants?.[item.selected_image_index]} />
                ) : (
                  <CharacterCardView data={item} image={item.image_variants?.[item.selected_image_index]} />
                )}
              </CardTilt>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}