import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useApp } from '../store';
import { ArrowLeft, ImagePlus, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Server, Send, Terminal, Square } from 'lucide-react';
import { Message, TextBlock } from '../types';
import { SceneImage } from './SceneImage';
import { OllamaSettingsModal } from './OllamaSettingsModal';
import { MessageDebugModal } from './MessageDebugModal';
import { EditSettingsModal } from './EditSettingsModal';

function MessageBlock({ block, isFirst }: { block: TextBlock; isFirst: boolean }) {
  const fontClass = block.speaker === 'narrator' ? 'font-narrator' : block.speaker === 'hero' ? 'font-hero' : block.speaker === 'sidekick' ? 'font-sidekick' : 'font-user';
  return (
    <div className={!isFirst ? 'border-t border-white/10 pt-3 mt-3' : ''}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs uppercase tracking-wider ${block.speaker === 'narrator' ? 'text-purple-400' : block.speaker === 'hero' ? 'text-blue-400' : block.speaker === 'sidekick' ? 'text-emerald-400' : 'text-gray-400'}`}>
          {block.speaker === 'narrator' ? '📜 Рассказчик' : block.speaker === 'hero' ? '⚔️ Герой' : block.speaker === 'sidekick' ? '🛡️ Спутник' : '💬 Вы'}
        </span>
      </div>
      <p className={`${fontClass} text-base leading-relaxed whitespace-pre-wrap`}>{block.text}</p>
    </div>
  );
}

export function ChatMode() {
  const { state, dispatch, currentDialogue, sendMessage, stopGeneration, regenerateText, regenerateImage, selectImage, selectTextVersion, setSelectedOllamaModel, refreshOllamaModels } = useApp();
  const [inputText, setInputText] = useState('');
  const [showOllamaSettings, setShowOllamaSettings] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentDialogue?.messages.length]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(true); }
  };

  const handleSend = (withImage: boolean) => {
    if (!inputText.trim() || state.isGenerating) return;
    sendMessage(inputText.trim(), withImage);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  if (!currentDialogue) return null;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-950 to-gray-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-surface/30 backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'list' })} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-lg font-semibold text-white">{currentDialogue.title}</h2>
            <p className="text-xs text-gray-400">{currentDialogue.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={state.selectedOllamaModel ?? ''} onChange={e => setSelectedOllamaModel(e.target.value || null)} className="max-w-[220px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-purple-500 outline-none">
            {state.ollamaModels.length === 0 && <option value="">Нет моделей</option>}
            {state.ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
            {state.selectedOllamaModel && !state.ollamaModels.includes(state.selectedOllamaModel) && <option value={state.selectedOllamaModel}>{state.selectedOllamaModel}</option>}
          </select>
          <button onClick={() => void refreshOllamaModels()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"><RefreshCw size={16} /></button>
          <button onClick={() => setShowOllamaSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm transition-all"><Server size={16} /> Ollama</button>
          <button onClick={() => setShowEditSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm transition-all">📝 Настройки мира</button>
          <button onClick={() => { dispatch({ type: 'SELECT_DIALOGUE', payload: currentDialogue.id }); dispatch({ type: 'SET_VIEW', payload: 'novel' }); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-lg text-purple-300 text-sm transition-all"><BookOpen size={16} /> Режим ВН</button>
        </div>
      </div>

      {showOllamaSettings && <OllamaSettingsModal onClose={() => setShowOllamaSettings(false)} />}
      {showEditSettings && <EditSettingsModal onClose={() => setShowEditSettings(false)} />}

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
            <ChatMessageItem key={msg.id} message={msg} isLast={idx === currentDialogue.messages.length - 1} onRegenerateText={regenerateText} onRegenerateImage={regenerateImage} onSelectImage={(m, i) => void selectImage(m, i)} onSelectVersion={(m, i) => void selectTextVersion(m, i)} />
          ))}
          
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
                  {/* КНОПКА ОСТАНОВКИ */}
                  <button onClick={stopGeneration} className="ml-2 flex items-center gap-1 px-3 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 rounded text-red-300 text-xs transition-colors" title="Остановить генерацию">
                    <Square size={12} fill="currentColor" /> Стоп
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-800/50 bg-surface/30 backdrop-blur px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-xl border border-gray-700 bg-gray-900/50 p-2 pr-[72px] focus-within:border-purple-500 transition-colors">
            <textarea
              ref={textareaRef} value={inputText}
              onChange={e => { setInputText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
              onKeyDown={handleKeyDown} placeholder="Опиши действие или реплику... (Enter — с картинкой, Shift+Enter — перенос)" rows={3}
              className="w-full max-h-40 min-h-[72px] resize-none bg-transparent px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none overflow-y-auto scrollbar-thin" disabled={state.isGenerating}
            />
            <div className="absolute right-2 bottom-2 flex flex-col gap-2">
              <button onClick={() => handleSend(true)} disabled={state.isGenerating || !inputText.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:shadow-none" title="Отправить: Текст + Картинка (Enter)"><ImagePlus size={16} /></button>
              <button onClick={() => handleSend(false)} disabled={state.isGenerating || !inputText.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600" title="Отправить: только текст (Shift+Enter)"><Send size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessageItem({ message, isLast, onRegenerateText, onRegenerateImage, onSelectImage, onSelectVersion }: { message: Message; isLast: boolean; onRegenerateText: (id: string) => void; onRegenerateImage: (id: string, mode: 'same' | 'new') => void; onSelectImage: (messageId: string, index: number) => void; onSelectVersion: (messageId: string, index: number) => void; }) {
  const isUser = message.role === 'user';
  const [showDebug, setShowDebug] = useState(false);
  const currentBlocks = message.text_versions.length > 0 && message.selected_version_index > 0 ? message.text_versions[message.selected_version_index - 1] : message.blocks;
  const currentImage = message.image_variants.length > 0 ? message.image_variants[message.selected_image_index] : message.image_path;

  return (
    <div className={`message-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[85%]`}>
        <div className={`rounded-2xl p-5 ${isUser ? 'bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/30' : 'bg-surface/60 border border-gray-800/50'}`}>
          <div>{currentBlocks.map((block, idx) => <MessageBlock key={idx} block={block} isFirst={idx === 0} />)}</div>
          {currentImage && (
            <div className="mt-4">
              <SceneImage src={currentImage} alt="Scene" className="rounded-xl w-full max-h-96 object-cover border border-gray-700/50" />
              {message.image_variants.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {message.image_variants.map((img, idx) => (
                    <button key={idx} onClick={() => onSelectImage(message.id, idx)} className={`flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border-2 transition-all ${idx === message.selected_image_index ? 'border-purple-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                      <SceneImage src={img} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex items-center gap-2 mt-2 ml-2">
            <button onClick={() => onRegenerateText(message.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all"><RefreshCw size={12} /> Текст</button>
            {message.has_image && (
              <div className="group/regen inline-flex items-center overflow-hidden rounded-lg border border-transparent transition-colors duration-200 group-hover/regen:border-purple-700/40 group-hover/regen:bg-purple-950/30">
                <button onClick={() => onRegenerateImage(message.id, 'same')} className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs text-gray-400 transition-all duration-200 hover:text-white hover:bg-purple-800/40 hover:shadow-[0_0_12px_rgba(255,255,255,0.45),inset_0_0_8px_rgba(255,255,255,0.15)]" title="Ещё вариант (тот же промпт, новый seed) · ~15-30 сек"><ImagePlus size={12} /> <span>Картинка</span></button>
                <button onClick={() => onRegenerateImage(message.id, 'new')} className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-gray-400 max-w-0 px-0 py-1.5 opacity-0 transition-all duration-300 ease-out group-hover/regen:max-w-[120px] group-hover/regen:px-3 group-hover/regen:opacity-100 hover:text-white hover:bg-purple-800/40 hover:shadow-[0_0_12px_rgba(255,255,255,0.45),inset_0_0_8px_rgba(255,255,255,0.15)]" title="Новый промпт через LLM · ~30-60 сек"><RefreshCw size={12} /> <span>Новый</span></button>
              </div>
            )}
            <button onClick={() => setShowDebug(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-emerald-300 hover:bg-emerald-900/20 rounded-lg transition-all ml-1" title="Посмотреть логи генерации"><Terminal size={12} /> Логи</button>
            {message.text_versions.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => onSelectVersion(message.id, Math.max(0, message.selected_version_index - 1))} className="p-1 text-gray-400 hover:text-white" disabled={message.selected_version_index === 0}><ChevronLeft size={14} /></button>
                <span className="text-xs text-gray-500">v{message.selected_version_index + 1}/{message.text_versions.length + 1}</span>
                <button onClick={() => onSelectVersion(message.id, Math.min(message.text_versions.length, message.selected_version_index + 1))} className="p-1 text-gray-400 hover:text-white" disabled={message.selected_version_index >= message.text_versions.length}><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>
      {showDebug && <MessageDebugModal message={message} onClose={() => setShowDebug(false)} />}
    </div>
  );
}