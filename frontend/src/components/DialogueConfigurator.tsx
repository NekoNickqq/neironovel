import { useApp } from '../store';

interface Props {
  selectedWorldId: string;
  setSelectedWorldId: (id: string) => void;
  selectedCharIds: string[];
  setSelectedCharIds: (ids: string[]) => void;
}

export function DialogueConfigurator({ selectedWorldId, setSelectedWorldId, selectedCharIds, setSelectedCharIds }: Props) {
  const { state } = useApp();

  return (
    <div className="space-y-8">
      <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">🌍 Мир (Обязательно)</h3>
        </div>
        <select 
          value={selectedWorldId} 
          onChange={e => setSelectedWorldId(e.target.value)} 
          className="w-full bg-gray-900/50 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-emerald-500"
        >
          <option value="">-- Выберите мир из каталога --</option>
          {state.worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="bg-surface/50 backdrop-blur border border-purple-900/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">👥 Персонажи</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {state.characters.length === 0 && <p className="text-gray-500 text-sm col-span-2">В каталоге нет персонажей.</p>}
          {state.characters.map(c => (
            <label 
              key={c.id} 
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${selectedCharIds.includes(c.id) ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500'}`}
            >
              <input 
                type="checkbox" 
                checked={selectedCharIds.includes(c.id)} 
                onChange={(e) => {
                  if (e.target.checked) setSelectedCharIds([...selectedCharIds, c.id]);
                  else setSelectedCharIds(selectedCharIds.filter(id => id !== c.id));
                }} 
                className="w-4 h-4 mt-1" 
              />
              <div>
                <div className="text-white font-medium text-sm">{c.name}</div>
                <div className="text-gray-400 text-xs line-clamp-1">{c.appearance}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}