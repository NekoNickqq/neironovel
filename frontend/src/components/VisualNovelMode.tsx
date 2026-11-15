import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { RefreshCw, Eye, EyeOff, ImagePlus, MessageSquare, Sparkles } from 'lucide-react';
import { SceneImage } from './SceneImage';
import { TextBlockRenderer } from './TextBlockRenderer';

export function VisualNovelMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { state, currentDialogue, openDialogue, sendMessage, regenerateText, regenerateImage } = useApp();
  
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [showUI, setShowUI] = useState(true);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Загружаем диалог, если его нет в памяти
  useEffect(() => {
    if (id && (!currentDialogue || currentDialogue.id !== id)) {
      void openDialogue(id);
    }
  }, [id, currentDialogue, openDialogue]);

  const messages = currentDialogue?.messages || [];
  
  const getBackgroundImage = () => {
    for (let i = currentMessageIndex; i >= 0; i--) {
      if (messages[i]?.has_image) {
        const msg = messages[i];
        return msg.image_variants.length > 0 ? msg.image_variants[msg.selected_image_index] : msg.image_path;
      }
    }
    return null;
  };

  const backgroundImage = getBackgroundImage();
  const currentMessage = messages[currentMessageIndex];

  // Typewriter effect
  useEffect(() => {
    if (!currentMessage) return;
    
    const blocks = currentMessage.text_versions.length > 0 && currentMessage.selected_version_index > 0
      ? currentMessage.text_versions[currentMessage.selected_version_index - 1]
      : currentMessage.blocks;
    
    const fullText = blocks.map(b => {
      const prefix = b.speaker === 'narrator' ? '' : `${b.speaker === 'hero' ? '⚔️ ' : b.speaker === 'sidekick' ? '🛡️ ' : ''}`;
      return `${prefix}${b.text}`;
    }).join('\n\n');

    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText(fullText.substring(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [currentMessageIndex, currentMessage?.selected_version_index]);

  const goNext = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      if (!currentMessage) return;
      const blocks = currentMessage.text_versions.length > 0 && currentMessage.selected_version_index > 0
        ? currentMessage.text_versions[currentMessage.selected_version_index - 1]
        : currentMessage.blocks;
      setDisplayedText(blocks.map(b => b.text).join('\n\n'));
      return;
    }
    if (currentMessageIndex < messages.length - 1) {
      setCurrentMessageIndex(prev => prev + 1);
    }
  }, [currentMessageIndex, messages.length, isTyping, currentMessage]);

  const goPrev = useCallback(() => {
    if (currentMessageIndex > 0) setCurrentMessageIndex(prev => prev - 1);
  }, [currentMessageIndex]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (document.activeElement !== textareaRef.current) { e.preventDefault(); goNext(); }
      }
      if (e.key === 'ArrowLeft') {
        if (document.activeElement !== textareaRef.current) { e.preventDefault(); goPrev(); }
      }
      if (e.key === 'Escape') {
        if (!showUI) {
          setShowUI(true);
        } else if (currentDialogue) {
          navigate('/chat/' + currentDialogue.id); // <-- Навигация через роутер
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, showUI, navigate, currentDialogue]);

  useEffect(() => {
    if (currentMessageIndex >= messages.length - 2) {
      setCurrentMessageIndex(messages.length - 1);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!textInput.trim() || state.isGenerating) return;
    sendMessage(textInput.trim(), true);
    setTextInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Экран загрузки, если диалог еще не пришел
  if (!currentDialogue || currentDialogue.id !== id || !currentMessage) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-purple-500" size={32} />
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  const isAtLastMessage = currentMessageIndex === messages.length - 1;
  const currentBlocks = currentMessage.text_versions.length > 0 && currentMessage.selected_version_index > 0
    ? currentMessage.text_versions[currentMessage.selected_version_index - 1]
    : currentMessage.blocks;

  return (
    <div className="h-screen relative overflow-hidden bg-black select-none">
      {backgroundImage && (
        <div className="absolute inset-0">
          <SceneImage src={backgroundImage} alt="Scene background" className="w-full h-full object-cover transition-opacity duration-1000" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </div>
      )}

      <div className="absolute left-0 top-0 bottom-0 w-[10%] cursor-pointer z-10" onClick={goPrev} />
      <div className="absolute right-0 top-0 bottom-0 w-[10%] cursor-pointer z-10" onClick={goNext} />

      {showUI && (
        <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
          {/* Кнопка возврата в чат */}
          <button onClick={() => navigate('/chat/' + currentDialogue.id)} className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all" title="Режим чата">
            <MessageSquare size={18} />
          </button>
          
          {currentMessage.role === 'assistant' && (
            <>
              <button onClick={() => regenerateImage(currentMessage.id, 'same')} className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all" title="Ещё вариант (тот же промпт)"><ImagePlus size={18} /></button>
              <button onClick={() => regenerateImage(currentMessage.id, 'new')} className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all" title="Новый промпт через LLM"><Sparkles size={18} /></button>
              <button onClick={() => regenerateText(currentMessage.id)} className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all" title="Перегенерировать текст"><RefreshCw size={18} /></button>
            </>
          )}
          <button onClick={() => setShowUI(false)} className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all" title="Скрыть UI (Esc чтобы показать)"><EyeOff size={18} /></button>
        </div>
      )}

      {!showUI && (
        <button onClick={() => setShowUI(true)} className="absolute top-4 right-4 p-3 bg-black/30 hover:bg-black/50 backdrop-blur rounded-full text-white/50 transition-all z-30"><Eye size={18} /></button>
      )}

      {showUI && (
        <div className="absolute top-4 left-4 z-30">
          <div className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur rounded-lg">
            <span className="text-xs text-gray-300">{currentMessageIndex + 1} / {messages.length}</span>
            <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${((currentMessageIndex + 1) / messages.length) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="vn-text-box px-8 pt-16 pb-8">
          <div className="max-w-4xl mx-auto">
            {isAtLastMessage && !state.isGenerating ? (
              <div className="space-y-4">
                <div className="space-y-3 mb-4">
                  {currentBlocks.map((block, idx) => (
                    <TextBlockRenderer 
                      key={idx} 
                      block={block} 
                      variant="novel"
                      displayedText={idx === currentBlocks.length - 1 ? displayedText : undefined} 
                      isLast={idx === currentBlocks.length - 1} 
                    />
                  ))}
                </div>
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={textareaRef} value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Что делать дальше? (Enter — отправить)" rows={2}
                    className="flex-1 px-4 py-3 bg-black/60 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors resize-none backdrop-blur disabled:opacity-50"
                    disabled={state.isGenerating}
                  />
                  <button onClick={handleSend} disabled={state.isGenerating || !textInput.trim()} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 rounded-xl text-white font-medium transition-all">
                    Отправить
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentBlocks.map((block, idx) => (
                  <TextBlockRenderer 
                    key={idx} 
                    block={block} 
                    variant="novel"
                    displayedText={idx === currentBlocks.length - 1 ? displayedText : undefined} 
                    isLast={idx === currentBlocks.length - 1} 
                  />
                ))}
                {!isTyping && (
                  <div className="text-xs text-gray-500 text-right mt-4 animate-pulse">▶ Нажмите → или пробел для продолжения</div>
                )}
              </div>
            )}

            {state.isGenerating && (
              <div className="flex items-center gap-3 py-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-gray-400 text-sm">ИИ создаёт продолжение...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}