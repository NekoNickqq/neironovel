import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useApp } from '../store';
import { ArrowLeft, ImagePlus, RefreshCw, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Message, TextBlock } from '../types';

function MessageBlock({ block, isFirst }: { block: TextBlock; isFirst: boolean }) {
  const fontClass = block.speaker === 'narrator' ? 'font-narrator'
    : block.speaker === 'hero' ? 'font-hero'
    : block.speaker === 'sidekick' ? 'font-sidekick'
    : 'font-user';

  return (
    <div className={!isFirst ? 'border-t border-white/10 pt-3 mt-3' : ''}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs uppercase tracking-wider ${
          block.speaker === 'narrator' ? 'text-purple-400'
          : block.speaker === 'hero' ? 'text-blue-400'
          : block.speaker === 'sidekick' ? 'text-emerald-400'
          : 'text-gray-400'
        }`}>
          {block.speaker === 'narrator' ? '📜 Рассказчик'
           : block.speaker === 'hero' ? '⚔️ Герой'
           : block.speaker === 'sidekick' ? '🛡️ Спутник'
           : '💬 Вы'}
        </span>
      </div>
      <p className={`${fontClass} text-base leading-relaxed whitespace-pre-wrap`}>
        {block.text}
      </p>
    </div>
  );
}



export function ChatMode() {
  const { state, dispatch, currentDialogue, sendMessage, regenerateText, regenerateImage } = useApp();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentDialogue?.messages.length]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(true);
    }
  };

  const handleSend = (withImage: boolean) => {
    if (!inputText.trim() || state.isGenerating) return;
    sendMessage(inputText.trim(), withImage);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  if (!currentDialogue) return null;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-surface/30 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'list' })}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{currentDialogue.title}</h2>
            <p className="text-xs text-gray-400">{currentDialogue.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              dispatch({ type: 'SELECT_DIALOGUE', payload: currentDialogue.id });
              dispatch({ type: 'SET_VIEW', payload: 'novel' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-lg text-purple-300 text-sm transition-all"
          >
            <BookOpen size={16} />
            Режим ВН
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto">
          {currentDialogue.messages.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎭</div>
              <p className="text-gray-400 text-lg">Начни свою историю...</p>
              <p className="text-gray-500 text-sm mt-2">Напиши первое сообщение ниже</p>
            </div>
          )}
          {currentDialogue.messages.map((msg, idx) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              isLast={idx === currentDialogue.messages.length - 1}
              onRegenerateText={regenerateText}
              onRegenerateImage={regenerateImage}
              onSelectImage={(messageId, index) => dispatch({ type: 'SELECT_IMAGE', payload: { messageId, index } })}
              onSelectVersion={(messageId, index) => dispatch({ type: 'SELECT_TEXT_VERSION', payload: { messageId, index } })}
            />
          ))}
          
          {/* Generating indicator */}
          {state.isGenerating && (
            <div className="flex justify-start mb-6">
              <div className="bg-surface/60 border border-gray-800/50 rounded-2xl p-5 generating">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-gray-400 text-sm">ИИ генерирует ответ...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800/50 bg-surface/30 backdrop-blur px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Опиши действие или реплику... (Enter — с картинкой, Shift+Enter — перенос)"
                rows={1}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors resize-none scrollbar-thin"
                disabled={state.isGenerating}
              />
            </div>
            <button
              onClick={() => handleSend(false)}
              disabled={state.isGenerating || !inputText.trim()}
              className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl text-gray-300 text-sm transition-all whitespace-nowrap"
              title="Только текст (Shift+Enter)"
            >
              💬 Текст
            </button>
            <button
              onClick={() => handleSend(true)}
              disabled={state.isGenerating || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl text-white text-sm font-medium transition-all whitespace-nowrap shadow-lg shadow-purple-600/20"
              title="Текст + Картинка (Enter)"
            >
              <ImagePlus size={16} />
              Текст + Картинка
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component for message items to avoid hooks issues
function ChatMessageItem({
  message,
  isLast,
  onRegenerateText,
  onRegenerateImage,
  onSelectImage,
  onSelectVersion,
}: {
  message: Message;
  isLast: boolean;
  onRegenerateText: (id: string) => void;
  onRegenerateImage: (id: string) => void;
  onSelectImage: (messageId: string, index: number) => void;
  onSelectVersion: (messageId: string, index: number) => void;
}) {
  const isUser = message.role === 'user';
  const currentBlocks = message.text_versions.length > 0 && message.selected_version_index > 0
    ? message.text_versions[message.selected_version_index - 1]
    : message.blocks;
  const currentImage = message.image_variants.length > 0
    ? message.image_variants[message.selected_image_index]
    : message.image_path;

  return (
    <div className={`message-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[85%]`}>
        <div className={`rounded-2xl p-5 ${
          isUser
            ? 'bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/30'
            : 'bg-surface/60 border border-gray-800/50'
        }`}>
          <div>
            {currentBlocks.map((block, idx) => (
              <MessageBlock key={idx} block={block} isFirst={idx === 0} />
            ))}
          </div>

          {currentImage && (
            <div className="mt-4">
              <img
                src={currentImage}
                alt="Scene"
                className="rounded-xl w-full max-h-96 object-cover border border-gray-700/50"
              />
              {message.image_variants.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {message.image_variants.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectImage(message.id, idx)}
                      className={`flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === message.selected_image_index ? 'border-purple-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-2 ml-2">
            <button
              onClick={() => onRegenerateText(message.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all"
            >
              <RefreshCw size={12} />
              Текст
            </button>
            {message.has_image && (
              <button
                onClick={() => onRegenerateImage(message.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all"
              >
                <ImagePlus size={12} />
                Картинка
              </button>
            )}
            {message.text_versions.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => onSelectVersion(message.id, Math.max(0, message.selected_version_index - 1))}
                  className="p-1 text-gray-400 hover:text-white"
                  disabled={message.selected_version_index === 0}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500">
                  v{message.selected_version_index + 1}/{message.text_versions.length + 1}
                </span>
                <button
                  onClick={() => onSelectVersion(message.id, Math.min(message.text_versions.length, message.selected_version_index + 1))}
                  className="p-1 text-gray-400 hover:text-white"
                  disabled={message.selected_version_index >= message.text_versions.length}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
