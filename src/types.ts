export interface TextBlock {
  speaker: 'narrator' | 'hero' | 'sidekick' | 'user';
  text: string;
}

export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  avatar_path: string | null;
  color: string;
}

export interface DialogueSettings {
  world_lore: string;
  character_cards: CharacterCard[];
  style_preset: string;
  font_config: {
    narrator: string;
    user: string;
    hero: string;
    sidekick: string;
  };
  ai_controls_user: boolean;
}

export interface Message {
  id: string;
  dialogue_id: string;
  role: 'user' | 'assistant';
  blocks: TextBlock[];
  image_path: string | null;
  image_variants: string[];
  selected_image_index: number;
  has_image: boolean;
  text_versions: TextBlock[][];
  selected_version_index: number;
  parent_id: string | null;
  created_at: string;
}

export interface Dialogue {
  id: string;
  title: string;
  description: string;
  settings: DialogueSettings;
  messages: Message[];
  created_at: string;
}

export type AppView = 'list' | 'create' | 'chat' | 'novel';
