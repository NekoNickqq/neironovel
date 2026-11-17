import { Dialogue, DialogueSettings, Message, WorldCard, CharacterCard } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch { /* ignore */ }
    throw new ApiError(String(detail), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const DEFAULT_FONTS = {
  narrator: 'Cinzel, Georgia, serif',
  user: 'Inter, sans-serif',
  hero: 'Roboto, sans-serif',
  sidekick: 'Open Sans, sans-serif',
};

const DEFAULT_WORLD: WorldCard = {
  id: '', name: 'Безымянный мир', history: '', features: '', appearance: 'dark fantasy, cinematic lighting, masterpiece, best quality, 8k', negative_prompt: '', image_variants: [], selected_image_index: 0
};

type ApiDialogueFull = {
  id: string; 
  title: string; 
  settings: {
    world_data?: WorldCard;
    character_cards?: CharacterCard[];
    font_config?: any;
    ai_controls_user?: boolean;
    story_mode?: string; // <-- ДОБАВЛЕНО
  }; 
  messages: Message[]; 
  created_at: string;
};

type ApiDialogueSummary = {
  id: string; 
  title: string; 
  description: string; 
  message_count: number; 
  character_count: number; 
  created_at: string;
};

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/demo/')) return path;
  if (path.startsWith('/gallery/') || path.startsWith('/avatars/')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeMessage(m: Message): Message {
  const imageVariants = (m.image_variants ?? []).map(v => resolveMediaUrl(v) ?? v);
  return {
    ...m, blocks: m.blocks ?? [], image_path: resolveMediaUrl(m.image_path),
    image_variants: imageVariants, text_versions: m.text_versions ?? [], debug_info: m.debug_info ?? null,
  };
}

export function normalizeDialogue(data: ApiDialogueFull): Dialogue {
  const settings = data.settings ?? {};
  return {
    id: data.id, title: data.title, description: settings.world_data?.name ?? '',
    settings: {
      world_data: settings.world_data ?? DEFAULT_WORLD, 
      character_cards: (settings.character_cards ?? []).map(c => ({
        ...c, image_variants: (c.image_variants ?? []).map(v => resolveMediaUrl(v) ?? v)
      })),
      font_config: { ...DEFAULT_FONTS, ...(settings.font_config ?? {}) },
      ai_controls_user: settings.ai_controls_user ?? false,
      story_mode: (settings.story_mode as 'simple' | 'realistic' | 'game') ?? 'simple', // <-- ДОБАВЛЕНО
    },
    messages: (data.messages ?? []).map(normalizeMessage), created_at: data.created_at,
  };
}

export function summaryToDialogue(s: ApiDialogueSummary): Dialogue {
  return {
    id: s.id, title: s.title, description: s.description,
    settings: { world_data: { ...DEFAULT_WORLD, name: s.description }, character_cards: [], font_config: DEFAULT_FONTS, ai_controls_user: false, story_mode: 'simple' },
    messages: [], created_at: s.created_at, message_count: s.message_count,
  };
}

export type OllamaMode = 'local' | 'api';

export interface OllamaSettingsInfo {
  mode: OllamaMode; ollama_url: string; api_base_url: string; api_key_set: boolean; api_key_masked: string; model_local: string; model_api: string; active_model: string; active_url: string;
}

export interface OllamaModelsInfo {
  mode: OllamaMode; models: string[]; current: string;
}

export const api = {
  health: () => request<{ status: string; services: { ollama: boolean; comfyui: boolean } }>('/health'),
  getOllamaSettings: () => request<OllamaSettingsInfo>('/ollama/settings'),
  updateOllamaSettings: (body: Partial<{ mode: OllamaMode; ollama_url: string; api_base_url: string; api_key: string; model_local: string; model_api: string; }>) => request<{ status: string; mode: OllamaMode; active_model: string; active_url: string }>('/ollama/settings', { method: 'POST', body: JSON.stringify(body) }),
  listOllamaModels: () => request<OllamaModelsInfo>('/ollama/models'),

  // КАТАЛОГ
  listWorlds: async () => {
    const rows = await request<WorldCard[]>('/catalog/worlds');
    return rows.map(w => ({ ...w, image_variants: (w.image_variants ?? []).map(v => resolveMediaUrl(v) ?? v) }));
  },
  createWorld: (body: Omit<WorldCard, 'id'>) => request<{ id: string }>('/catalog/worlds', { method: 'POST', body: JSON.stringify(body) }),
  listCharacters: async () => {
    const rows = await request<CharacterCard[]>('/catalog/characters');
    return rows.map(c => ({ ...c, image_variants: (c.image_variants ?? []).map(v => resolveMediaUrl(v) ?? v) }));
  },
  createCharacter: (body: Omit<CharacterCard, 'id' | 'color'>) => request<{ id: string }>('/catalog/characters', { method: 'POST', body: JSON.stringify(body) }),
  generateNegative: (type: 'world' | 'character', data: any) => request<{ negative: string }>('/generate_negative', { method: 'POST', body: JSON.stringify({ type, data }) }),
  updateWorld: (id: string, body: Partial<WorldCard>) => request<{ status: string }>(`/catalog/worlds/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateCharacter: (id: string, body: Partial<CharacterCard>) => request<{ status: string }>(`/catalog/characters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  uploadImage: async (file: File, type: 'world' | 'character') => {
    const formData = new FormData();
    formData.append('file', file);
    // Передаем тип в query-параметре, чтобы бэкенд знал, в какую папку кидать файл
    const res = await fetch(`${API_BASE}/catalog/upload_image?card_type=${type}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Ошибка загрузки');
    const data = await res.json();
    return { image_path: resolveMediaUrl(data.image_path) };
  },

  generateCardImage: async (type: 'world' | 'character', prompt: string, negative_prompt: string) => {
    const res = await request<{ image_path: string }>('/catalog/generate_image', { method: 'POST', body: JSON.stringify({ type, prompt, negative_prompt }) });
    return { image_path: resolveMediaUrl(res.image_path) };
  },

  updateCardImages: (type: 'world' | 'character', id: string, image_variants: string[], selected_image_index: number) => 
    request<{ status: string }>(`/catalog/${type}/${id}/images`, { method: 'PATCH', body: JSON.stringify({ image_variants, selected_image_index }) }),

  deleteCard: (type: 'world' | 'character', id: string) => request<{ status: string }>(`/catalog/${type}/${id}`, { method: 'DELETE' }),

  // ДИАЛОГИ
  listDialogues: async (): Promise<Dialogue[]> => {
    const rows = await request<ApiDialogueSummary[]>('/dialogues');
    return rows.map(summaryToDialogue);
  },
  getDialogue: async (id: string): Promise<Dialogue> => {
    const data = await request<ApiDialogueFull>(`/dialogues/${id}`);
    return normalizeDialogue(data);
  },
  createDialogue: async (body: { title: string; description?: string; world_data: WorldCard; character_cards: CharacterCard[]; ai_controls_user: boolean; story_mode?: string; }) => {
    const { dialogue_id } = await request<{ dialogue_id: string }>('/dialogues', { method: 'POST', body: JSON.stringify(body) });
    return api.getDialogue(dialogue_id);
  },
  deleteDialogue: (id: string) => request<{ status: string }>(`/dialogues/${id}`, { method: 'DELETE' }),
  updateSettings: (dialogueId: string, body: { world_data?: WorldCard; character_cards?: CharacterCard[]; ai_controls_user?: boolean }) => request<{ status: string }>(`/dialogues/${dialogueId}/settings`, { method: 'PATCH', body: JSON.stringify(body) }),

  // СООБЩЕНИЯ
  sendMessage: (dialogueId: string, userText: string, generateImage: boolean, model?: string | null, signal?: AbortSignal) =>
    request<{ assistant_message_id: string; has_image: boolean; image_path: string | null }>('/message', {
      method: 'POST',
      body: JSON.stringify({ dialogue_id: dialogueId, user_text: userText, generate_image: generateImage, ...(model ? { model } : {}) }),
      signal,
    }),

  regenerateText: (dialogueId: string, messageId: string, model?: string | null) => request<{ message_id: string; new_blocks: Message['blocks']; version_count: number }>('/regenerate/text', { method: 'POST', body: JSON.stringify({ dialogue_id: dialogueId, message_id: messageId, ...(model ? { model } : {}) }) }),
  regenerateImage: (dialogueId: string, messageId: string, mode: 'same' | 'new' = 'same', model?: string | null) => request<{ message_id: string; new_image_path: string; variant_count: number; prompt_source: string }>('/regenerate/image', { method: 'POST', body: JSON.stringify({ dialogue_id: dialogueId, message_id: messageId, mode, ...(model ? { model } : {}) }) }),
  selectImage: (messageId: string, index: number) => request('/select/image', { method: 'POST', body: JSON.stringify({ message_id: messageId, index }) }),
  selectVersion: (messageId: string, index: number) => request('/select/version', { method: 'POST', body: JSON.stringify({ message_id: messageId, index }) }),
};