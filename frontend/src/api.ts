import { Dialogue, DialogueSettings, Message, WorldCard, CharacterCard, WorldState, CharacterWorldLink, CharacterAvatarInfo, DialogueAvatar } from './types';

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

/** POST multipart/form-data: request() всегда ставит Content-Type: application/json, поэтому отдельный helper */
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: formData });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch { /* ignore */ }
    throw new ApiError(String(detail), res.status);
  }
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
    world_state?: WorldState;
    user_avatar_path?: string | null;
    selected_avatar_ids?: Record<string, string>;
  }; 
  avatars?: DialogueAvatar[];
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
      world_state: settings.world_state,
      user_avatar_path: resolveMediaUrl(settings.user_avatar_path) ?? settings.user_avatar_path ?? null,
      selected_avatar_ids: settings.selected_avatar_ids ?? {},
    },
    avatars: (data.avatars ?? []).map(a => ({ ...a, image_path: resolveMediaUrl(a.image_path) ?? a.image_path })),
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

  // СВЯЗИ КАРТОЧКИ ПЕРСОНАЖА: МИРЫ И АВАТАРКИ
  getCharacterWorlds: (cardId: string) => request<CharacterWorldLink[]>(`/catalog/characters/${cardId}/worlds`),
  getCharacterAvatars: async (cardId: string): Promise<CharacterAvatarInfo[]> => {
    const rows = await request<CharacterAvatarInfo[]>(`/catalog/characters/${cardId}/avatars`);
    return rows.map(a => ({ ...a, image_path: resolveMediaUrl(a.image_path) ?? a.image_path }));
  },
  getDialogueAvatars: async (dialogueId: string): Promise<CharacterAvatarInfo[]> => {
    const rows = await request<CharacterAvatarInfo[]>(`/dialogues/${dialogueId}/avatars`);
    return rows.map(a => ({ ...a, image_path: resolveMediaUrl(a.image_path) ?? a.image_path }));
  },
  uploadDialogueAvatar: async (dialogueId: string, file: File, characterCardId?: string): Promise<CharacterAvatarInfo> => {
    const formData = new FormData();
    formData.append('file', file);
    if (characterCardId) formData.append('character_card_id', characterCardId);
    const avatar = await requestForm<CharacterAvatarInfo>(`/dialogues/${dialogueId}/avatar`, formData);
    return { ...avatar, image_path: resolveMediaUrl(avatar.image_path) ?? avatar.image_path };
  },

  generateDialogueAvatar: async (dialogueId: string, characterCardId: string, prompt?: string, negativePrompt?: string): Promise<CharacterAvatarInfo> => {
    const avatar = await request<CharacterAvatarInfo>(`/dialogues/${dialogueId}/avatars/generate`, { method: 'POST', body: JSON.stringify({ character_card_id: characterCardId, prompt, negative_prompt: negativePrompt }) });
    return { ...avatar, image_path: resolveMediaUrl(avatar.image_path) ?? avatar.image_path };
  },
  selectDialogueAvatar: (dialogueId: string, characterCardId: string, avatarId: string) =>
    request<{ status: string }>(`/dialogues/${dialogueId}/characters/${characterCardId}/selected-avatar`, { method: 'PUT', body: JSON.stringify({ avatar_id: avatarId }) }),

  uploadUserAvatar: async (dialogueId: string, file: File): Promise<{ dialogue_id: string; image_path: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const data = await requestForm<{ dialogue_id: string; image_path: string }>(`/dialogues/${dialogueId}/user-avatar`, formData);
    return { ...data, image_path: resolveMediaUrl(data.image_path) ?? data.image_path };
  },

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
  updateSettings: (dialogueId: string, body: { world_data?: WorldCard; character_cards?: CharacterCard[]; ai_controls_user?: boolean; selected_avatar_ids?: Record<string, string> }) => request<{ status: string }>(`/dialogues/${dialogueId}/settings`, { method: 'PATCH', body: JSON.stringify(body) }),

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