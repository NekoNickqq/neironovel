import { useApp } from '../store';

export function ApiStatusBar() {
  const { state, dispatch } = useApp();
  const { apiError, services } = state;

  if (!apiError && !services) return null;

  return (
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
      {services && (
        <div className="text-xs text-gray-500 mt-1">
          Ollama: {services.ollama ? 'OK' : 'нет'} · ComfyUI: {services.comfyui ? 'OK' : 'нет'}
          {!services.comfyui && ' — картинки не сгенерируются, текст может работать'}
        </div>
      )}
    </div>
  );
}
