import { TextBlock } from '../types';

interface Props {
  block: TextBlock;
  isFirst?: boolean;
  variant?: 'chat' | 'novel';
  displayedText?: string;
  isLast?: boolean;
  /** Переопределяет подпись говорящего; null скрывает её. */
  speakerLabel?: string | null;
}

export function TextBlockRenderer({ block, isFirst = false, variant = 'chat', displayedText, isLast, speakerLabel: speakerLabelOverride }: Props) {
  const text = isLast && displayedText !== undefined ? displayedText : block.text;
  
  const fontClass = block.speaker === 'narrator' ? 'font-narrator'
    : block.speaker === 'hero' ? 'font-hero'
    : block.speaker === 'sidekick' ? 'font-sidekick'
    : 'font-user';

  // В чате мы используем одни названия, в ВН-режиме - другие (можно поменять тут)
  const defaultSpeakerLabel = block.speaker === 'narrator' ? ''
    : block.speaker === 'hero' ? '⚔️ Герой' 
    : block.speaker === 'sidekick' ? '🛡️ Спутник' 
    : '💬 Вы';
  const speakerLabel = speakerLabelOverride === undefined ? defaultSpeakerLabel : speakerLabelOverride;

  // Разные стили-обертки для чата и ВН
  const containerClass = variant === 'chat' 
    ? (!isFirst ? 'border-t border-white/10 pt-3 mt-3' : '') 
    : (block.speaker !== 'narrator' ? 'pl-4 border-l-2 border-purple-500/30 mt-3' : 'mt-3');

  return (
    <div className={containerClass}>
      {speakerLabel && (
        <div className={`text-xs uppercase tracking-wider mb-1 ${
          block.speaker === 'hero' ? 'text-blue-400'
          : block.speaker === 'sidekick' ? 'text-emerald-400'
          : 'text-gray-400'
        }`}>
          {speakerLabel}
        </div>
      )}
      <p className={`${fontClass} ${variant === 'novel' ? 'text-lg' : 'text-base'} leading-relaxed whitespace-pre-wrap`}>
        {text}
        {/* Курсор печатающей машинки в ВН-режиме */}
        {isLast && displayedText !== undefined && displayedText.length < block.text.length && (
          <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse align-middle" />
        )}
      </p>
    </div>
  );
}