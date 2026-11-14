import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import { X, Sparkles, Save } from 'lucide-react';

export function CardModal({ type, onClose }: { type: 'world' | 'character', onClose: () => void }) {
  // ИСПРАВЛЕНИЕ: используем refreshCatalog вместо refreshData
  const { refreshCatalog } = useApp(); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Стейты для мира
  const [w, setW] = useState({ name: '', history: '', features: '', appearance: '', negative_prompt: '' });
  // Стейты для персонажа
  const [c, setC] = useState({ name: '', appearance: '', personality: '', features: '', negative_appearance: '', negative_personality: '' });

  // Валидация обязательных полей
  const isWorldValid = w.name && w.history && w.features && w.appearance;
  const isCharValid = c.name && c.appearance && c.personality;

  const handleGenerateNegative = async () => {
    if (type === 'world' && !isWorldValid) return;
    if (type === 'character' && !isCharValid) return;
    
    setLoading(true);
    try {
      const res = await api.generateNegative(type, type === 'world' ? w : c);
      if (type === 'world') setW({ ...w, negative_prompt: res.negative });
      else setC({ ...c, negative_appearance: res.negative, negative_personality: res.negative });
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (type === 'world') await api.createWorld(w);
      else await api.createCharacter(c);
      
      await refreshCatalog(); // <-- ОБНОВЛЯЕМ КАТАЛОГ
      onClose();
    } catch (e: any) { setError(e.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6 text-white max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Новая карточка: {type === 'world' ? 'Мир' : 'Персонаж'}</h2>
          <button onClick={onClose}><X /></button>
        </div>
        
        <div className="space-y-4">
          {type === 'world' ? (
            <>
              <input placeholder="Название мира *" value={w.name} onChange={e => setW({...w, name: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="История мира *" value={w.history} onChange={e => setW({...w, history: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Особенности мира *" value={w.features} onChange={e => setW({...w, features: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Внешний вид (Стиль) *" value={w.appearance} onChange={e => setW({...w, appearance: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Негативный промпт" value={w.negative_prompt} onChange={e => setW({...w, negative_prompt: e.target.value})} className="w-full bg-red-900/20 text-red-200 p-2 rounded focus:border-red-500 outline-none" />
            </>
          ) : (
            <>
              <input placeholder="Имя *" value={c.name} onChange={e => setC({...c, name: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Внешность *" value={c.appearance} onChange={e => setC({...c, appearance: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Характер *" value={c.personality} onChange={e => setC({...c, personality: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Особенности" value={c.features} onChange={e => setC({...c, features: e.target.value})} className="w-full bg-gray-800 p-2 rounded focus:border-purple-500 outline-none" />
              <textarea placeholder="Негатив (Внешность)" value={c.negative_appearance} onChange={e => setC({...c, negative_appearance: e.target.value})} className="w-full bg-red-900/20 text-red-200 p-2 rounded focus:border-red-500 outline-none" />
              <textarea placeholder="Негатив (Характер)" value={c.negative_personality} onChange={e => setC({...c, negative_personality: e.target.value})} className="w-full bg-red-900/20 text-red-200 p-2 rounded focus:border-red-500 outline-none" />
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button onClick={handleGenerateNegative} disabled={loading || (type === 'world' ? !isWorldValid : !isCharValid)} className="flex-1 flex justify-center items-center gap-2 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded font-medium transition-all">
              <Sparkles size={16} /> {loading ? 'Генерация...' : 'Сгенерировать негатив'}
            </button>
            <button onClick={handleSave} disabled={loading} className="flex-1 flex justify-center items-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-all">
              <Save size={16} /> Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}