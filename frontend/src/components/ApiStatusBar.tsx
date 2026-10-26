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
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-2 text-sm bg-gray-900/95 border-t border-gray-800 text-gray-200">
        {apiError && (
          <div className="flex items-start justify-between gap-4 text-red-300">
            <span>API: {apiError}</span>
            <button
              type="button"
              className="text-gray-400 hover:text-white shrink-0"
              onClick={() => dispatch({ type: 'SET_API_ERROR', payload: null })}
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            {services && (
              <>
                Ollama ({state.ollamaMode === 'api' ? 'API-ключ' : 'локально'}):{' '}
                {services.ollama ? 'OK' : 'нет'} · ComfyUI: {services.comfyui ? 'OK' : 'нет'}
                {!services.comfyui && ' — картинки не сгенерируются, текст может работать'}
              </>
            )}
            {state.selectedOllamaModel && (
              <span className="ml-2 text-gray-400">· Модель: {state.selectedOllamaModel}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:border-purple-500 hover:text-purple-200 transition"
          >
            ⚙ Ollama
          </button>
        </div>
      </div>
    </>
  );
}
