import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appBasePath } from './config/paths';
import { theme } from './theme';
import RequireAuth from './components/RequireAuth';
import PortalLayout from './layout/PortalLayout';
import ChamadosMobileLayout from './layout/ChamadosMobileLayout';
import LoginPage from './pages/LoginPage';
import LoginMobilePage from './pages/LoginMobilePage';
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
import ManutencaoDetalhePage from './pages/manutencao/ManutencaoDetalhePage';
import ManutencaoAprovacoesPage from './pages/manutencao/ManutencaoAprovacoesPage';
import ManutencaoAprovacaoDetalhePage from './pages/manutencao/ManutencaoAprovacaoDetalhePage';
import ChamadosMobileHistoricoPage from './pages/manutencao/ChamadosMobileHistoricoPage';
import ChamadosMobileNovoPage from './pages/manutencao/ChamadosMobileNovoPage';
import ChamadosMobileDetalhePage from './pages/manutencao/ChamadosMobileDetalhePage';
import FrotaMobileHubPage from './pages/frota/FrotaMobileHubPage';
import FrotaAbastecimentoPage from './pages/frota/FrotaAbastecimentoPage';
import FrotaTermoPage from './pages/frota/FrotaTermoPage';
import FrotaVeiculoPage from './pages/frota/FrotaVeiculoPage';
import UsuariosPage from './pages/UsuariosPage';
import ConfiguracoesPage from './pages/configuracoes/ConfiguracoesPage';
import ConfiguracoesLayout from './layout/ConfiguracoesLayout';
import CategoriasPage from './pages/configuracoes/CategoriasPage';
import SlaPage from './pages/configuracoes/SlaPage';
import CargosPage from './pages/configuracoes/CargosPage';
import ChecklistPerguntasPage from './pages/configuracoes/ChecklistPerguntasPage';
import WhatsAppPage from './pages/configuracoes/WhatsAppPage';
import RotaPermissao from './components/RotaPermissao';
import RotaChecklist from './components/RotaChecklist';
import RotaFrota from './components/RotaFrota';
import ZoomWarning from './components/ZoomWarning';
import AppToastContainer from './components/AppToastContainer';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppToastContainer />
      <ZoomWarning />
      <BrowserRouter basename={appBasePath}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/mobile" element={<LoginMobilePage />} />
          <Route
            element={
              <RequireAuth>
                <ChamadosMobileLayout />
              </RequireAuth>
            }
          >
            <Route path="chamados/mobile/novo" element={<ChamadosMobileNovoPage />} />
            <Route path="chamados/mobile/:idChamado" element={<ChamadosMobileDetalhePage />} />
            <Route path="chamados/mobile" element={<ChamadosMobileHistoricoPage />} />
            <Route
              path="checklist/mobile/concluido/:id"
              element={
                <RotaChecklist mobile>
                  <ChecklistConcluidoPage />
                </RotaChecklist>
              }
            />
            <Route
              path="checklist/mobile"
              element={
                <RotaChecklist mobile>
                  <ChecklistPage />
                </RotaChecklist>
              }
            />
            <Route
              path="frota/mobile/abastecimento"
              element={
                <RotaFrota>
                  <FrotaAbastecimentoPage />
                </RotaFrota>
              }
            />
            <Route
              path="frota/mobile/termo"
              element={
                <RotaFrota>
                  <FrotaTermoPage />
                </RotaFrota>
              }
            />
            <Route
              path="frota/mobile/veiculo"
              element={
                <RotaFrota>
                  <FrotaVeiculoPage />
                </RotaFrota>
              }
            />
            <Route
              path="frota/mobile"
              element={
                <RotaFrota>
                  <FrotaMobileHubPage />
                </RotaFrota>
              }
            />
          </Route>
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RotaPermissao permissoes={['portal.dashboard.ver']}>
                  <DashboardPage />
                </RotaPermissao>
              }
            />
            <Route
              path="ranking"
              element={
                <RotaPermissao permissoes={['portal.dashboard.ver']}>
                  <RankingPage />
                </RotaPermissao>
              }
            />
            <Route
              path="checklist"
              element={
                <RotaChecklist>
                  <ChecklistPage />
                </RotaChecklist>
              }
            />
            <Route
              path="checklist/concluido/:id"
              element={
                <RotaChecklist>
                  <ChecklistConcluidoPage />
                </RotaChecklist>
              }
            />
            <Route
              path="visitas"
              element={
                <RotaPermissao permissoes={['portal.visitas.ver']}>
                  <VisitasPage />
                </RotaPermissao>
              }
            />
            <Route
              path="lojas"
              element={<Navigate to="/configuracoes/lojas" replace />}
            />
            <Route
              path="nao-conformidades"
              element={
                <RotaPermissao permissoes={['portal.dashboard.ver']}>
                  <NcPage />
                </RotaPermissao>
              }
            />
            <Route
              path="chamados/aprovacoes/:idChamado"
              element={
                <RotaPermissao permissoes={['chamados.aprovar']}>
                  <ManutencaoAprovacaoDetalhePage />
                </RotaPermissao>
              }
            />
            <Route
              path="chamados/aprovacoes"
              element={
                <RotaPermissao permissoes={['chamados.aprovar']}>
                  <ManutencaoAprovacoesPage />
                </RotaPermissao>
              }
            />
            <Route
              path="chamados"
              element={
                <RotaPermissao permissoes={['chamados.ver']}>
                  <ManutencaoChamadosPage />
                </RotaPermissao>
              }
            />
            <Route
              path="chamados/novo"
              element={
                <RotaPermissao permissoes={['chamados.abrir']}>
                  <ManutencaoNovoPage />
                </RotaPermissao>
              }
            />
            <Route
              path="chamados/:idChamado"
              element={
                <RotaPermissao permissoes={['chamados.ver', 'chamados.abrir']}>
                  <ManutencaoDetalhePage />
                </RotaPermissao>
              }
            />
            <Route path="manutencao" element={<Navigate to="/chamados" replace />} />
            <Route path="manutencao/novo" element={<Navigate to="/chamados/novo" replace />} />
            <Route path="relatorio/visita/:id" element={<RelatorioPage />} />
            <Route
              path="usuarios"
              element={<Navigate to="/configuracoes/usuarios" replace />}
            />
            <Route
              path="configuracoes"
              element={
                <RotaPermissao permissoes={['configuracoes.ver', 'usuarios.gerenciar', 'portal.lojas.ver']}>
                  <ConfiguracoesLayout />
                </RotaPermissao>
              }
            >
              <Route index element={<ConfiguracoesPage />} />
              <Route
                path="perguntas"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver']}>
                    <ChecklistPerguntasPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="usuarios"
                element={
                  <RotaPermissao permissoes={['usuarios.gerenciar']}>
                    <UsuariosPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="lojas"
                element={
                  <RotaPermissao permissoes={['portal.lojas.ver']}>
                    <LojasPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="categorias"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver']}>
                    <CategoriasPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="sla"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver']}>
                    <SlaPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="cargos"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver']}>
                    <CargosPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="whatsapp"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver']}>
                    <WhatsAppPage />
                  </RotaPermissao>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
