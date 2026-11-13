import { useState } from 'react';
import { Message } from '../types';
import { X, Terminal, BrainCircuit, Image as ImageIcon, Clock, ListTree, AlertTriangle } from 'lucide-react';

export function MessageDebugModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const [tab, setTab] = useState<'system' | 'history' | 'response' | 'image' | 'timings'>('system');
  const debug = message.debug_info;

  if (!debug) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl text-white" onClick={e => e.stopPropagation()}>
          <p>Для этого сообщения нет отладочной информации.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 rounded-lg">Закрыть</button>
        </div>
      </div>
    );
  }

  const TabButton = ({ id, icon, label }: { id: typeof tab, icon: any, label: string }) => (
    <button onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${tab === id ? 'border-purple-500 text-purple-300 bg-purple-500/10' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
      {icon} {label}
    </button>
  );

  const isError = debug.status === 'error' || debug.status === 'aborted_by_user';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl" style={{ height: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-950">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Terminal size={18} className="text-purple-400" /> Отладка генерации
            {isError && <span className="ml-2 text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">{debug.status === 'aborted_by_user' ? 'Отменено пользователем' : 'Ошибка'}</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex border-b border-gray-800 overflow-x-auto bg-gray-900/50">
          <TabButton id="system" icon={<Terminal size={14} />} label="System Prompt" />
          <TabButton id="history" icon={<ListTree size={14} />} label="History" />
          <TabButton id="response" icon={<BrainCircuit size={14} />} label="Raw & Thinking" />
          <TabButton id="image" icon={<ImageIcon size={14} />} label="Image Prompt" />
          <TabButton id="timings" icon={<Clock size={14} />} label="Timings & Meta" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-950/50">
          {debug.error_message && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex gap-3 text-red-300 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <div><strong>Ошибка:</strong> {debug.error_message}</div>
            </div>
          )}

          {tab === 'system' && <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">{debug.system_prompt || 'Нет данных'}</pre>}

          {tab === 'history' && (
            <div className="space-y-4">
              {debug.history_sent?.map((msg, i) => (
                <div key={i} className="border border-gray-800 rounded-lg p-3 bg-gray-900">
                  <span className={`text-xs font-bold uppercase ${msg.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>{msg.role}</span>
                  <p className="mt-1 font-mono text-sm text-gray-300 whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'response' && (
            <div className="space-y-4">
              {debug.thinking && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-400 mb-1">Thinking (Process)</h3>
                  <pre className="whitespace-pre-wrap font-mono text-sm text-amber-200/70 bg-amber-900/10 p-3 rounded-lg border border-amber-900/30">{debug.thinking}</pre>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-1">Raw Response (before JSON parse)</h3>
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 bg-gray-900 p-3 rounded-lg border border-gray-800">{debug.raw_response || 'Нет данных'}</pre>
              </div>
            </div>
          )}

          {tab === 'image' && (
            <div>
              <div className="mb-2">
                <span className="text-xs text-gray-500">Источник промпта: </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${debug.image_prompt_source === 'model' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'}`}>{debug.image_prompt_source?.toUpperCase() || 'N/A'}</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-emerald-300 bg-gray-900 p-3 rounded-lg border border-gray-800">{debug.image_prompt_used || 'Промпт не использовался'}</pre>
              {debug.comfyui_info?.seed && <p className="mt-2 text-xs text-gray-400">Seed: <span className="text-gray-200">{debug.comfyui_info.seed}</span></p>}
            </div>
          )}

          {tab === 'timings' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm mb-1">Ollama (Текст)</div>
                <div className="text-2xl font-bold text-purple-400">{(debug.timings_ms?.ollama || 0) / 1000}s</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm mb-1">ComfyUI (Картинка)</div>
                <div className="text-2xl font-bold text-pink-400">{(debug.timings_ms?.comfyui || 0) / 1000}s</div>
              </div>
              <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Модель</div>
                <div className="text-gray-200 font-mono">{debug.model}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}