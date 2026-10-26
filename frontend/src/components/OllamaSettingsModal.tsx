import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { api, OllamaMode, OllamaSettingsInfo } from '../api';
import { X, RefreshCw, Server, KeyRound, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function OllamaSettingsModal({ onClose }: Props) {
  const { refreshOllamaModels } = useApp();
  const [settings, setSettings] = useState<OllamaSettingsInfo | null>(null);
  const [mode, setMode] = useState<OllamaMode>('local');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.getOllamaSettings();
      setSettings(s);
      setMode(s.mode);
      setOllamaUrl(s.ollama_url);
      setApiBaseUrl(s.api_base_url);
      setSelectedModel(s.mode === 'api' ? s.model_api : s.model_local);
      const m = await api.listOllamaModels();
      setModels(m.models);
      if (m.current && !m.models.includes(m.current)) {
        setSelectedModel(m.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadModels = async () => {
    setError(null);
    try {
      // Сохраняем текущий режим/URL/ключ, чтобы список моделей соответствовал активному подключению
      const body: Partial<Parameters<typeof api.updateOllamaSettings>[0]> = { mode };
      if (mode === 'local') body.ollama_url = ollamaUrl;
      else {
        body.api_base_url = apiBaseUrl;
        if (apiKey.trim()) body.api_key = apiKey.trim();
      }
      await api.updateOllamaSettings(body);
      const m = await api.listOllamaModels();
      setModels(m.models);
      if (m.current) setSelectedModel(m.current);
      void refreshOllamaModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось получить список моделей');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const model = (customModel.trim() || selectedModel).trim();
      const body: Parameters<typeof api.updateOllamaSettings>[0] = { mode };
      if (mode === 'local') {
        body.ollama_url = ollamaUrl.trim();
        body.model_local = model;
      } else {
        body.api_base_url = apiBaseUrl.trim();
        body.model_api = model;
        if (apiKey.trim()) body.api_key = apiKey.trim();
      }
      await api.updateOllamaSettings(body);
      await refreshOllamaModels();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 text-gray-100 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server size={18} className="text-purple-400" />
            Выбор модели (Ollama)
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {loading && <p className="text-sm text-gray-400">Загрузка настроек…</p>}

        {!loading && (
          <>
            {/* Переключатель режима */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('local')}
                className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 transition ${
                  mode === 'local'
                    ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <Server size={15} /> Локальные модели
              </button>
              <button
                type="button"
                onClick={() => setMode('api')}
                className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 transition ${
                  mode === 'api'
                    ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <KeyRound size={15} /> API-ключ
              </button>
            </div>

            {mode === 'local' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL локального Ollama</label>
                  <input
                    value={ollamaUrl}
                    onChange={e => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-400">
                      Модель (список локальных моделей)
                    </label>
                    <button
                      type="button"
                      onClick={() => void reloadModels()}
                      className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Обновить
                    </button>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  >
                    {models.length === 0 && <option value="">— нет доступных моделей —</option>}
                    {models.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Базовый URL API</label>
                  <input
                    value={apiBaseUrl}
                    onChange={e => setApiBaseUrl(e.target.value)}
                    placeholder="https://ollama.com"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    API-ключ{' '}
                    {settings?.api_key_set && (
                      <span className="text-gray-500">(сохранён: {settings.api_key_masked})</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={settings?.api_key_set ? '•••••••• (оставьте пустым, чтобы не менять)' : 'ollama_…'}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-400">Модель (доступна по ключу)</label>
                    <button
                      type="button"
                      onClick={() => void reloadModels()}
                      className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Обновить
                    </button>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  >
                    {models.length === 0 && <option value="">— сохраните ключ и нажмите «Обновить» —</option>}
                    {models.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Ручной ввод модели */}
            <div className="mt-4">
              <label className="block text-xs text-gray-400 mb-1">
                Своя модель (необязательно, имеет приоритет над списком)
              </label>
              <input
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder={selectedModel || 'например llama3.1:8b'}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                Активная модель:{' '}
                <span className="text-gray-300">{settings?.active_model ?? '—'}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void handleSave()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {saved ? <Check size={15} /> : null}
                  {saving ? 'Сохранение…' : saved ? 'Сохранено' : 'Сохранить'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
