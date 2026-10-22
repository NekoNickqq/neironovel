import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Dialogue, Message, TextBlock, AppView, CharacterCard } from './types';
import { createMockDialogue, generateAIResponse, getRandomImage } from './mock';

interface AppState {
  dialogues: Dialogue[];
  currentDialogueId: string | null;
  currentView: AppView;
  isGenerating: boolean;
  novelModeHidden: boolean;
}

type Action =
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'CREATE_DIALOGUE'; payload: Dialogue }
  | { type: 'SELECT_DIALOGUE'; payload: string }
  | { type: 'ADD_USER_MESSAGE'; payload: { dialogueId: string; text: string } }
  | { type: 'ADD_ASSISTANT_MESSAGE'; payload: { dialogueId: string; message: Message } }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'TOGGLE_NOVEL_HIDDEN' }
  | { type: 'SELECT_IMAGE'; payload: { messageId: string; index: number } }
  | { type: 'SELECT_TEXT_VERSION'; payload: { messageId: string; index: number } }
  | { type: 'ADD_IMAGE_VARIANT'; payload: { messageId: string; imagePath: string } }
  | { type: 'ADD_TEXT_VERSION'; payload: { messageId: string; blocks: TextBlock[] } }
  | { type: 'DELETE_DIALOGUE'; payload: string };

const initialDialogue = createMockDialogue();

const initialState: AppState = {
  dialogues: [initialDialogue],
  currentDialogueId: null,
  currentView: 'list',
  isGenerating: false,
  novelModeHidden: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'CREATE_DIALOGUE':
      return { ...state, dialogues: [...state.dialogues, action.payload], currentDialogueId: action.payload.id };
    case 'SELECT_DIALOGUE':
      return { ...state, currentDialogueId: action.payload };
    case 'ADD_USER_MESSAGE': {
      const dialogues = state.dialogues.map(d => {
        if (d.id !== action.payload.dialogueId) return d;
        const messages = d.messages.map(m => ({ ...m }));
        const lastMsg = messages[messages.length - 1];
        const newMsg: Message = {
          id: `msg-${Date.now()}`,
          dialogue_id: d.id,
          role: 'user',
          blocks: [{ speaker: 'user', text: action.payload.text }],
          image_path: null,
          image_variants: [],
          selected_image_index: 0,
          has_image: false,
          text_versions: [],
          selected_version_index: 0,
          parent_id: lastMsg?.id || null,
          created_at: new Date().toISOString(),
        };
        return { ...d, messages: [...messages, newMsg] };
      });
      return { ...state, dialogues };
    }
    case 'ADD_ASSISTANT_MESSAGE': {
      const dialogues = state.dialogues.map(d => {
        if (d.id !== action.payload.dialogueId) return d;
        const messages = d.messages.map(m => ({ ...m }));
        return { ...d, messages: [...messages, action.payload.message] };
      });
      return { ...state, dialogues };
    }
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'TOGGLE_NOVEL_HIDDEN':
      return { ...state, novelModeHidden: !state.novelModeHidden };
    case 'SELECT_IMAGE': {
      const dialogues = state.dialogues.map(d => ({
        ...d,
        messages: d.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, selected_image_index: action.payload.index }
            : m
        ),
      }));
      return { ...state, dialogues };
    }
    case 'SELECT_TEXT_VERSION': {
      const dialogues = state.dialogues.map(d => ({
        ...d,
        messages: d.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, selected_version_index: action.payload.index }
            : m
        ),
      }));
      return { ...state, dialogues };
    }
    case 'ADD_IMAGE_VARIANT': {
      const dialogues = state.dialogues.map(d => ({
        ...d,
        messages: d.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, image_variants: [...m.image_variants, action.payload.imagePath], selected_image_index: m.image_variants.length }
            : m
        ),
      }));
      return { ...state, dialogues };
    }
    case 'ADD_TEXT_VERSION': {
      const dialogues = state.dialogues.map(d => ({
        ...d,
        messages: d.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, text_versions: [...m.text_versions, action.payload.blocks], selected_version_index: m.text_versions.length }
            : m
        ),
      }));
      return { ...state, dialogues };
    }
    case 'DELETE_DIALOGUE': {
      const dialogues = state.dialogues.filter(d => d.id !== action.payload);
      const currentDialogueId = state.currentDialogueId === action.payload ? null : state.currentDialogueId;
      return { ...state, dialogues, currentDialogueId };
    }
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentDialogue: Dialogue | null;
  sendMessage: (text: string, generateImage: boolean) => Promise<void>;
  regenerateText: (messageId: string) => Promise<void>;
  regenerateImage: (messageId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const currentDialogue = state.dialogues.find(d => d.id === state.currentDialogueId) || null;

  const sendMessage = async (text: string, generateImage: boolean) => {
    if (!currentDialogue) return;

    dispatch({ type: 'ADD_USER_MESSAGE', payload: { dialogueId: currentDialogue.id, text } });
    dispatch({ type: 'SET_GENERATING', payload: true });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

    const aiResponse = generateAIResponse();
    const imagePath = generateImage ? getRandomImage() : null;

    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      dialogue_id: currentDialogue.id,
      role: 'assistant',
      blocks: aiResponse.blocks,
      image_path: imagePath,
      image_variants: imagePath ? [imagePath] : [],
      selected_image_index: 0,
      has_image: !!imagePath,
      text_versions: [],
      selected_version_index: 0,
      parent_id: `msg-${Date.now() - 1}`,
      created_at: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_ASSISTANT_MESSAGE', payload: { dialogueId: currentDialogue.id, message: assistantMessage } });
    dispatch({ type: 'SET_GENERATING', payload: false });
  };

  const regenerateText = async (messageId: string) => {
    dispatch({ type: 'SET_GENERATING', payload: true });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const aiResponse = generateAIResponse();
    dispatch({ type: 'ADD_TEXT_VERSION', payload: { messageId, blocks: aiResponse.blocks } });
    dispatch({ type: 'SET_GENERATING', payload: false });
  };

  const regenerateImage = async (messageId: string) => {
    dispatch({ type: 'SET_GENERATING', payload: true });
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));

    const newImage = getRandomImage();
    dispatch({ type: 'ADD_IMAGE_VARIANT', payload: { messageId, imagePath: newImage } });
    dispatch({ type: 'SET_GENERATING', payload: false });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, currentDialogue, sendMessage, regenerateText, regenerateImage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
