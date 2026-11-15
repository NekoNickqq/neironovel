import { CharacterCard } from '../types';
import { getDisplayName } from '../utils';
import { User } from 'lucide-react';

export function CharacterCardView({ data, image }: { data: CharacterCard; image: string | null }) {
  return (
    <div 
      className="relative flex flex-col aspect-[9/16] w-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 group"
      style={{ containerType: 'inline-size' }}
    >
      <div 
        className="absolute left-0 right-0 z-20 flex flex-col items-center px-2"
        style={{ top: 'clamp(4px, 3cqw, 16px)' }}
      >
        <h3 
          className="inline-block text-white font-bold text-center leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-emerald-400 transition-colors pb-1 border-b-2 border-white/40 truncate max-w-full" 
          style={{ fontSize: 'clamp(8px, 6cqw, 18px)' }}
          title={data.name}
        >
          {getDisplayName(data.name)}
        </h3>
        <span 
          className="text-white/40 font-mono mt-1 tracking-wider"
          style={{ fontSize: 'clamp(6px, 3.5cqw, 12px)' }}
        >
          id {data.id ? data.id.slice(0, 6) : '000000'}
        </span>
      </div>
      
      <div className="h-[75%] w-full bg-gray-800/50 flex items-center justify-center relative border-b border-gray-800 overflow-hidden">
        {image ? (
          <img src={image} alt={data.name} className="w-full h-full object-cover object-top" />
        ) : (
          <User className="text-gray-700/50" style={{ width: '20cqw', height: '20cqw' }} />
        )}
      </div>
      
      <div 
        className="h-[25%] flex flex-col justify-start bg-gradient-to-b from-gray-900 to-gray-950 overflow-hidden"
        style={{ padding: 'clamp(4px, 3cqw, 12px)' }}
      >
        <p 
          className="text-gray-400 line-clamp-3 leading-tight"
          style={{ fontSize: 'clamp(6px, 4cqw, 12px)' }}
        >
          {data.appearance || data.personality}
        </p>
      </div>
    </div>
  );
}