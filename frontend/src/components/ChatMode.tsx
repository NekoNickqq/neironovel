import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { ArrowLeft, ImagePlus, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Server, Send, Terminal, Square, Settings, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { SceneImage } from './SceneImage';
import { OllamaSettingsModal } from './OllamaSettingsModal';
import { MessageDebugModal } from './MessageDebugModal';
import { EditSettingsModal } from './EditSettingsModal';
import { TextBlockRenderer } from './TextBlockRenderer';

export function ChatMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { 
    state, dispatch, currentDialogue, openDialogue, sendMessage, stopGeneration, 
    regenerateText, regenerateImage, selectImage, selectTextVersion, 
    setSelectedOllamaModel, refreshOllamaModels 
  } = useApp();
  
  const [inputText, setInputText] = useState('');
  const [showOllamaSettings, setShowOllamaSettings] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Проверяем, есть ли стартовая локация (признак, что мир сгенерирован)
  const isWorldReady = !!currentDialogue?.settings?.world_state?.start_location;

  // Умный поллинг без спама запросов
  useEffect(() => {
    let isMounted = true;
    
    const checkStatus = async () => {
      if (!isMounted || isWorldReady || !id) return;
      
      try {
        await openDialogue(id);
      } catch (e) {
        console.error("Ошибка обновления статуса", e);
      }
      
      // Если мир еще не готов, ждем 3 секунды и проверяем снова
      if (isMounted && !isWorldReady) {
        setTimeout(checkStatus, 3000);
      }
    };

    if (!isWorldReady && currentDialogue) {
      const timer = setTimeout(checkStatus, 3000);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [id, isWorldReady]); // Зависит только от id и статуса готовности

  useEffect(() => { 
    if (isWorldReady) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }
  }, [currentDialogue?.messages.length, isWorldReady]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsHeaderVisible(false);
    } else {
      setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(true); 
    }
  };

  const handleSend = (withImage: boolean) => {
    if (!inputText.trim() || state.isGenerating || !isWorldReady) return;
    sendMessage(inputText.trim(), withImage);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  if (!currentDialogue || currentDialogue.id !== id) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-purple-500" size={32} />
          <p className="text-gray-400">Загрузка диалога...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 relative overflow-hidden">
      
      {/* НЕВИДИМАЯ ПАРЯЩАЯ ШАПКА */}
      <div className={`absolute top-0 left-0 right-0 z-40 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'} flex items-start justify-between px-6 py-4 pointer-events-none`}>
        
        {/* Градиент, чтобы текст не сливался с сообщениями */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-950/80 to-transparent -z-10" />

        {/* Кнопка Назад */}
        <button onClick={() => navigate('/')} className="pointer-events-auto p-2 bg-gray-800/80 backdrop-blur-md rounded-full text-gray-300 hover:text-white mt-2 transition-colors">
          <ArrowLeft size={20} />
        </button>

        {/* Центрированные названия */}
        <div className="flex flex-col items-center flex-1 mt-2 pointer-events-auto">
          <span className="text-xs text-gray-400 font-medium drop-shadow-md uppercase tracking-wider">
            {currentDialogue.description || "Безымянный мир"}
          </span>
          <span className="text-xl font-bold text-white drop-shadow-md">
            {currentDialogue.title}
          </span>
        </div>

        {/* Кнопки справа (ВН режим и Настройки) */}
        <div className="flex gap-2 pointer-events-auto mt-2">
          <button onClick={() => navigate('/novel/' + currentDialogue.id)} className="p-2 bg-purple-600/80 backdrop-blur-md rounded-full text-white hover:bg-purple-500 transition-colors" title="Режим ВН">
            <BookOpen size={20} />
          </button>
          <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="p-2 bg-gray-800/80 backdrop-blur-md rounded-full text-white hover:bg-gray-700 transition-colors" title="Настройки">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Выпадающее меню настроек */}
      {showSettingsMenu && (
        <div className="absolute top-20 right-6 w-64 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-2 z-50 flex flex-col gap-1 animate-fade-in pointer-events-auto">
          <div className="px-2 py-1 text-xs text-gray-500 uppercase font-semibold">Модель</div>
          <select 
            value={state.selectedOllamaModel ?? ''} 
            onChange={e => setSelectedOllamaModel(e.target.value || null)} 
            className="w-full bg-gray-900 text-sm text-white p-2 rounded-lg outline-none border border-gray-700 mb-1"
          >
            {state.ollamaModels.length === 0 && <option value="">Нет моделей</option>}
            {state.ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <button onClick={() => void refreshOllamaModels()} className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg text-left transition-colors">
            <RefreshCw size={14} /> Обновить список
          </button>
          
          <div className="h-px bg-gray-700 my-1" />
          
          <button onClick={() => { setShowEditSettings(true); setShowSettingsMenu(false); }} className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg text-left transition-colors">
            📝 Настройки мира
          </button>
          
          <button onClick={() => { setShowOllamaSettings(true); setShowSettingsMenu(false); }} className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg text-left transition-colors">
            <Server size={14} /> Настройки Ollama
          </button>
        </div>
      )}

      {showOllamaSettings && <OllamaSettingsModal onClose={() => setShowOllamaSettings(false)} />}
      {showEditSettings && <EditSettingsModal onClose={() => setShowEditSettings(false)} />}

      {/* ОБЛАСТЬ СООБЩЕНИЙ */}
      <div className="flex-1 overflow-y-auto pt-24 pb-24 px-6 scrollbar-thin" onScroll={handleScroll}>
        <div className="max-w-4xl mx-auto">
          
          {/* Экран загрузки мира */}
          {!isWorldReady && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
              <Loader2 size={48} className="animate-spin text-purple-500 mb-6" />
              <h2 className="text-2xl font-bold text-white mb-2">Генерация мира...</h2>
              <p className="text-gray-400 max-w-md">Нейросеть создает предысторию, базовые локации и сеты одежды. Пожалуйста, подождите.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-gray-500">
                <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Шаг 1: Предыстория</span>
                <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Шаг 2: Локации</span>
                <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Шаг 3: Одежда</span>
              </div>
            </div>
          )}

          {/* Приветствие */}
          {isWorldReady && currentDialogue.messages.length === 0 && (
            <div className="text-center py-20 animate-fade-in">
              <div className="text-6xl mb-4">🎭</div>
              <p className="text-gray-400 text-lg">Мир готов. Начни свою историю...</p>
            </div>
          )}
          
          {/* Сообщения */}
          {isWorldReady && currentDialogue.messages.map((msg, idx) => (
            <ChatMessageItem 
              key={msg.id} 
              message={msg} 
              isLast={idx === currentDialogue.messages.length - 1} 
              onRegenerateText={regenerateText} 
              onRegenerateImage={regenerateImage} 
              onSelectImage={(m, i) => void selectImage(m, i)} 
              onSelectVersion={(m, i) => void selectTextVersion(m, i)} 
            />
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
                  <button onClick={stopGeneration} className="ml-2 flex items-center gap-1 px-3 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 rounded text-red-300 text-xs transition-colors">
                    <Square size={12} fill="currentColor" /> Стоп
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ПОЛЕ ВВОДА */}
      <div className="border-t border-gray-800/50 bg-surface/30 backdrop-blur px-6 py-4 absolute bottom-0 left-0 right-0">
        <div className="max-w-4xl mx-auto">
          <div className={`relative flex items-end gap-2 rounded-xl border ${!isWorldReady ? 'border-gray-800 opacity-50 bg-gray-900/30' : 'border-gray-700 bg-gray-900/50'} p-2 pr-[72px] focus-within:border-purple-500 transition-colors`}>
            <textarea
              ref={textareaRef} 
              value={inputText}
              onChange={e => { 
                setInputText(e.target.value); 
                e.target.style.height = 'auto'; 
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; 
              }}
              onKeyDown={handleKeyDown} 
              placeholder={isWorldReady ? "Опиши действие или реплику... (Enter — с картинкой, Shift+Enter — перенос)" : "Ожидание генерации мира..."} 
              rows={3}
              className="w-full max-h-40 min-h-[72px] resize-none bg-transparent px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none overflow-y-auto scrollbar-thin" 
              disabled={state.isGenerating || !isWorldReady}
            />
            <div className="absolute right-2 bottom-2 flex flex-col gap-2">
              <button onClick={() => handleSend(true)} disabled={state.isGenerating || !inputText.trim() || !isWorldReady} className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:shadow-none">
                <ImagePlus size={16} />
              </button>
              <button onClick={() => handleSend(false)} disabled={state.isGenerating || !inputText.trim() || !isWorldReady} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600">
                <Send size={15} />
              </button>
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
          <div>
            {currentBlocks.map((block, idx) => (
              <TextBlockRenderer key={idx} block={block} isFirst={idx === 0} variant="chat" />
            ))}
          </div>
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
            <button onClick={() => onRegenerateText(message.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all">
              <RefreshCw size={12} /> Текст
            </button>
            {message.has_image && (
              <div className="group/regen inline-flex items-center overflow-hidden rounded-lg border border-transparent transition-colors duration-200 group-hover/regen:border-purple-700/40 group-hover/regen:bg-purple-950/30">
                <button onClick={() => onRegenerateImage(message.id, 'same')} className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs text-gray-400 transition-all duration-200 hover:text-white hover:bg-purple-800/40 hover:shadow-[0_0_12px_rgba(255,255,255,0.45),inset_0_0_8px_rgba(255,255,255,0.15)]" title="Ещё вариант (тот же промпт, новый seed) · ~15-30 сек">
                  <ImagePlus size={12} /> <span>Картинка</span>
                </button>
                <button onClick={() => onRegenerateImage(message.id, 'new')} className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-gray-400 max-w-0 px-0 py-1.5 opacity-0 transition-all duration-300 ease-out group-hover/regen:max-w-[120px] group-hover/regen:px-3 group-hover/regen:opacity-100 hover:text-white hover:bg-purple-800/40 hover:shadow-[0_0_12px_rgba(255,255,255,0.45),inset_0_0_8px_rgba(255,255,255,0.15)]" title="Новый промпт через LLM · ~30-60 сек">
                  <RefreshCw size={12} /> <span>Новый</span>
                </button>
              </div>
            )}
            <button onClick={() => setShowDebug(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-emerald-300 hover:bg-emerald-900/20 rounded-lg transition-all ml-1" title="Посмотреть логи генерации">
              <Terminal size={12} /> Логи
            </button>
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