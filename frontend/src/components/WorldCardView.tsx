import { WorldCard } from '../types';
import { getDisplayName } from '../utils';
import { Image as ImageIcon } from 'lucide-react';

export function WorldCardView({ data, image }: { data: WorldCard; image: string | null }) {
  return (
    <div 
      className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 group"
      style={{ containerType: 'inline-size' }}
    >
      <span 
        className="absolute z-20 text-white/40 font-mono tracking-wider"
        style={{ 
          top: 'clamp(2px, 2cqw, 12px)', 
          left: 'clamp(2px, 2cqw, 12px)', 
          fontSize: 'clamp(6px, 2.5cqw, 14px)' 
        }}
      >
        id {data.id ? data.id.slice(0, 6) : '000000'}
      </span>
      
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 overflow-hidden">
        {image ? (
          <img src={image} alt={data.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-gray-700/50" style={{ width: '15cqw', height: '15cqw' }} />
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col overflow-hidden">
        <div style={{ padding: '0 clamp(4px, 3cqw, 16px)', paddingBottom: 'clamp(2px, 1cqw, 8px)' }}>
          <h3 
            className="text-white font-bold leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-emerald-400 transition-colors truncate" 
            style={{ fontSize: 'clamp(8px, 4.5cqw, 20px)' }}
            title={data.name}
          >
            {getDisplayName(data.name)}
          </h3>
        </div>
        <div 
          // ДОБАВЛЕН rounded-b-2xl, чтобы починить нижние углы при backdrop-blur
          className="bg-black/60 backdrop-blur-md border-t border-white/5 w-full block rounded-b-2xl"
          style={{ padding: 'clamp(4px, 3cqw, 16px)' }}
        >
          <p 
            className="text-gray-200 line-clamp-3 leading-tight opacity-90"
            style={{ fontSize: 'clamp(6px, 3.5cqw, 14px)' }}
          >
            {data.history}
          </p>
        </div>
      </div>
    </div>
  );
}