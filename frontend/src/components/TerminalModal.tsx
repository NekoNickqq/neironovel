import { useState, useEffect, useRef } from 'react';
import { X, Terminal } from 'lucide-react';

export function TerminalModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Подключаемся к SSE эндпоинту
    const evtSource = new EventSource('/api/logs/stream');
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(prev => [...prev, data]);
    };

    evtSource.onerror = () => {
      console.error("SSE connection error");
      evtSource.close();
    };

    return () => evtSource.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div 
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 text-gray-200 shadow-2xl" 
        style={{ height: '80vh' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-900">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Terminal size={18} className="text-emerald-400" /> Логи Ollama (Real-time)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 scrollbar-thin">
          {logs.length === 0 && <div className="text-gray-600">Ожидание запросов к Ollama...</div>}
          
          {logs.map((log, idx) => {
            if (log.type === 'ollama_request') {
              return (
                <div key={idx} className="text-blue-400 border-t border-gray-800 pt-2 mt-2">
                  <span className="text-gray-500">[{log.timestamp.split('T')[1].slice(0,8)}]</span> <strong>&gt;&gt; ЗАПРОС:</strong> {log.data.model}
                  <pre className="text-gray-400 mt-1 whitespace-pre-wrap">{JSON.stringify(log.data.messages[log.data.messages.length - 1].content, null, 2)}</pre>
                </div>
              );
            }
            if (log.type === 'ollama_content_chunk') {
              return <span key={idx} className="text-emerald-300">{log.data.text}</span>;
            }
            if (log.type === 'ollama_thinking_chunk') {
              return <span key={idx} className="text-amber-500/70 italic">{log.data.text}</span>;
            }
            if (log.type === 'ollama_response') {
              return (
                <div key={idx} className="text-emerald-500 border-b border-gray-800 pb-2 mb-2">
                  <strong>[{log.timestamp.split('T')[1].slice(0,8)}] &lt;&lt; ОТВЕТ ПОЛУЧЕН</strong>
                </div>
              );
            }
            if (log.type === 'ollama_error') {
              return <div key={idx} className="text-red-500 font-bold">[{log.timestamp.split('T')[1].slice(0,8)}] ОШИБКА: {log.data.message}</div>;
            }
            return null;
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}