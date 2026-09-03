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
import PortaisPage from './pages/PortaisPage';
import RankingPage from './pages/RankingPage';
import ChecklistPage from './pages/ChecklistPage';
import ChecklistMobilePage from './pages/ChecklistMobilePage';
import ChecklistConcluidoPage from './pages/ChecklistConcluidoPage';
import VisitasPage from './pages/VisitasPage';
import VisitasMobilePage from './pages/VisitasMobilePage';
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
import FrotaManutencaoMobilePage from './pages/frota/FrotaManutencaoMobilePage';
import FrotaPortalIndexPage from './pages/frota/FrotaPortalIndexPage';
import FrotaOperacaoPage, { FrotaOperacaoLegacyRedirect } from './pages/frota/FrotaOperacaoPage';
import FrotaAcompanhamentoPage from './pages/frota/FrotaAcompanhamentoPage';
import FrotaVeiculoDetalhePage from './pages/frota/FrotaVeiculoDetalhePage';
import FrotaTermosPortalPage from './pages/frota/FrotaTermosPortalPage';
import FrotaRegioesPortalPage from './pages/frota/FrotaRegioesPortalPage';
import MapaTecnicosMobilePage from './pages/mapa/MapaTecnicosMobilePage';
import EscalaVisitasPage from './pages/escalas/EscalaVisitasPage';
import EscalaVisitasMobilePage from './pages/escalas/EscalaVisitasMobilePage';
import MetasPage from './pages/metas/MetasPage';
import ControleEstoquePage from './pages/estoque/ControleEstoquePage';
import EstoqueMobileListaPage from './pages/estoque/EstoqueMobileListaPage';
import EstoqueMobileConferenciaPage from './pages/estoque/EstoqueMobileConferenciaPage';
import EstoqueMobileBreakPage from './pages/estoque/EstoqueMobileBreakPage';
import EstoqueMobileNfePage from './pages/estoque/EstoqueMobileNfePage';
import EstoqueMobileSaldoPage from './pages/estoque/EstoqueMobileSaldoPage';
import EstoqueMobileVendasPage from './pages/estoque/EstoqueMobileVendasPage';
import RotaEstoqueMobile from './components/RotaEstoqueMobile';
import RotaEstoqueBreakMobile from './components/RotaEstoqueBreakMobile';
import NcMobileListaPage from './pages/nc/NcMobileListaPage';
import NcMobileResolverPage from './pages/nc/NcMobileResolverPage';
import EnergiaPage from './pages/energia/EnergiaPage';
import EnergiaNovoPage from './pages/energia/EnergiaNovoPage';
import EnergiaDetalhePage from './pages/energia/EnergiaDetalhePage';
import EnergiaMobileListaPage from './pages/energia/EnergiaMobileListaPage';
import EnergiaMobileNovoPage from './pages/energia/EnergiaMobileNovoPage';
import EnergiaMobileDetalhePage from './pages/energia/EnergiaMobileDetalhePage';
import FreelancersAprovacaoMobilePage from './pages/freelancers/FreelancersAprovacaoMobilePage';
import RotaNcMobile from './components/RotaNcMobile';
import RotaEnergiaMobile from './components/RotaEnergiaMobile';
import RotaEnergia from './components/RotaEnergia';
import RotaFreelancersAprovacao from './components/RotaFreelancersAprovacao';
import UsuariosPage from './pages/UsuariosPage';
import ConfiguracoesPage from './pages/configuracoes/ConfiguracoesPage';
import ConfiguracoesLayout from './layout/ConfiguracoesLayout';
import FrotaLayout from './layout/FrotaLayout';
import CategoriasPage from './pages/configuracoes/CategoriasPage';
import SlaPage from './pages/configuracoes/SlaPage';
import CargosPage from './pages/configuracoes/CargosPage';
import ChecklistPerguntasPage from './pages/configuracoes/ChecklistPerguntasPage';
import WhatsAppPage from './pages/configuracoes/WhatsAppPage';
import NotificacoesPage from './pages/configuracoes/NotificacoesPage';
import AuditoriaPage from './pages/configuracoes/AuditoriaPage';
import EstoqueSyncNfPage from './pages/configuracoes/EstoqueSyncNfPage';
import ConfiguracaoContagemPage from './pages/configuracoes/ConfiguracaoContagemPage';
import RotaAuditoria from './components/RotaAuditoria';
import RotaConfiguracoes from './components/RotaConfiguracoes';
import RotaPermissao from './components/RotaPermissao';
import RotaChecklist from './components/RotaChecklist';
import RotaVisitasMobile from './components/RotaVisitasMobile';
import RotaFrota from './components/RotaFrota';
import RotaMapaTecnicos from './components/RotaMapaTecnicos';
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
                  <ChecklistMobilePage />
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
              path="frota/mobile/manutencao"
              element={
                <RotaFrota>
                  <FrotaManutencaoMobilePage />
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
            <Route
              path="mapa/mobile"
              element={
                <RotaMapaTecnicos>
                  <MapaTecnicosMobilePage />
                </RotaMapaTecnicos>
              }
            />
            <Route
              path="visitas/mobile"
              element={
                <RotaVisitasMobile>
                  <VisitasMobilePage />
                </RotaVisitasMobile>
              }
            />
            <Route
              path="escalas/visitas/mobile"
              element={
                <RotaPermissao permissoes={['escalas.visitas.ver', 'escalas.visitas.gerenciar', 'escalas.visitas.editar_regiao', 'escalas.visitas.editar_delivery']}>
                  <EscalaVisitasMobilePage />
                </RotaPermissao>
              }
            />
            <Route
              path="nc/mobile/:idNc"
              element={
                <RotaNcMobile>
                  <NcMobileResolverPage />
                </RotaNcMobile>
              }
            />
            <Route
              path="nc/mobile"
              element={
                <RotaNcMobile>
                  <NcMobileListaPage />
                </RotaNcMobile>
              }
            />
            <Route
              path="energia/mobile/novo"
              element={
                <RotaEnergiaMobile>
                  <EnergiaMobileNovoPage />
                </RotaEnergiaMobile>
              }
            />
            <Route
              path="energia/mobile/:idChamado"
              element={
                <RotaEnergiaMobile>
                  <EnergiaMobileDetalhePage />
                </RotaEnergiaMobile>
              }
            />
            <Route
              path="energia/mobile"
              element={
                <RotaEnergiaMobile>
                  <EnergiaMobileListaPage />
                </RotaEnergiaMobile>
              }
            />
            <Route
              path="estoque/mobile/break"
              element={
                <RotaEstoqueBreakMobile>
                  <EstoqueMobileBreakPage />
                </RotaEstoqueBreakMobile>
              }
            />
            <Route
              path="estoque/mobile/vendas"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileVendasPage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="estoque/mobile/saldo"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileSaldoPage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="estoque/mobile/nfes/:idNfe"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileNfePage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="estoque/mobile/nfes"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileNfePage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="estoque/mobile/:idContagem"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileConferenciaPage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="estoque/mobile"
              element={
                <RotaEstoqueMobile>
                  <EstoqueMobileListaPage />
                </RotaEstoqueMobile>
              }
            />
            <Route
              path="freelancers/aprovacao/mobile"
              element={
                <RotaFreelancersAprovacao>
                  <FreelancersAprovacaoMobilePage />
                </RotaFreelancersAprovacao>
              }
            />
            <Route path="portais/mobile" element={<PortaisPage />} />
            <Route path="relatorio/visita/:id" element={<RelatorioPage />} />
          </Route>
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <RotaPermissao permissoes={['portal.dashboard.ver']}>
                  <DashboardPage />
                </RotaPermissao>
              }
            />
            <Route
              path="frota"
              element={
                <RotaPermissao permissoes={['frota.gerenciar', 'frota.regioes']}>
                  <FrotaLayout />
                </RotaPermissao>
              }
            >
              <Route index element={<FrotaPortalIndexPage />} />
              <Route
                path="veiculos/:id"
                element={
                  <RotaPermissao permissoes={['frota.gerenciar']}>
                    <FrotaVeiculoDetalhePage />
                  </RotaPermissao>
                }
              />
              <Route path="operacao" element={<FrotaOperacaoLegacyRedirect />} />
              <Route
                path="operacao/:aba"
                element={
                  <RotaPermissao permissoes={['frota.gerenciar']}>
                    <FrotaOperacaoPage />
                  </RotaPermissao>
                }
              />
              <Route path="veiculos" element={<Navigate to="/frota/operacao/cadastro" replace />} />
              <Route
                path="acompanhamento"
                element={
                  <RotaPermissao permissoes={['frota.gerenciar']}>
                    <FrotaAcompanhamentoPage />
                  </RotaPermissao>
                }
              />
              <Route path="relatorio-km" element={<Navigate to="/frota/acompanhamento" replace />} />
              <Route path="relatorio-rotas" element={<Navigate to="/frota/acompanhamento" replace />} />
              <Route
                path="relatorio-velocidade"
                element={<Navigate to="/frota/acompanhamento" replace />}
              />
              <Route path="uso" element={<Navigate to="/frota/operacao/cadastro" replace />} />
              <Route
                path="combustivel"
                element={<Navigate to="/frota/operacao/combustivel" replace />}
              />
              <Route
                path="manutencoes"
                element={<Navigate to="/frota/operacao/manutencoes" replace />}
              />
              <Route path="multas" element={<Navigate to="/frota/operacao/multas" replace />} />
              <Route path="debitos" element={<Navigate to="/frota/operacao/debitos" replace />} />
              <Route
                path="termos"
                element={
                  <RotaPermissao permissoes={['frota.gerenciar']}>
                    <FrotaTermosPortalPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="regioes"
                element={
                  <RotaPermissao permissoes={['frota.gerenciar', 'frota.regioes']}>
                    <FrotaRegioesPortalPage />
                  </RotaPermissao>
                }
              />
            </Route>
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
            <Route path="portais" element={<PortaisPage />} />
            <Route
              path="escalas/visitas"
              element={
                <RotaPermissao permissoes={['escalas.visitas.ver', 'escalas.visitas.gerenciar', 'escalas.visitas.editar_regiao', 'escalas.visitas.editar_delivery']}>
                  <EscalaVisitasPage />
                </RotaPermissao>
              }
            />
            <Route
              path="metas"
              element={
                <RotaPermissao permissoes={['metas.ver', 'metas.gerenciar']}>
                  <MetasPage />
                </RotaPermissao>
              }
            />
            <Route
              path="estoque"
              element={<Navigate to="/estoque/conferencia" replace />}
            />
            <Route
              path="estoque/:aba"
              element={
                <RotaPermissao permissoes={['estoque.produtos', 'estoque.conferencia', 'estoque.operacional', 'estoque.break']}>
                  <ControleEstoquePage />
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
              path="energia/novo"
              element={
                <RotaEnergia>
                  <EnergiaNovoPage />
                </RotaEnergia>
              }
            />
            <Route
              path="energia/:idChamado"
              element={
                <RotaEnergia>
                  <EnergiaDetalhePage />
                </RotaEnergia>
              }
            />
            <Route
              path="energia"
              element={
                <RotaEnergia>
                  <EnergiaPage />
                </RotaEnergia>
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
                <RotaConfiguracoes>
                  <ConfiguracoesLayout />
                </RotaConfiguracoes>
              }
            >
              <Route index element={<ConfiguracoesPage />} />
              <Route
                path="perguntas"
                element={
                  <RotaPermissao permissoes={['configuracoes.perguntas', 'checklist.gerenciar']}>
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
                path="notificacoes"
                element={
                  <RotaPermissao permissoes={['configuracoes.notificacoes']}>
                    <NotificacoesPage />
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
              <Route
                path="estoque-sync-nf"
                element={
                  <RotaPermissao permissoes={['configuracoes.ver', 'estoque.operacional']}>
                    <EstoqueSyncNfPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="contagem"
                element={
                  <RotaPermissao permissoes={['estoque.produtos']}>
                    <ConfiguracaoContagemPage />
                  </RotaPermissao>
                }
              />
              <Route
                path="auditoria"
                element={
                  <RotaAuditoria>
                    <AuditoriaPage />
                  </RotaAuditoria>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
