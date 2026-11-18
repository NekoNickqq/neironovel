import { ChangeEvent, useRef, useState } from 'react';
import { BookOpen, Check, ImagePlus, Loader2, MapPinned, Sparkles, X } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../store';
import { CharacterAvatarInfo } from '../types';
import { SceneImage } from './SceneImage';

export function EditSettingsModal({ onClose }: { onClose: () => void }) {
  const { currentDialogue, openDialogue } = useApp();
  const [tab, setTab] = useState<'world' | 'avatars'>('world');
  const [activeCardId, setActiveCardId] = useState(currentDialogue?.settings.character_cards[0]?.id ?? '');
  const [avatars, setAvatars] = useState<CharacterAvatarInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!currentDialogue) return null;

  const cards = currentDialogue.settings.character_cards;
  const worldState = currentDialogue.settings.world_state;
  const activeCard = cards.find(card => card.id === activeCardId) ?? cards[0];
  const selectedId = currentDialogue.settings.selected_avatar_ids?.[activeCard?.id ?? ''];
  const cardAvatars = avatars.filter(avatar => avatar.character_card_id === activeCard?.id);
  const loadAvatars = async () => { if (!loaded) { setBusy(true); try { setAvatars(await api.getDialogueAvatars(currentDialogue.id)); setLoaded(true); } finally { setBusy(false); } } };
  const selectAvatar = async (avatarId: string) => { if (!activeCard) return; setBusy(true); try { await api.selectDialogueAvatar(currentDialogue.id, activeCard.id, avatarId); await openDialogue(currentDialogue.id); } finally { setBusy(false); } };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !activeCard) return; setBusy(true); try { const avatar = await api.uploadDialogueAvatar(currentDialogue.id, file, activeCard.id); setAvatars(items => [avatar, ...items]); setLoaded(true); await openDialogue(currentDialogue.id); } finally { setBusy(false); } };
  const generate = async () => { if (!activeCard) return; setBusy(true); try { const avatar = await api.generateDialogueAvatar(currentDialogue.id, activeCard.id); setAvatars(items => [avatar, ...items]); setLoaded(true); await openDialogue(currentDialogue.id); } finally { setBusy(false); } };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
    <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl max-h-[90vh]" onClick={event => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-5 py-4"><h2 className="font-semibold text-white">Настройки мира</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button></header>
      <div className="flex gap-2 border-b border-gray-800 px-5 py-3"><button onClick={() => setTab('world')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'world' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><BookOpen size={15} className="mr-2 inline" />Мир</button><button onClick={() => { setTab('avatars'); void loadAvatars(); }} className={`rounded-lg px-3 py-2 text-sm ${tab === 'avatars' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><ImagePlus size={15} className="mr-2 inline" />Аватарки</button></div>
      <main className="overflow-y-auto p-5 scrollbar-thin">
        {tab === 'world' ? <WorldStateView worldState={worldState} /> : <>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          <div className="mb-4 flex flex-wrap gap-2">{cards.map(card => <button key={card.id} onClick={() => setActiveCardId(card.id)} className={`rounded-lg px-3 py-2 text-sm ${activeCard?.id === card.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>{card.name}</button>)}</div>
          {activeCard && <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-gray-400">Аватарка для <b className="text-white">{activeCard.name}</b>.</p><div className="flex gap-2"><button onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-lg bg-gray-800 px-3 py-2 text-sm hover:bg-gray-700"><ImagePlus size={15} className="mr-1 inline" />Загрузить</button><button onClick={generate} disabled={busy} className="rounded-lg bg-purple-600 px-3 py-2 text-sm hover:bg-purple-500"><Sparkles size={15} className="mr-1 inline" />Сгенерировать</button></div></div>
          {busy && <div className="mb-3 flex items-center gap-2 text-purple-300"><Loader2 className="animate-spin" size={18} /> Обработка…</div>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{cardAvatars.map(avatar => <button key={avatar.id} onClick={() => void selectAvatar(avatar.id)} className={`relative overflow-hidden rounded-xl border-2 bg-gray-950 ${selectedId === avatar.id ? 'border-green-500' : 'border-gray-700 hover:border-purple-500'}`}><SceneImage src={avatar.image_path} alt={`Аватар ${activeCard.name}`} className="aspect-square w-full object-cover" />{selectedId === avatar.id && <span className="absolute right-2 top-2 rounded-full bg-green-500 p-1"><Check size={14} /></span>}</button>)}</div>
          {!busy && cardAvatars.length === 0 && <p className="py-10 text-center text-gray-500">Нет аватарок. Загрузите или сгенерируйте первую.</p>}</>}
        </>}
      </main>
    </div>
  </div>;
}

function WorldStateView({ worldState }: { worldState: import('../types').WorldState | undefined }) {
  const locations = worldState?.base_locations ?? [];
  const outfits = worldState?.outfit_sets ?? [];
  return <div className="space-y-4">
    <Section icon={<BookOpen size={18} />} title="Предыстория"><p className="whitespace-pre-wrap">{worldState?.character_backstory || 'Ещё генерируется…'}</p></Section>
    <Section icon={<MapPinned size={18} />} title="Стартовая локация"><p className="font-medium text-white">{worldState?.start_location?.name || 'Ещё генерируется…'}</p><p className="mt-2">{worldState?.start_location?.atmosphere}</p><p className="mt-2 text-xs text-gray-500">{worldState?.start_location?.visual}</p></Section>
    <Section icon={<MapPinned size={18} />} title="Локации">{locations.length ? <div className="grid gap-2 sm:grid-cols-2">{locations.map(location => <div key={location.name} className="rounded-lg border border-gray-700 bg-gray-950/60 p-3"><b>{location.name}</b><p className="mt-1 text-xs text-gray-400">{location.visual}</p></div>)}</div> : 'Ещё генерируются…'}</Section>
    <Section icon={<Sparkles size={18} />} title="Сеты одежды">{outfits.length ? <div className="flex flex-wrap gap-2">{outfits.map(set => <div key={set.name} className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2"><b>{set.name}</b><p className="text-xs text-gray-400">{set.tags}</p></div>)}</div> : 'Ещё генерируются…'}</Section>
  </div>;
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-gray-700 bg-gray-800/40 p-4"><h3 className="mb-3 flex items-center gap-2 font-medium text-white">{icon}{title}</h3><div className="text-sm text-gray-300">{children}</div></section>;
}
