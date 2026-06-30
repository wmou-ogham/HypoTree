import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ResearchHome } from './pages/ResearchHome';
import { ResearchEditor } from './pages/ResearchEditor';

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<ResearchHome />} />
        <Route path="/r/:slug" element={<ResearchEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
