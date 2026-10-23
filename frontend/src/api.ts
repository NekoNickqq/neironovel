import { Dialogue, DialogueSettings, Message } from './types';

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
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(String(detail), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const DEFAULT_FONTS: DialogueSettings['font_config'] = {
  narrator: 'Cinzel, Georgia, serif',
  user: 'Inter, sans-serif',
  hero: 'Roboto, sans-serif',
  sidekick: 'Open Sans, sans-serif',
};

type ApiDialogueFull = {
  id: string;
  title: string;
  settings: Partial<DialogueSettings> & { world_lore?: string };
  messages: Message[];
  created_at: string;
};

type ApiDialogueSummary = {
  id: string;
  title: string;
  description: string;
  message_count: number;
  character_count: number;
  style_preset: string;
  created_at: string;
};

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/demo/')) {
    return path;
  }
  if (path.startsWith('/gallery/') || path.startsWith('/avatars/')) {
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeMessage(m: Message): Message {
  const imageVariants = (m.image_variants ?? []).map(v => resolveMediaUrl(v) ?? v);
  return {
    ...m,
    blocks: m.blocks ?? [],
    image_path: resolveMediaUrl(m.image_path),
    image_variants: imageVariants,
    text_versions: m.text_versions ?? [],
  };
}

export function normalizeDialogue(data: ApiDialogueFull): Dialogue {
  const settings = data.settings ?? {};
  return {
    id: data.id,
    title: data.title,
    description: settings.world_lore?.slice(0, 100) ?? '',
    settings: {
      world_lore: settings.world_lore ?? '',
      character_cards: settings.character_cards ?? [],
      style_preset: settings.style_preset ?? '',
      font_config: { ...DEFAULT_FONTS, ...(settings.font_config ?? {}) },
      ai_controls_user: settings.ai_controls_user ?? false,
    },
    messages: (data.messages ?? []).map(normalizeMessage),
    created_at: data.created_at,
  };
}

export function summaryToDialogue(s: ApiDialogueSummary): Dialogue {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    settings: {
      world_lore: s.description,
      character_cards: [],
      style_preset: s.style_preset,
      font_config: DEFAULT_FONTS,
      ai_controls_user: false,
    },
    messages: [],
    created_at: s.created_at,
    message_count: s.message_count,
  };
}

export const api = {
  health: () => request<{ status: string; services: { ollama: boolean; comfyui: boolean } }>('/health'),

  listDialogues: async (): Promise<Dialogue[]> => {
    const rows = await request<ApiDialogueSummary[]>('/dialogues');
    return rows.map(summaryToDialogue);
  },

  getDialogue: async (id: string): Promise<Dialogue> => {
    const data = await request<ApiDialogueFull>(`/dialogues/${id}`);
    return normalizeDialogue(data);
  },

  createDialogue: async (body: {
    title: string;
    description?: string;
    world_lore: string;
    character_cards: DialogueSettings['character_cards'];
    style_preset: string;
    ai_controls_user: boolean;
  }) => {
    const { dialogue_id } = await request<{ dialogue_id: string }>('/dialogues', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return api.getDialogue(dialogue_id);
  },

  deleteDialogue: (id: string) =>
    request<{ status: string }>(`/dialogues/${id}`, { method: 'DELETE' }),

  sendMessage: (dialogueId: string, userText: string, generateImage: boolean) =>
    request<{ assistant_message_id: string; has_image: boolean; image_path: string | null }>(
      '/message',
      {
        method: 'POST',
        body: JSON.stringify({
          dialogue_id: dialogueId,
          user_text: userText,
          generate_image: generateImage,
        }),
      },
    ),

  regenerateText: (dialogueId: string, messageId: string) =>
    request<{ message_id: string; new_blocks: Message['blocks']; version_count: number }>(
      '/regenerate/text',
      {
        method: 'POST',
        body: JSON.stringify({ dialogue_id: dialogueId, message_id: messageId }),
      },
    ),

  regenerateImage: (dialogueId: string, messageId: string) =>
    request<{ message_id: string; new_image_path: string; variant_count: number }>(
      '/regenerate/image',
      {
        method: 'POST',
        body: JSON.stringify({ dialogue_id: dialogueId, message_id: messageId }),
      },
    ),

  selectImage: (messageId: string, index: number) =>
    request('/select/image', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, index }),
    }),

  selectVersion: (messageId: string, index: number) =>
    request('/select/version', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, index }),
    }),
};
