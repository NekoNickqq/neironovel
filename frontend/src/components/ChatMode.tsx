import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useApp } from '../store';
import { ArrowLeft, ArrowUp, ImagePlus, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Server } from 'lucide-react';
import { Message, TextBlock } from '../types';
import { SceneImage } from './SceneImage';
import { OllamaSettingsModal } from './OllamaSettingsModal';

/**
 * Хук: добавляет класс is-overflowing к элементу только когда контент
 * выходит за его пределы — скроллбар виден лишь при переполнении.
 */
function useOverflowIndicator<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.toggle('is-overflowing', el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);

  return { ref, check };
}

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
  const {
    state, dispatch, currentDialogue, sendMessage, regenerateText, regenerateImage,
    selectImage, selectTextVersion, setSelectedOllamaModel, refreshOllamaModels,
  } = useApp();
  const [inputText, setInputText] = useState('');
  const [showOllamaSettings, setShowOllamaSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { ref: smartScrollRef, check: checkOverflow } = useOverflowIndicator<HTMLDivElement>();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentDialogue?.messages.length]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    // Shift+Enter — обычный перенос строки (не перехватываем)
    if (e.shiftKey) return;
    e.preventDefault();
    // Enter — отправить только текст; Ctrl/Cmd+Enter — с картинкой
    handleSend(e.ctrlKey || e.metaKey);
  };

  const handleSend = async (withImage: boolean) => {
    // trim() + защита от пробелов: текст из "пробелов" не должен отправляться
    const text = inputText.trim();
    if (!text || state.isGenerating) return;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    requestAnimationFrame(checkOverflow);
    try {
      await sendMessage(text, withImage);
    } catch {
      // ошибка уже показана в статус-баре (SET_API_ERROR в store)
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
          {/* Выбор модели */}
          <select
            value={state.selectedOllamaModel ?? ''}
            onChange={e => setSelectedOllamaModel(e.target.value || null)}
            title="Выбор модели"
            aria-label="Выбор модели"
            className="max-w-[220px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-purple-500 outline-none"
          >
            {state.ollamaModels.length === 0 && <option value="">Выбор модели</option>}
            {state.ollamaModels.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {state.selectedOllamaModel && !state.ollamaModels.includes(state.selectedOllamaModel) && (
              <option value={state.selectedOllamaModel}>{state.selectedOllamaModel}</option>
            )}
          </select>
          <button
            onClick={() => void refreshOllamaModels()}
            title="Обновить список моделей"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowOllamaSettings(true)}
            title="Настройки подключения к модели (локально / API-ключ)"
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm transition-all"
          >
            <Server size={16} />
            Выбор модели
          </button>
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

      {showOllamaSettings && (
        <OllamaSettingsModal onClose={() => setShowOllamaSettings(false)} />
      )}

      {/* Messages area */}
      <div ref={smartScrollRef} className="flex-1 overflow-y-auto px-6 py-6 smart-scroll">
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
              onSelectImage={(messageId, index) => void selectImage(messageId, index)}
              onSelectVersion={(messageId, index) => void selectTextVersion(messageId, index)}
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
                  <span className="text-gray-400 text-sm">
                    {state.isGeneratingImage
                      ? 'Генерация изображения через ComfyUI...'
                      : 'Языковая модель генерирует ответ...'}
                  </span>
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
          <div className="flex items-end gap-2 rounded-2xl border border-gray-700 bg-gray-900/60 p-2 transition-colors focus-within:border-purple-500">
            {/* Колонка миниатюрных круглых кнопок: картинка — сверху, обычная отправка — снизу */}
            <div className="flex flex-col gap-1.5 shrink-0 pb-0.5">
              <button
                type="button"
                onClick={() => void handleSend(true)}
                disabled={state.isGenerating || !inputText.trim()}
                className="grid h-9 w-9 place-items-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/25 transition-all hover:bg-purple-500 hover:scale-105 active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 disabled:shadow-none disabled:hover:scale-100"
                title="Отправить с картинкой (Ctrl+Enter)"
                aria-label="Отправить с картинкой"
              >
                <ImagePlus size={16} />
              </button>
              <button
                type="button"
                onClick={() => void handleSend(false)}
                disabled={state.isGenerating || !inputText.trim()}
                className="grid h-9 w-9 place-items-center rounded-full bg-gray-700 text-gray-200 transition-all hover:bg-gray-600 hover:scale-105 active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 disabled:hover:scale-100"
                title="Отправить только текст (Enter)"
                aria-label="Отправить только текст"
              >
                <ArrowUp size={16} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(Math.max(e.target.scrollHeight, 64), 160) + 'px';
                checkOverflow();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Опиши действие или реплику... (Enter — текст, Ctrl+Enter — с картинкой, Shift+Enter — перенос строки)"
              rows={2}
              className="min-h-[64px] max-h-[160px] flex-1 resize-none bg-transparent px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none smart-scroll"
              disabled={state.isGenerating}
            />
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
  const { state } = useApp();
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

          {!isUser && message.image_error && !currentImage && (
            <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">
                Картинка не сгенерирована
              </p>
              <p className="text-sm text-red-200/90 whitespace-pre-wrap break-words">
                {message.image_error}
              </p>
            </div>
          )}

          {currentImage && (
            <div className="mt-4">
              <SceneImage
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
                      <SceneImage src={img} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
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
              disabled={state.isGenerating}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <RefreshCw size={12} />
              Текст
            </button>
            {message.has_image || (!!message.image_error && !isUser) ? (
              <button
                onClick={() => onRegenerateImage(message.id)}
                disabled={state.isGenerating}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <ImagePlus size={12} />
                {message.has_image ? 'Картинка' : 'Повторить картинку'}
              </button>
            ) : null}
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
