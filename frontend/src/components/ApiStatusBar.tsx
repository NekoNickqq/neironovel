import { useState } from 'react';
import { useApp } from '../store';
import { OllamaSettingsModal } from './OllamaSettingsModal';

export function ApiStatusBar() {
  const { state, dispatch } = useApp();
  const { apiError, services } = state;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      {showSettings && <OllamaSettingsModal onClose={() => setShowSettings(false)} />}
      <div className="pointer-events-none fixed top-0 left-0 z-50 max-w-[min(60vw,520px)] p-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/80 px-2.5 py-1.5 text-xs text-gray-400 shadow-lg backdrop-blur">
          {services && (
            <span className="truncate" title={`Ollama (${state.ollamaMode === 'api' ? 'API-ключ' : 'локально'})${!services.comfyui ? ' — без ComfyUI картинки не генерируются' : ''}`}>
              <span className={services.ollama ? 'text-emerald-400' : 'text-red-400'}>●</span>{' '}
              Ollama: {services.ollama ? 'OK' : 'нет'}
              {' · '}
              <span className={services.comfyui ? 'text-emerald-400' : 'text-red-400'}>●</span>{' '}
              ComfyUI: {services.comfyui ? 'OK' : 'нет'}
            </span>
          )}
          {state.selectedOllamaModel && (
            <span className="hidden truncate text-gray-500 sm:inline" title={state.selectedOllamaModel}>
              {state.selectedOllamaModel}
            </span>
          )}
          {apiError && (
            <span className="truncate text-red-300" title={apiError}>
              API: {apiError}
            </span>
          )}
          {apiError && (
            <button
              type="button"
              className="shrink-0 text-gray-400 hover:text-white"
              onClick={() => dispatch({ type: 'SET_API_ERROR', payload: null })}
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-md border border-gray-700 px-2 py-0.5 text-gray-300 hover:border-purple-500 hover:text-purple-200 transition"
          >
            ⚙
          </button>
        </div>
      </div>
    </>
  );
}
