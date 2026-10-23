import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  ReactNode,
} from 'react';
import { Dialogue, Message, TextBlock, AppView } from './types';
import { api, ApiError } from './api';

interface AppState {
  dialogues: Dialogue[];
  currentDialogueId: string | null;
  currentView: AppView;
  isGenerating: boolean;
  isLoadingList: boolean;
  novelModeHidden: boolean;
  apiError: string | null;
  services: { ollama: boolean; comfyui: boolean } | null;
}

type Action =
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'SET_DIALOGUES'; payload: Dialogue[] }
  | { type: 'UPSERT_DIALOGUE'; payload: Dialogue }
  | { type: 'SELECT_DIALOGUE'; payload: string }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_LOADING_LIST'; payload: boolean }
  | { type: 'SET_API_ERROR'; payload: string | null }
  | { type: 'SET_SERVICES'; payload: { ollama: boolean; comfyui: boolean } | null }
  | { type: 'TOGGLE_NOVEL_HIDDEN' }
  | { type: 'SELECT_IMAGE'; payload: { messageId: string; index: number } }
  | { type: 'SELECT_TEXT_VERSION'; payload: { messageId: string; index: number } }
  | { type: 'DELETE_DIALOGUE'; payload: string };

const initialState: AppState = {
  dialogues: [],
  currentDialogueId: null,
  currentView: 'list',
  isGenerating: false,
  isLoadingList: true,
  novelModeHidden: false,
  apiError: null,
  services: null,
};

function upsertDialogueList(dialogues: Dialogue[], dialogue: Dialogue): Dialogue[] {
  const idx = dialogues.findIndex(d => d.id === dialogue.id);
  if (idx === -1) return [...dialogues, dialogue];
  const next = [...dialogues];
  next[idx] = dialogue;
  return next;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_DIALOGUES':
      return { ...state, dialogues: action.payload };
    case 'UPSERT_DIALOGUE':
      return { ...state, dialogues: upsertDialogueList(state.dialogues, action.payload) };
    case 'SELECT_DIALOGUE':
      return { ...state, currentDialogueId: action.payload };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_LOADING_LIST':
      return { ...state, isLoadingList: action.payload };
    case 'SET_API_ERROR':
      return { ...state, apiError: action.payload };
    case 'SET_SERVICES':
      return { ...state, services: action.payload };
    case 'TOGGLE_NOVEL_HIDDEN':
      return { ...state, novelModeHidden: !state.novelModeHidden };
    case 'SELECT_IMAGE': {
      const dialogues = state.dialogues.map(d => ({
        ...d,
        messages: d.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, selected_image_index: action.payload.index }
            : m,
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
            : m,
        ),
      }));
      return { ...state, dialogues };
    }
    case 'DELETE_DIALOGUE': {
      const dialogues = state.dialogues.filter(d => d.id !== action.payload);
      const currentDialogueId =
        state.currentDialogueId === action.payload ? null : state.currentDialogueId;
      return { ...state, dialogues, currentDialogueId };
    }
    default:
      return state;
  }
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка API';
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentDialogue: Dialogue | null;
  refreshDialogueList: () => Promise<void>;
  openDialogue: (id: string) => Promise<void>;
  createDialogue: (payload: {
    title: string;
    description: string;
    world_lore: string;
    character_cards: Dialogue['settings']['character_cards'];
    style_preset: string;
    ai_controls_user: boolean;
  }) => Promise<void>;
  deleteDialogue: (id: string) => Promise<void>;
  sendMessage: (text: string, generateImage: boolean) => Promise<void>;
  regenerateText: (messageId: string) => Promise<void>;
  regenerateImage: (messageId: string) => Promise<void>;
  selectImage: (messageId: string, index: number) => Promise<void>;
  selectTextVersion: (messageId: string, index: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const currentDialogue =
    state.dialogues.find(d => d.id === state.currentDialogueId) ?? null;

  const refreshDialogueList = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_LIST', payload: true });
    try {
      const list = await api.listDialogues();
      dispatch({ type: 'SET_DIALOGUES', payload: list });
      dispatch({ type: 'SET_API_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
    } finally {
      dispatch({ type: 'SET_LOADING_LIST', payload: false });
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await api.health();
      dispatch({ type: 'SET_SERVICES', payload: health.services });
    } catch {
      dispatch({ type: 'SET_SERVICES', payload: null });
    }
  }, []);

  useEffect(() => {
    void refreshDialogueList();
    void refreshHealth();
  }, [refreshDialogueList, refreshHealth]);

  const openDialogue = useCallback(async (id: string) => {
    try {
      const dialogue = await api.getDialogue(id);
      dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
      dispatch({ type: 'SELECT_DIALOGUE', payload: id });
      dispatch({ type: 'SET_API_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      throw err;
    }
  }, []);

  const createDialogue = useCallback(
    async (payload: {
      title: string;
      description: string;
      world_lore: string;
      character_cards: Dialogue['settings']['character_cards'];
      style_preset: string;
      ai_controls_user: boolean;
    }) => {
      const lore = payload.world_lore.trim()
        ? payload.world_lore
        : payload.description;
      try {
        const dialogue = await api.createDialogue({
          title: payload.title,
          description: payload.description,
          world_lore: lore,
          character_cards: payload.character_cards,
          style_preset: payload.style_preset,
          ai_controls_user: payload.ai_controls_user,
        });
        dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
        dispatch({ type: 'SELECT_DIALOGUE', payload: dialogue.id });
        dispatch({ type: 'SET_VIEW', payload: 'chat' });
        dispatch({ type: 'SET_API_ERROR', payload: null });
      } catch (err) {
        dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
        throw err;
      }
    },
    [],
  );

  const deleteDialogue = useCallback(async (id: string) => {
    try {
      await api.deleteDialogue(id);
      dispatch({ type: 'DELETE_DIALOGUE', payload: id });
      dispatch({ type: 'SET_API_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
    }
  }, []);

  const reloadCurrentDialogue = useCallback(async () => {
    if (!state.currentDialogueId) return;
    const dialogue = await api.getDialogue(state.currentDialogueId);
    dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
  }, [state.currentDialogueId]);

  const sendMessage = useCallback(
    async (text: string, generateImage: boolean) => {
      if (!state.currentDialogueId) return;
      dispatch({ type: 'SET_GENERATING', payload: true });
      dispatch({ type: 'SET_API_ERROR', payload: null });
      try {
        await api.sendMessage(state.currentDialogueId, text, generateImage);
        await reloadCurrentDialogue();
      } catch (err) {
        dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      } finally {
        dispatch({ type: 'SET_GENERATING', payload: false });
      }
    },
    [state.currentDialogueId, reloadCurrentDialogue],
  );

  const regenerateText = useCallback(
    async (messageId: string) => {
      if (!state.currentDialogueId) return;
      dispatch({ type: 'SET_GENERATING', payload: true });
      dispatch({ type: 'SET_API_ERROR', payload: null });
      try {
        await api.regenerateText(state.currentDialogueId, messageId);
        await reloadCurrentDialogue();
      } catch (err) {
        dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      } finally {
        dispatch({ type: 'SET_GENERATING', payload: false });
      }
    },
    [state.currentDialogueId, reloadCurrentDialogue],
  );

  const regenerateImage = useCallback(
    async (messageId: string) => {
      if (!state.currentDialogueId) return;
      dispatch({ type: 'SET_GENERATING', payload: true });
      dispatch({ type: 'SET_API_ERROR', payload: null });
      try {
        await api.regenerateImage(state.currentDialogueId, messageId);
        await reloadCurrentDialogue();
      } catch (err) {
        dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      } finally {
        dispatch({ type: 'SET_GENERATING', payload: false });
      }
    },
    [state.currentDialogueId, reloadCurrentDialogue],
  );

  const selectImage = useCallback(async (messageId: string, index: number) => {
    dispatch({ type: 'SELECT_IMAGE', payload: { messageId, index } });
    try {
      await api.selectImage(messageId, index);
    } catch (err) {
      dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      await reloadCurrentDialogue();
    }
  }, [reloadCurrentDialogue]);

  const selectTextVersion = useCallback(async (messageId: string, index: number) => {
    dispatch({ type: 'SELECT_TEXT_VERSION', payload: { messageId, index } });
    try {
      await api.selectVersion(messageId, index);
    } catch (err) {
      dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) });
      await reloadCurrentDialogue();
    }
  }, [reloadCurrentDialogue]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        currentDialogue,
        refreshDialogueList,
        openDialogue,
        createDialogue,
        deleteDialogue,
        sendMessage,
        regenerateText,
        regenerateImage,
        selectImage,
        selectTextVersion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
