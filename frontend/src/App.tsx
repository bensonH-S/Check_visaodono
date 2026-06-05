import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appBasePath } from './config/paths';
import { theme } from './theme';
import RequireAuth from './components/RequireAuth';
import PortalLayout from './layout/PortalLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RankingPage from './pages/RankingPage';
import ChecklistPage from './pages/ChecklistPage';
import ChecklistConcluidoPage from './pages/ChecklistConcluidoPage';
import VisitasPage from './pages/VisitasPage';
import LojasPage from './pages/LojasPage';
import NcPage from './pages/NcPage';
import RelatorioPage from './pages/RelatorioPage';
import ManutencaoChamadosPage from './pages/manutencao/ManutencaoChamadosPage';
import ManutencaoNovoPage from './pages/manutencao/ManutencaoNovoPage';
import UsuariosPage from './pages/UsuariosPage';
import { getUsuario, temPermissao } from './lib/auth';
function RotaTi({ children }: { children: ReactNode }) {
  const u = getUsuario();
  if (!u || !temPermissao('usuarios.gerenciar', u)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename={appBasePath}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="checklist/concluido/:id" element={<ChecklistConcluidoPage />} />
            <Route path="visitas" element={<VisitasPage />} />
            <Route path="lojas" element={<LojasPage />} />
            <Route path="nao-conformidades" element={<NcPage />} />
            <Route path="chamados" element={<ManutencaoChamadosPage />} />
            <Route path="chamados/novo" element={<ManutencaoNovoPage />} />
            <Route path="manutencao" element={<Navigate to="/chamados" replace />} />
            <Route path="manutencao/novo" element={<Navigate to="/chamados/novo" replace />} />
            <Route path="relatorio/visita/:id" element={<RelatorioPage />} />
            <Route
              path="usuarios"
              element={
                <RotaTi>
                  <UsuariosPage />
                </RotaTi>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
