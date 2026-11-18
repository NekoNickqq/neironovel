import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { ArrowLeft, ImagePlus, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Server, Send, Terminal, Square, Settings, Loader2, User, Book } from 'lucide-react';
import { Message, TextBlock } from '../types';
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
    regenerateText, regenerateImage, selectImage, selectTextVersion, uploadUserAvatar,
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

  // Аватар пользователя: клик по круглой аватарке открывает стандартный выбор файла
  const userAvatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingUserAvatar, setIsUploadingUserAvatar] = useState(false);

  const handleUserAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingUserAvatar(true);
    try { await uploadUserAvatar(file); } finally { setIsUploadingUserAvatar(false); }
  };

  // Круглые аватарки блоков: пользователь, нарратор (обложка мира) и персонажи этого мира
  const dialogueAvatars = currentDialogue?.avatars ?? [];
  const characterCards = currentDialogue?.settings.character_cards ?? [];
  const worldData = currentDialogue?.settings.world_data;
  const narratorAvatar = worldData?.image_variants?.[worldData.selected_image_index]
    ?? worldData?.image_variants?.[0]
    ?? null;
  const avatarForCard = (cardId?: string | null) => {
    if (!cardId) return null;
    const selectedAvatarId = currentDialogue?.settings.selected_avatar_ids?.[cardId];
    return dialogueAvatars.find(avatar => avatar.id === selectedAvatarId)?.image_path
      ?? dialogueAvatars.find(avatar => avatar.character_card_id === cardId)?.image_path
      ?? null;
  };
  const userAvatarPath = currentDialogue?.settings.user_avatar_path ?? null;
  const messageAvatars = {
    user: userAvatarPath,
    narrator: narratorAvatar,
    bySpeaker: {
      user: userAvatarPath,
      hero: avatarForCard(characterCards[0]?.id),
      sidekick: avatarForCard((characterCards[1] ?? characterCards[0])?.id),
    } as Record<string, string | null>,
    nameBySpeaker: {
      hero: characterCards[0]?.name ?? 'Персонаж',
      sidekick: (characterCards[1] ?? characterCards[0])?.name ?? 'Персонаж',
    } as Record<string, string>,
  };

  // Проверяем, есть ли стартовая локация (признак, что мир сгенерирован)
  const isWorldReady = !!currentDialogue?.settings?.world_state?.start_location;

  // Состояние этапов генерации мира (для цветной визуализации)
  const [worldStages, setWorldStages] = useState<{ step1: boolean; step2: boolean; step3: boolean }>({ step1: false, step2: false, step3: false });
  // Анимация завершения генерации
  const [showCompletion, setShowCompletion] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Рефы для надёжного опроса без замыканий и самоподдерживающегося цикла
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const pollAttemptsRef = useRef(0);
  const currentDialogueRef = useRef(currentDialogue);
  const MAX_POLL_ATTEMPTS = 30; // ~90 секунд при интервале 3с

  // Галочка готовности мира показывается СТРОГО один раз — только сразу после первичного создания мира.
  // Флаг фиксируем на монтировании, чтобы последующие перезагрузки диалога (сообщения, перегенерации)
  // и повторный вход в существующий чат её не запускали.
  const justCreatedOnMountRef = useRef(state.freshDialogueId === id);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизируем ref с актуальным currentDialogue при каждом рендере
  currentDialogueRef.current = currentDialogue;

  // Опрос готовности мира: тянет диалог пока world_state.start_location не появится.
  // currentDialogue bewusst НЕ в зависимостях, иначе любой апдейт стора перезапускал бы эффект и спамил запросами.
  useEffect(() => {
    isMountedRef.current = true;
    pollAttemptsRef.current = 0;

    const poll = async () => {
      if (!isMountedRef.current || !id) return;

      // Читаем актуальный currentDialogue из ref (без зависимости в useEffect)
      const ready = !!currentDialogueRef.current?.settings?.world_state?.start_location;
      if (ready) {
        pollTimerRef.current = null;
        return;
      }

      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        console.error("Мировая генерация не завершилась за отведённое время");
        pollTimerRef.current = null;
        return;
      }

      try {
        await openDialogue(id);
      } catch (e) {
        console.error("Ошибка опроса диалога", e);
      }

      // Если при размонтировании или смене id во время запроса — не продолжаем
      if (!isMountedRef.current || !id) return;

      const readyAgain = !!currentDialogueRef.current?.settings?.world_state?.start_location;
      if (!readyAgain && isMountedRef.current) {
        pollTimerRef.current = setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [id, openDialogue]);

  useEffect(() => {
    const worldState = currentDialogue?.settings?.world_state;
    if (!worldState) return;
    const completed = [
      !!worldState.character_backstory && !!worldState.start_location?.name,
      Array.isArray(worldState.base_locations) && worldState.base_locations.length > 0,
      Array.isArray(worldState.outfit_sets) && worldState.outfit_sets.length > 0,
    ];
    const timers = completed.map((done, index) => done
      ? setTimeout(() => setWorldStages(previous => ({ ...previous, [`step${index + 1}`]: true })), index * 220)
      : null);
    return () => timers.forEach(timer => { if (timer) clearTimeout(timer); });
  }, [currentDialogue?.settings?.world_state]);

  // Финальная галочка показывается только для только что созданного диалога.
  useEffect(() => {
    if (!isWorldReady || !currentDialogue?.settings?.world_state) return;
    // Диалог открыт повторно (или это обычная генерация) — галочку не показываем
    if (!justCreatedOnMountRef.current) return;

    justCreatedOnMountRef.current = false;
    dispatch({ type: 'SET_FRESH_DIALOGUE', payload: null });

    const ws = currentDialogue.settings.world_state;
    setWorldStages({
      step1: !!ws.character_backstory,
      step2: Array.isArray(ws.base_locations) && ws.base_locations.length > 0,
      step3: Array.isArray(ws.outfit_sets) && ws.outfit_sets.length > 0,
    });

    setShowCompletion(true);
    setShowCheckmark(true);

    completionTimerRef.current = setTimeout(() => {
      setShowCheckmark(false);
      completionHideTimerRef.current = setTimeout(() => setShowCompletion(false), 500);
    }, 1500);
  }, [isWorldReady, currentDialogue, dispatch]);

  // Если пользователь ушёл из чата раньше, чем мир стал готов, маркер сбрасываем:
  // повторный вход в уже существующий чат галочку не показывает
  useEffect(() => () => {
    if (justCreatedOnMountRef.current) {
      justCreatedOnMountRef.current = false;
      dispatch({ type: 'SET_FRESH_DIALOGUE', payload: null });
    }
  }, [dispatch]);

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
            <Book size={14}/> Настройки мира
          </button>
          
          <button onClick={() => { setShowOllamaSettings(true); setShowSettingsMenu(false); }} className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg text-left transition-colors">
            <Server size={14} /> Настройки API
          </button>
        </div>
      )}

      {showOllamaSettings && <OllamaSettingsModal onClose={() => setShowOllamaSettings(false)} />}
      {showEditSettings && <EditSettingsModal onClose={() => setShowEditSettings(false)} />}

      {/* ОБЛАСТЬ СООБЩЕНИЙ */}
      <div className="flex-1 overflow-y-auto pt-24 pb-[calc(15rem+env(safe-area-inset-bottom))] px-4 sm:px-6 lg:px-10 scrollbar-thin" onScroll={handleScroll}>
        <div className="max-w-6xl mx-auto">
          
          {/* Экран загрузки мира */}
          {!isWorldReady && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
              <Loader2 size={48} className="animate-spin text-purple-500 mb-6" />
              <h2 className="text-2xl font-bold text-white mb-2">Генерация мира...</h2>
              <p className="text-gray-400 max-w-md">Нейросеть создает предысторию, базовые локации и сеты одежды. Пожалуйста, подождите.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
                <span className={`px-3 py-1 rounded-full border ${worldStages.step1 ? 'bg-green-900/50 text-green-400 border-green-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>Шаг 1: Предыстория</span>
                <span className={`px-3 py-1 rounded-full border ${worldStages.step2 ? 'bg-green-900/50 text-green-400 border-green-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>Шаг 2: Локации</span>
                <span className={`px-3 py-1 rounded-full border ${worldStages.step3 ? 'bg-green-900/50 text-green-400 border-green-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>Шаг 3: Одежда</span>
              </div>
            </div>
          )}

          {/* Индикатор завершения генерации мира — обычный слой страницы, без перекрывающего оверлея */}
          {showCompletion && (
            <div
              className={`mb-6 flex justify-center transition-all duration-500 ${
                showCheckmark ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              }`}
            >
              <div className="flex items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 shadow-lg shadow-green-900/20">
                <svg className="h-9 w-9 text-green-500" viewBox="0 0 52 52" role="img" aria-label="Мир готов">
                  <circle cx="26" cy="26" r="26" fill="currentColor" className="text-green-600/20" />
                  <path
                    className="animate-checkmark"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 27 L21 34 L36 18"
                    strokeDasharray="40"
                    strokeDashoffset="40"
                  />
                </svg>
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
          
          {/* Скрытый input: выбор файла аватара пользователя */}
          <input
            ref={userAvatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleUserAvatarChange}
            className="hidden"
          />

          {/* Сообщения */}
          {isWorldReady && currentDialogue.messages.map((msg, idx) => (
            <ChatMessageItem 
              key={msg.id} 
              message={msg} 
              isLast={idx === currentDialogue.messages.length - 1} 
              avatars={messageAvatars}
              isUploadingUserAvatar={isUploadingUserAvatar}
              onUserAvatarClick={() => userAvatarInputRef.current?.click()}
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

type MessageAvatars = {
  user: string | null;
  narrator: string | null;
  bySpeaker: Record<string, string | null>;
  nameBySpeaker: Record<string, string>;
};

function ChatMessageItem({ message, isLast, avatars, isUploadingUserAvatar, onUserAvatarClick, onRegenerateText, onRegenerateImage, onSelectImage, onSelectVersion }: { message: Message; isLast: boolean; avatars: MessageAvatars; isUploadingUserAvatar?: boolean; onUserAvatarClick?: () => void; onRegenerateText: (id: string) => void; onRegenerateImage: (id: string, mode: 'same' | 'new') => void; onSelectImage: (messageId: string, index: number) => void; onSelectVersion: (messageId: string, index: number) => void; }) {
  const isUser = message.role === 'user';
  const [showDebug, setShowDebug] = useState(false);
  const currentBlocks = message.text_versions.length > 0 && message.selected_version_index > 0 ? message.text_versions[message.selected_version_index - 1] : message.blocks;
  const imageVariants = message.image_variants ?? [];
  // Защита от «сбитого» selected_image_index (старые записи в БД): показываем последний доступный вариант
  const currentImage = imageVariants[message.selected_image_index]
    ?? imageVariants[imageVariants.length - 1]
    ?? message.image_path
    ?? null;

  // Ответ ИИ разбиваем на три независимых блока: нарратор → персонаж → изображение
  const hasText = (b: TextBlock) => typeof b.text === 'string' && b.text.trim().length > 0;
  const narratorBlocks = currentBlocks.filter(b => b.speaker === 'narrator' && hasText(b));
  const characterBlocks = currentBlocks.filter(b => b.speaker !== 'narrator' && hasText(b));

  const assistantCardClass = 'rounded-2xl p-5 bg-surface/60 border border-gray-800/50 backdrop-blur-sm';
  const characterEntries = characterBlocks.map((block, index) => ({ block, index }));

  return (
    <div className={`message-enter flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex w-full max-w-[92%] min-w-0 items-start gap-3">
        {isUser ? (
          <>
            <div className="min-w-0 flex flex-col items-end gap-3">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/30">
                <div>
                  {currentBlocks.map((block, idx) => (
                    <TextBlockRenderer key={idx} block={block} isFirst={idx === 0} variant="chat" speakerLabel={null} />
                  ))}
                </div>
              </div>
            </div>
            {/* Аватар пользователя — СПРАВА от блока сообщения */}
            <ChatAvatar
              src={avatars.user}
              alt="Аватар пользователя"
              fallback={<User size={18} className="text-gray-400" />}
              onClick={onUserAvatarClick}
              title={isUploadingUserAvatar ? 'Загрузка аватара…' : 'Сменить аватар'}
              loading={isUploadingUserAvatar}
            />
          </>
        ) : (
          <div className="min-w-0 flex flex-col gap-3">
            {/* Блок 1. Текст нарратора/диктора — аватарка СЛЕВА */}
            {narratorBlocks.length > 0 && (
              <div className="flex items-start gap-3">
                <ChatAvatar
                  src={avatars.narrator}
                  alt="Нарратор"
                  fallback={<BookOpen size={18} className="text-purple-300" />}
                  title="Нарратор"
                />
                <div className={`${assistantCardClass} min-w-0 flex-1`}>
                  {narratorBlocks.map((block, idx) => (
                    <TextBlockRenderer key={idx} block={block} isFirst={idx === 0} variant="chat" />
                  ))}
                </div>
              </div>
            )}

            {/* Блок 2. Текст/реплика персонажа — аватарка СЛЕВА */}
            {characterEntries.length > 0 && (
              <div className="flex flex-col gap-3">
                {characterEntries.map(({ block, index }) => {
                  const name = avatars.nameBySpeaker[block.speaker] ?? 'Персонаж';
                  return <div key={`${block.speaker}-${index}`} className="flex items-start gap-3">
                    <ChatAvatar src={avatars.bySpeaker[block.speaker]} alt={name} fallback={<User size={18} className="text-gray-400" />} title={name} />
                    <div className={`${assistantCardClass} min-w-0 flex-1`}>
                      <TextBlockRenderer block={block} isFirst variant="chat" speakerLabel={name} />
                    </div>
                  </div>;
                })}
              </div>
            )}

            {/* Блок 3. Сгенерированное изображение */}
            {currentImage && (
              <div className={`${assistantCardClass} p-3`}>
                <SceneImage src={currentImage} alt="Scene" className="rounded-xl w-full max-h-96 object-cover border border-gray-700/50" />
                {imageVariants.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                    {imageVariants.map((img, idx) => (
                      <button key={idx} onClick={() => onSelectImage(message.id, idx)} className={`flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border-2 transition-all ${idx === message.selected_image_index ? 'border-purple-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        <SceneImage src={img} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isUser && (
              <div className="flex items-center gap-2 mt-2 ml-[52px]">
                <button onClick={() => onRegenerateText(message.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all">
                  <RefreshCw size={12} /> Текст
                </button>
                {(message.has_image || !!currentImage) && (
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
        )}
      </div>
      {showDebug && <MessageDebugModal message={message} onClose={() => setShowDebug(false)} />}
    </div>
  );
}

/** Круглая аватарка блока чата (пользователь / нарратор / персонаж) */
function ChatAvatar({ src, alt, fallback, onClick, title, loading }: {
  src?: string | null;
  alt: string;
  fallback: ReactNode;
  onClick?: () => void;
  title?: string;
  loading?: boolean;
}) {
  const baseClass = 'mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700/70 bg-gray-900/80';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title ?? alt}
        className={`${baseClass} transition-all hover:border-purple-500/70 hover:bg-purple-900/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.35)]`}
      >
        {loading
          ? <Loader2 size={16} className="animate-spin text-purple-300" />
          : src
            ? <SceneImage src={src} alt={alt} className="h-full w-full object-cover" />
            : fallback}
      </button>
    );
  }

  return (
    <div title={title} className={baseClass}>
      {src
        ? <SceneImage src={src} alt={alt} className="h-full w-full object-cover" />
        : fallback}
    </div>
  );
}
