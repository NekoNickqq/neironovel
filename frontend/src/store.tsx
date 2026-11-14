import React, { createContext, useCallback, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { Dialogue, Message, AppView, WorldCard, CharacterCard } from './types';
import { api, ApiError, OllamaMode } from './api';

interface AppState {
  dialogues: Dialogue[]; currentDialogueId: string | null; currentView: AppView; isGenerating: boolean; isLoadingList: boolean;
  novelModeHidden: boolean; apiError: string | null; services: { ollama: boolean; comfyui: boolean } | null;
  ollamaMode: OllamaMode; ollamaModels: string[]; selectedOllamaModel: string | null;
  draftDialogue: Dialogue | null;
  worlds: WorldCard[];
  characters: CharacterCard[];
}

type Action =
  | { type: 'SET_VIEW'; payload: AppView } | { type: 'SET_DIALOGUES'; payload: Dialogue[] }
  | { type: 'UPSERT_DIALOGUE'; payload: Dialogue } | { type: 'SELECT_DIALOGUE'; payload: string }
  | { type: 'SET_GENERATING'; payload: boolean } | { type: 'SET_LOADING_LIST'; payload: boolean }
  | { type: 'SET_API_ERROR'; payload: string | null } | { type: 'SET_SERVICES'; payload: { ollama: boolean; comfyui: boolean } | null }
  | { type: 'SET_OLLAMA_INFO'; payload: { mode: OllamaMode; models: string[]; current: string } }
  | { type: 'SET_SELECTED_OLLAMA_MODEL'; payload: string | null } | { type: 'TOGGLE_NOVEL_HIDDEN' }
  | { type: 'SELECT_IMAGE'; payload: { messageId: string; index: number } }
  | { type: 'SELECT_TEXT_VERSION'; payload: { messageId: string; index: number } } | { type: 'DELETE_DIALOGUE'; payload: string }
  | { type: 'SET_DRAFT_DIALOGUE'; payload: Dialogue | null }
  | { type: 'SET_WORLDS'; payload: WorldCard[] } | { type: 'SET_CHARACTERS'; payload: CharacterCard[] };

const initialState: AppState = {
  dialogues: [], currentDialogueId: null, currentView: 'list', isGenerating: false, isLoadingList: true,
  novelModeHidden: false, apiError: null, services: null, ollamaMode: 'local', ollamaModels: [], selectedOllamaModel: null,
  draftDialogue: null, worlds: [], characters: [],
};

function upsertDialogueList(dialogues: Dialogue[], dialogue: Dialogue): Dialogue[] {
  const idx = dialogues.findIndex(d => d.id === dialogue.id);
  if (idx === -1) return [...dialogues, dialogue];
  const next = [...dialogues]; next[idx] = dialogue; return next;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, currentView: action.payload };
    case 'SET_DIALOGUES': return { ...state, dialogues: action.payload };
    case 'UPSERT_DIALOGUE': return { ...state, dialogues: upsertDialogueList(state.dialogues, action.payload) };
    case 'SELECT_DIALOGUE': return { ...state, currentDialogueId: action.payload };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
    case 'SET_LOADING_LIST': return { ...state, isLoadingList: action.payload };
    case 'SET_API_ERROR': return { ...state, apiError: action.payload };
    case 'SET_SERVICES': return { ...state, services: action.payload };
    case 'SET_OLLAMA_INFO': {
      const { mode, models, current } = action.payload;
      const selected = state.selectedOllamaModel && models.includes(state.selectedOllamaModel) ? state.selectedOllamaModel : current || null;
      return { ...state, ollamaMode: mode, ollamaModels: models, selectedOllamaModel: selected };
    }
    case 'SET_SELECTED_OLLAMA_MODEL': return { ...state, selectedOllamaModel: action.payload };
    case 'TOGGLE_NOVEL_HIDDEN': return { ...state, novelModeHidden: !state.novelModeHidden };
    case 'SELECT_IMAGE': {
      const dialogues = state.dialogues.map(d => ({ ...d, messages: d.messages.map(m => m.id === action.payload.messageId ? { ...m, selected_image_index: action.payload.index } : m) }));
      return { ...state, dialogues };
    }
    case 'SELECT_TEXT_VERSION': {
      const dialogues = state.dialogues.map(d => ({ ...d, messages: d.messages.map(m => m.id === action.payload.messageId ? { ...m, selected_version_index: action.payload.index } : m) }));
      return { ...state, dialogues };
    }
    case 'DELETE_DIALOGUE': {
      const dialogues = state.dialogues.filter(d => d.id !== action.payload);
      const currentDialogueId = state.currentDialogueId === action.payload ? null : state.currentDialogueId;
      return { ...state, dialogues, currentDialogueId };
    }
    case 'SET_DRAFT_DIALOGUE': return { ...state, draftDialogue: action.payload };
    case 'SET_WORLDS': return { ...state, worlds: action.payload };
    case 'SET_CHARACTERS': return { ...state, characters: action.payload };
    default: return state;
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
  refreshCatalog: () => Promise<void>;
  openDialogue: (id: string) => Promise<void>;
  createDialogue: (payload: { title: string; description: string; world_data: WorldCard; character_cards: CharacterCard[]; ai_controls_user: boolean; }) => Promise<void>;
  deleteDialogue: (id: string) => Promise<void>;
  updateDialogueSettings: (payload: { world_data?: WorldCard; character_cards?: CharacterCard[]; ai_controls_user?: boolean }) => Promise<void>;
  sendMessage: (text: string, generateImage: boolean) => Promise<void>;
  stopGeneration: () => void;
  regenerateText: (messageId: string, model?: string | null) => Promise<void>;
  regenerateImage: (messageId: string, mode?: 'same' | 'new', model?: string | null) => Promise<void>;
  selectImage: (messageId: string, index: number) => Promise<void>;
  selectTextVersion: (messageId: string, index: number) => Promise<void>;
  refreshOllamaModels: () => Promise<void>;
  setSelectedOllamaModel: (model: string | null) => void;
  setDraftForReuse: (dialogue: Dialogue) => void;
  clearDraft: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const currentDialogue = state.dialogues.find(d => d.id === state.currentDialogueId) ?? null;
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshDialogueList = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_LIST', payload: true });
    try {
      const list = await api.listDialogues();
      dispatch({ type: 'SET_DIALOGUES', payload: list });
      dispatch({ type: 'SET_API_ERROR', payload: null });
    } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); } finally { dispatch({ type: 'SET_LOADING_LIST', payload: false }); }
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const [worlds, chars] = await Promise.all([api.listWorlds(), api.listCharacters()]);
      dispatch({ type: 'SET_WORLDS', payload: worlds });
      dispatch({ type: 'SET_CHARACTERS', payload: chars });
    } catch { /* ignore */ }
  }, []);

  const refreshHealth = useCallback(async () => {
    try { const health = await api.health(); dispatch({ type: 'SET_SERVICES', payload: health.services }); } catch { dispatch({ type: 'SET_SERVICES', payload: null }); }
  }, []);

  const refreshOllamaModels = useCallback(async () => {
    try { const info = await api.listOllamaModels(); dispatch({ type: 'SET_OLLAMA_INFO', payload: info }); } catch { /* ignore */ }
  }, []);

  const setSelectedOllamaModel = useCallback((model: string | null) => { dispatch({ type: 'SET_SELECTED_OLLAMA_MODEL', payload: model }); }, []);

  const setDraftForReuse = useCallback((dialogue: Dialogue) => {
    dispatch({ type: 'SET_DRAFT_DIALOGUE', payload: dialogue });
    dispatch({ type: 'SET_VIEW', payload: 'create' });
  }, []);

  const clearDraft = useCallback(() => { dispatch({ type: 'SET_DRAFT_DIALOGUE', payload: null }); }, []);

  useEffect(() => { void refreshDialogueList(); void refreshCatalog(); void refreshHealth(); void refreshOllamaModels(); }, [refreshDialogueList, refreshCatalog, refreshHealth, refreshOllamaModels]);

  const openDialogue = useCallback(async (id: string) => {
    try {
      const dialogue = await api.getDialogue(id);
      dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
      dispatch({ type: 'SELECT_DIALOGUE', payload: id });
      dispatch({ type: 'SET_API_ERROR', payload: null });
    } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); throw err; }
  }, []);

  const createDialogue = useCallback(async (payload: any) => {
    try {
      const dialogue = await api.createDialogue(payload);
      dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
      dispatch({ type: 'SELECT_DIALOGUE', payload: dialogue.id });
      dispatch({ type: 'SET_VIEW', payload: 'chat' });
      dispatch({ type: 'SET_API_ERROR', payload: null });
      dispatch({ type: 'SET_DRAFT_DIALOGUE', payload: null });
    } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); throw err; }
  }, []);

  const deleteDialogue = useCallback(async (id: string) => {
    try { await api.deleteDialogue(id); dispatch({ type: 'DELETE_DIALOGUE', payload: id }); dispatch({ type: 'SET_API_ERROR', payload: null }); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); }
  }, []);

  const reloadCurrentDialogue = useCallback(async () => {
    if (!state.currentDialogueId) return;
    const dialogue = await api.getDialogue(state.currentDialogueId);
    dispatch({ type: 'UPSERT_DIALOGUE', payload: dialogue });
  }, [state.currentDialogueId]);

  const updateDialogueSettings = useCallback(async (payload: { world_data?: WorldCard; character_cards?: CharacterCard[]; ai_controls_user?: boolean }) => {
    if (!state.currentDialogueId) return;
    try { await api.updateSettings(state.currentDialogueId, payload); await reloadCurrentDialogue(); dispatch({ type: 'SET_API_ERROR', payload: null }); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); }
  }, [state.currentDialogueId, reloadCurrentDialogue]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
  }, []);

  const sendMessage = useCallback(async (text: string, generateImage: boolean) => {
    if (!state.currentDialogueId) return;
    abortControllerRef.current = new AbortController();
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_API_ERROR', payload: null });
    try {
      await api.sendMessage(state.currentDialogueId, text, generateImage, state.selectedOllamaModel, abortControllerRef.current.signal);
      await reloadCurrentDialogue();
    } catch (err: any) {
      if (err.name === 'AbortError') { await new Promise(r => setTimeout(r, 1500)); await reloadCurrentDialogue(); } 
      else { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); }
    } finally { abortControllerRef.current = null; dispatch({ type: 'SET_GENERATING', payload: false }); }
  }, [state.currentDialogueId, state.selectedOllamaModel, reloadCurrentDialogue]);

  const regenerateText = useCallback(async (messageId: string, model?: string | null) => {
    if (!state.currentDialogueId) return;
    dispatch({ type: 'SET_GENERATING', payload: true });
    try { await api.regenerateText(state.currentDialogueId, messageId, model ?? state.selectedOllamaModel); await reloadCurrentDialogue(); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); } finally { dispatch({ type: 'SET_GENERATING', payload: false }); }
  }, [state.currentDialogueId, state.selectedOllamaModel, reloadCurrentDialogue]);

  const regenerateImage = useCallback(async (messageId: string, mode: 'same' | 'new' = 'same', model?: string | null) => {
    if (!state.currentDialogueId) return;
    dispatch({ type: 'SET_GENERATING', payload: true });
    try { await api.regenerateImage(state.currentDialogueId, messageId, mode, model ?? state.selectedOllamaModel); await reloadCurrentDialogue(); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); } finally { dispatch({ type: 'SET_GENERATING', payload: false }); }
  }, [state.currentDialogueId, state.selectedOllamaModel, reloadCurrentDialogue]);

  const selectImage = useCallback(async (messageId: string, index: number) => {
    dispatch({ type: 'SELECT_IMAGE', payload: { messageId, index } });
    try { await api.selectImage(messageId, index); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); await reloadCurrentDialogue(); }
  }, [reloadCurrentDialogue]);

  const selectTextVersion = useCallback(async (messageId: string, index: number) => {
    dispatch({ type: 'SELECT_TEXT_VERSION', payload: { messageId, index } });
    try { await api.selectVersion(messageId, index); } catch (err) { dispatch({ type: 'SET_API_ERROR', payload: formatApiError(err) }); await reloadCurrentDialogue(); }
  }, [reloadCurrentDialogue]);

  return (
    <AppContext.Provider value={{
      state, dispatch, currentDialogue, refreshDialogueList, refreshCatalog, openDialogue, createDialogue, deleteDialogue,
      updateDialogueSettings, sendMessage, stopGeneration, regenerateText, regenerateImage, selectImage, selectTextVersion,
      refreshOllamaModels, setSelectedOllamaModel, setDraftForReuse, clearDraft,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}