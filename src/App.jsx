import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import BitablePage from './pages/BitablePage.jsx';
import DocxPage from './pages/DocxPage.jsx';
import HomePage from './pages/HomePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SheetPage from './pages/SheetPage.jsx';
import SourcesPage from './pages/SourcesPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="type/:type" element={<HomePage />} />
        <Route path="docx/:token" element={<DocxPage />} />
        <Route path="sheet/:token" element={<SheetPage />} />
        <Route path="bitable/:token" element={<BitablePage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
