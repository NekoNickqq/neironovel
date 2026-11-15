import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Plus, Globe, User, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CardTilt } from './CardTilt';
import { WorldCardView } from './WorldCardView';
import { CharacterCardView } from './CharacterCardView';

export function Catalog() {
  const { state } = useApp();
  const [tab, setTab] = useState<'worlds' | 'characters'>('worlds');
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="min-h-screen bg-gray-950 relative flex flex-col">
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-10">
        <ArrowLeft size={20} /> Назад
      </button>

      <div className="w-full px-8 py-10 flex flex-col flex-1">
        <div className="flex justify-center items-center mb-10">
          <button onClick={() => setTab('worlds')} className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${tab === 'worlds' ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]' : 'text-gray-500 hover:text-gray-300'}`}>
            <Globe size={18} className={tab === 'worlds' ? 'text-emerald-400' : ''} />
            <span className="font-semibold tracking-wider text-sm uppercase">Миры</span>
          </button>

          <div className="w-[1px] h-6 bg-white/50 mx-4" />

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

          <div className="w-[1px] h-6 bg-white/50 mx-4" />

          <button onClick={() => setTab('characters')} className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${tab === 'characters' ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]' : 'text-gray-500 hover:text-gray-300'}`}>
            <User size={18} className={tab === 'characters' ? 'text-emerald-400' : ''} />
            <span className="font-semibold tracking-wider text-sm uppercase">Персонажи</span>
          </button>
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
                <CardTilt key={w.id} className="cursor-pointer w-full" onClick={() => navigate(`/catalog/world/${w.id}`)}>
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
                <CardTilt key={c.id} className="cursor-pointer w-full" onClick={() => navigate(`/catalog/character/${c.id}`)}>
                  <CharacterCardView data={c} image={c.image_variants?.[c.selected_image_index]} />
                </CardTilt>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}