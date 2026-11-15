import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store';
import { DialogueList } from './components/DialogueList';
import { CreateDialogue } from './components/CreateDialogue';
import { ChatMode } from './components/ChatMode';
import { VisualNovelMode } from './components/VisualNovelMode';
import { ApiStatusBar } from './components/ApiStatusBar';
import { Catalog } from './components/Catalog';
import { CreateWorldPage } from './components/CreateWorldPage';
import { CreateCharacterPage } from './components/CreateCharacterPage';
import { CardViewPage } from './components/CardViewPage'; // <-- ИМПОРТ

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DialogueList />} />
          <Route path="/create" element={<CreateDialogue />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/create-world" element={<CreateWorldPage />} />
          <Route path="/catalog/create-character" element={<CreateCharacterPage />} />
          <Route path="/catalog/:type/:id" element={<CardViewPage />} /> {/* <-- НОВЫЙ РОУТ */}
          <Route path="/chat/:id" element={<ChatMode />} />
          <Route path="/novel/:id" element={<VisualNovelMode />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ApiStatusBar />
    </AppProvider>
  );
}