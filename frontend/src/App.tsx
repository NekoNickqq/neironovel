import { AppProvider, useApp } from './store';
import { DialogueList } from './components/DialogueList';
import { CreateDialogue } from './components/CreateDialogue';
import { ChatMode } from './components/ChatMode';
import { VisualNovelMode } from './components/VisualNovelMode';
import { ApiStatusBar } from './components/ApiStatusBar';
import { Catalog } from './components/Catalog'; // <-- ДОБАВЛЕН ИМПОРТ

function AppContent() {
  const { state } = useApp();

  switch (state.currentView) {
    case 'list':
      return <DialogueList />;
    case 'create':
      return <CreateDialogue />;
    case 'chat':
      return <ChatMode />;
    case 'novel':
      return <VisualNovelMode />;
    case 'catalog':          // <-- ДОБАВЛЕН МАРШРУТ
      return <Catalog />;
    default:
      return <DialogueList />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <ApiStatusBar />
    </AppProvider>
  );
}