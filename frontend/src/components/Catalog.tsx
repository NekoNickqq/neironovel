import { useState } from 'react';
import { useApp } from '../store';
import { ArrowLeft, Plus, Globe, User, Image as ImageIcon } from 'lucide-react';
import { CardModal } from './CardModal';

// Функция для сокращения имени
function getDisplayName(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  let count = Math.min(4, words.length);
  let display = words.slice(0, count).join(' ');
  let truncated = count < words.length;

  while (display.length > 40 && count > 1) {
    count--;
    display = words.slice(0, count).join(' ');
    truncated = true;
  }

  return truncated ? `${display}...` : display;
}

export function Catalog() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<'worlds' | 'characters'>('worlds');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 relative flex flex-col">
      {modalOpen && <CardModal type={tab === 'worlds' ? 'world' : 'character'} onClose={() => setModalOpen(false)} />}

      {/* Кнопка Назад */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'list' })}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-10"
      >
        <ArrowLeft size={20} /> Назад
      </button>

      <div className="w-full px-8 py-10 flex flex-col flex-1">
        
        {/* Табы */}
        <div className="flex justify-center items-center mb-10">
          <button
            onClick={() => setTab('worlds')}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${
              tab === 'worlds'
                ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Globe size={18} className={tab === 'worlds' ? 'text-emerald-400' : ''} />
            <span className="font-semibold tracking-wider text-sm uppercase">Миры</span>
          </button>

          <div className="w-[1px] h-6 bg-white/50 mx-4" />

          <button
            onClick={() => setTab('characters')}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 ${
              tab === 'characters'
                ? 'text-white bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User size={18} className={tab === 'characters' ? 'text-emerald-400' : ''} />
            <span className="font-semibold tracking-wider text-sm uppercase">Персонажи</span>
          </button>
        </div>

        {/* Сетка карточек */}
        <div className="w-full">
          {tab === 'worlds' ? (
            /* СЕТКА МИРОВ */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <button
                onClick={() => setModalOpen(true)}
                // Уменьшена высота: aspect-[16/10] вместо 4/3
                className="aspect-[16/10] rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/5 flex flex-col items-center justify-center transition-all group"
              >
                <Plus size={48} className="text-blue-500/70 group-hover:text-blue-400 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-blue-500/70 text-sm font-medium">Новый мир</span>
              </button>

              {state.worlds.map(w => (
                <div key={w.id} className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 group cursor-pointer flex flex-col justify-end">
                  {/* ID карточки слева сверху */}
                  <span className="absolute top-3 left-3 z-20 text-white/40 text-xs font-mono tracking-wider">
                    id {w.id ? w.id.slice(0, 6) : '000000'}
                  </span>

                  {/* Фоновая картинка */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                    <ImageIcon size={48} className="text-gray-700/50" />
                  </div>

                  {/* Контент снизу */}
                  <div className="relative z-10 w-full flex flex-col">
                    {/* Имя (вне блюра) */}
                    <div className="px-4 pb-2">
                      <h3 className="text-white font-bold text-lg leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-emerald-400 transition-colors" title={w.name}>
                        {getDisplayName(w.name)}
                      </h3>
                    </div>
                    {/* Описание (внутри блюра, увеличено) */}
                    <div className="p-5 bg-black/50 backdrop-blur-md border-t border-white/5 w-full min-h-[45%] flex items-center">
                      <p className="text-gray-300 text-sm line-clamp-4 leading-relaxed opacity-90">
                        {w.history}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* СЕТКА ПЕРСОНАЖЕЙ (7 колонок) */
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              <button
                onClick={() => setModalOpen(true)}
                // Вытянутая пропорция aspect-[9/16]
                className="aspect-[9/16] rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/5 flex flex-col items-center justify-center transition-all group"
              >
                <Plus size={32} className="text-blue-500/70 group-hover:text-blue-400 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-blue-500/70 text-xs font-medium">Новый</span>
              </button>

              {state.characters.map(c => (
                <div key={c.id} className="relative flex flex-col aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 group cursor-pointer">
                  
                  {/* Имя по центру сверху с подчеркиванием по ширине текста и ID под ним */}
                  <div className="absolute top-3 left-0 right-0 z-20 flex flex-col items-center px-2">
                    <h3 className="inline-block text-white font-bold text-sm text-center leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-emerald-400 transition-colors pb-1 border-b-2 border-white/40 truncate max-w-full" title={c.name}>
                      {getDisplayName(c.name)}
                    </h3>
                    <span className="text-white/40 text-[10px] font-mono mt-1 tracking-wider">
                      id {c.id ? c.id.slice(0, 6) : '000000'}
                    </span>
                  </div>

                  {/* Блок картинки (65%) */}
                  <div className="h-[65%] w-full bg-gray-800/50 flex items-center justify-center relative border-b border-gray-800">
                    <User size={40} className="text-gray-700/50" />
                  </div>

                  {/* Блок текста (35%) */}
                  <div className="h-[35%] p-3 flex flex-col justify-center bg-gradient-to-b from-gray-900 to-gray-950">
                    <p className="text-gray-400 text-[11px] line-clamp-3 leading-tight">
                      {c.appearance || c.personality}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}