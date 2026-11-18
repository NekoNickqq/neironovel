export interface TextBlock { speaker: 'narrator' | 'hero' | 'sidekick' | 'user'; text: string; }

export interface WorldCard {
  id: string;
  name: string;
  history: string;
  features: string;
  appearance: string;
  negative_prompt: string;
  image_variants: string[];
  selected_image_index: number;
}

export interface CharacterCard {
  id: string;
  name: string;
  appearance: string;
  personality: string;
  features: string;
  negative_appearance: string;
  negative_personality: string;
  image_variants: string[];
  selected_image_index: number;
  color?: string;
}

export interface WorldState {
  character_backstory?: string;
  start_location?: {
    name: string;
    visual: string;
    atmosphere: string;
  };
  base_locations?: Array<{
    name: string;
    visual: string;
  }>;
  outfit_sets?: Array<{
    name: string;
    tags: string;
  }>;
}

/** Мир (чат), в котором используется карточка персонажа */
export interface CharacterWorldLink {
  id: string;
  title: string;
  description: string;
  message_count: number;
  avatar_count: number;
  created_at: string;
}

/** Аватарка карточки персонажа (сгенерированная или загруженная) */
export interface CharacterAvatarInfo {
  id: string;
  character_card_id: string;
  dialogue_id: string | null;
  dialogue_title?: string | null;
  character_name?: string | null;
  image_path: string;
  prompt: string;
  negative_prompt: string;
  source: 'generated' | 'upload' | string;
  created_at: string;
}

export interface DialogueSettings {
  world_data: WorldCard;
  character_cards: CharacterCard[];
  font_config: any;
  ai_controls_user: boolean;
  story_mode: 'simple' | 'realistic' | 'game';
  world_state?: WorldState;
  /** Индивидуальный аватар пользователя для этого мира (чата) */
  user_avatar_path?: string | null;
}

/** Аватарка, привязанная к миру (чату) */
export interface DialogueAvatar {
  id: string;
  character_card_id: string;
  image_path: string;
  source: string;
  created_at: string;
}

export interface DebugInfo { status?: string; error_message?: string; system_prompt?: string; history_sent?: any[]; model?: string; raw_response?: string; thinking?: string; timings_ms?: { ollama: number; comfyui: number }; image_prompt_used?: string; image_prompt_source?: string; negative_prompt_used?: string; scene_type_used?: string; comfyui_info?: any; }

export interface Message { id: string; dialogue_id: string; role: 'user' | 'assistant'; blocks: TextBlock[]; image_path: string | null; image_variants: string[]; selected_image_index: number; has_image: boolean; text_versions: TextBlock[][]; selected_version_index: number; parent_id: string | null; created_at: string; debug_info?: DebugInfo | null; }

export interface Dialogue { id: string; title: string; description: string; settings: DialogueSettings; messages: Message[]; created_at: string; message_count?: number; avatars?: DialogueAvatar[]; }

export type AppView = 'list' | 'create' | 'chat' | 'novel' | 'catalog';