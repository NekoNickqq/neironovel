export interface TextBlock {
  speaker: 'narrator' | 'hero' | 'sidekick' | 'user';
  text: string;
}

export interface CharacterCard {
  id: string; name: string; description: string; avatar_path: string | null; color: string;
}

export interface DialogueSettings {
  world_lore: string; character_cards: CharacterCard[]; style_preset: string;
  font_config: { narrator: string; user: string; hero: string; sidekick: string; };
  ai_controls_user: boolean;
}

export interface DebugInfo {
  status?: 'generating' | 'success' | 'error' | 'aborted_by_user';
  error_message?: string;
  system_prompt?: string;
  history_sent?: any[];
  model?: string;
  raw_response?: string;
  thinking?: string;
  timings_ms?: { ollama: number; comfyui: number };
  image_prompt_used?: string;
  image_prompt_source?: string;
  comfyui_info?: { prompt_id?: string; seed?: number };
}

export interface Message {
  id: string; dialogue_id: string; role: 'user' | 'assistant'; blocks: TextBlock[];
  image_path: string | null; image_variants: string[]; selected_image_index: number; has_image: boolean;
  text_versions: TextBlock[][]; selected_version_index: number; parent_id: string | null; created_at: string;
  debug_info?: DebugInfo | null;
}

export interface Dialogue {
  id: string; title: string; description: string; settings: DialogueSettings; messages: Message[];
  created_at: string; message_count?: number;
}

export type AppView = 'list' | 'create' | 'chat' | 'novel';