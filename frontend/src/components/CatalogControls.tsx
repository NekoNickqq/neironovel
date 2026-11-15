import { Search, SlidersHorizontal, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cardSize: number;
  setCardSize: (s: number) => void;
}

export function CatalogControls({ searchQuery, setSearchQuery, cardSize, setCardSize }: Props) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-900 border-b border-gray-800 shrink-0">
      {/* Поиск */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          type="text"
          placeholder="Поиск по каталогу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 text-sm text-white pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* Фильтр (заглушка) */}
      <button className="flex items-center gap-2 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Фильтры</span>
      </button>

      {/* Ползунок размера */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg">
        <Minimize2 size={14} className="text-gray-500" />
        <input
          type="range"
          min="150"
          max="400"
          step="10"
          value={cardSize}
          onChange={(e) => setCardSize(Number(e.target.value))}
          className="w-24 accent-purple-500 cursor-pointer"
          title="Размер карточек"
        />
        <Maximize2 size={14} className="text-gray-500" />
      </div>
    </div>
  );
}