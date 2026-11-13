import { useState } from 'react';
import { useApp } from '../store';
import { OllamaSettingsModal } from './OllamaSettingsModal';
import { Settings, X } from 'lucide-react';

export function ApiStatusBar() {
  const { state, dispatch } = useApp();
  const { apiError, services } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ollamaOk = services?.ollama ?? false;
  const comfyuiOk = services?.comfyui ?? false;
  const anyDown = services !== null && (!ollamaOk || !comfyuiOk);
  const hasProblem = !!apiError || anyDown;

  return (
    <>
      {showSettings && <OllamaSettingsModal onClose={() => setShowSettings(false)} />}

      <div className="fixed top-1 left-1 z-50">
        {!expanded ? (
          // Свёрнутая пилюля: две точки, ничего лишнего
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] leading-none backdrop-blur-sm transition-colors hover:bg-gray-900/70"
            title={
              services
                ? `Ollama: ${ollamaOk ? 'OK' : 'нет'} · ComfyUI: ${comfyuiOk ? 'OK' : 'нет'}`
                : 'Проверка сервисов…'
            }
            aria-label="Статус сервисов"
          >
            <span className={ollamaOk ? 'text-emerald-400' : 'text-red-400'}>●</span>
            <span className={comfyuiOk ? 'text-emerald-400' : 'text-red-400'}>●</span>
            {hasProblem && <span className="text-red-400 font-bold">!</span>}
          </button>
        ) : (
          // Развёрнутая панель
          <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/90 px-2.5 py-1.5 text-xs text-gray-400 shadow-lg backdrop-blur">
            <span title={ollamaOk ? 'Ollama OK' : 'Ollama недоступен'}>
              <span className={ollamaOk ? 'text-emerald-400' : 'text-red-400'}>●</span>{' '}
              Ollama
            </span>
            <span className="text-gray-700">·</span>
            <span title={comfyuiOk ? 'ComfyUI OK' : 'ComfyUI недоступен'}>
              <span className={comfyuiOk ? 'text-emerald-400' : 'text-red-400'}>●</span>{' '}
              ComfyUI
            </span>

            {state.selectedOllamaModel && (
              <>
                <span className="text-gray-700">·</span>
                <span
                  className="hidden max-w-[140px] truncate text-gray-500 sm:inline"
                  title={state.selectedOllamaModel}
                >
                  {state.selectedOllamaModel}
                </span>
              </>
            )}

            {apiError && (
              <>
                <span className="text-gray-700">·</span>
                <span className="max-w-[240px] truncate text-red-300" title={apiError}>
                  {apiError}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-gray-400 hover:text-white"
                  onClick={() => dispatch({ type: 'SET_API_ERROR', payload: null })}
                  title="Скрыть ошибку"
                >
                  <X size={12} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="shrink-0 rounded border border-gray-700 p-1 text-gray-300 transition hover:border-purple-500 hover:text-purple-200"
              title="Настройки Ollama"
            >
              <Settings size={12} />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="shrink-0 text-gray-400 hover:text-white"
              title="Свернуть"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}