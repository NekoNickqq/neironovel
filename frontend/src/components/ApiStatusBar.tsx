import { useState } from 'react';
import { useApp } from '../store';
import { OllamaSettingsModal } from './OllamaSettingsModal';

export function ApiStatusBar() {
  const { state, dispatch } = useApp();
  const { apiError, services } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {showSettings && <OllamaSettingsModal onClose={() => setShowSettings(false)} />}
      <div className="fixed top-3 left-3 z-50 w-[280px] max-w-[calc(100vw-24px)] text-sm">
        {/* Кнопка-индикатор, когда статус-бар скрыт */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Показать статус-бар"
            className="flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/90 px-3 py-1.5 text-xs text-gray-300 shadow-lg backdrop-blur hover:border-purple-500 hover:text-purple-200 transition"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                services?.ollama && services?.comfyui
                  ? 'bg-emerald-400'
                  : services?.ollama || services?.comfyui
                    ? 'bg-amber-400'
                    : 'bg-red-400'
              }`}
            />
            Статус ▾
          </button>
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900/90 p-3 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-gray-400 leading-relaxed">
                {services && (
                  <>
                    <span className="text-gray-300">
                      Модель ({state.ollamaMode === 'api' ? 'API-ключ' : 'локально'}):{' '}
                      {services.ollama ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-red-400">нет</span>
                      )}
                    </span>
                    <br />
                    <span className="text-gray-300">
                      ComfyUI:{' '}
                      {services.comfyui ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-red-400">нет</span>
                      )}
                    </span>
                    {!services.comfyui && (
                      <span className="block text-[11px] text-gray-500 mt-0.5">
                        картинки не сгенерируются, текст может работать
                      </span>
                    )}
                    {state.selectedOllamaModel && (
                      <span className="block text-[11px] text-gray-500 mt-0.5 truncate" title={state.selectedOllamaModel}>
                        Модель: {state.selectedOllamaModel}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Скрыть статус-бар"
                className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {apiError && (
              <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
                <span className="break-words">API: {apiError}</span>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white shrink-0"
                  onClick={() => dispatch({ type: 'SET_API_ERROR', payload: null })}
                >
                  ✕
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="mt-2 w-full rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:border-purple-500 hover:text-purple-200 transition"
            >
              ⚙ Настройки модели
            </button>
          </div>
        )}
      </div>
    </>
  );
}
