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
  color?: string; // для UI
}

export interface DialogueSettings {
  world_data: WorldCard;
  character_cards: CharacterCard[];
  font_config: any;
  ai_controls_user: boolean;
}

export interface DebugInfo { status?: string; error_message?: string; system_prompt?: string; history_sent?: any[]; model?: string; raw_response?: string; thinking?: string; timings_ms?: { ollama: number; comfyui: number }; image_prompt_used?: string; negative_prompt_used?: string; comfyui_info?: any; }

export interface Message { id: string; dialogue_id: string; role: 'user' | 'assistant'; blocks: TextBlock[]; image_path: string | null; image_variants: string[]; selected_image_index: number; has_image: boolean; text_versions: TextBlock[][]; selected_version_index: number; parent_id: string | null; created_at: string; debug_info?: DebugInfo | null; }

export interface Dialogue { id: string; title: string; description: string; settings: DialogueSettings; messages: Message[]; created_at: string; message_count?: number; }

export type AppView = 'list' | 'create' | 'chat' | 'novel' | 'catalog';