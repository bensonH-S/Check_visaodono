import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appBasePath } from './config/paths';
import { theme } from './theme';
import AppLayout from './layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import RankingPage from './pages/RankingPage';
import ChecklistPage from './pages/ChecklistPage';
import VisitasPage from './pages/VisitasPage';
import LojasPage from './pages/LojasPage';
import NcPage from './pages/NcPage';
import RelatorioPage from './pages/RelatorioPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename={appBasePath}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="visitas" element={<VisitasPage />} />
            <Route path="lojas" element={<LojasPage />} />
            <Route path="nao-conformidades" element={<NcPage />} />
            <Route path="relatorio/visita/:id" element={<RelatorioPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
