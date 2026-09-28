import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../lib/auth';
import { assetUrl, LOGO_GA_LOCKUP, toAppPath } from '../config/paths';
import { APP_NAME } from '../config/brand';
import MobileUsuarioMenu from '../components/MobileUsuarioMenu';
import NotificacoesSino from '../components/NotificacoesSino';
import AppHubDock from '../components/hub/AppHubDock';
import '../components/estoque/estoque-hub.css';
import '../components/checklist/checklist-hub.css';

export default function InicioMobilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUsuario();
  useEffect(() => {
    if (toAppPath(location.pathname) !== '/inicio/mobile') return;
    document.title = `Início | ${APP_NAME}`;
  }, [location.pathname]);

  return (
    <div className="ck-estoque-hub ck-checklist-hub">
      <div className="ck-estoque-hub__scroll">
        <header className="ck-estoque-hub__top">
          <div className="ck-estoque-hub__brand-row">
            <img className="ck-estoque-hub__mark" src={assetUrl(LOGO_GA_LOCKUP)} alt="Grupo Alvim" />
            <div className="ck-estoque-hub__actions">
              <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
              <MobileUsuarioMenu
                user={user}
                onLogout={() => {
                  logout();
                  navigate('/login/mobile');
                }}
              />
            </div>
          </div>
          <div className="ck-estoque-hub__store-row">
            <h1>Início</h1>
          </div>
        </header>
        <div className="ck-inicio-hub__soon">
          <p>Em construção</p>
          <small>Aqui entram as informações do dia.</small>
        </div>
      </div>
      <AppHubDock ativo="inicio" plusLabel="Iniciar visita" onPlus={() => navigate('/checklist/mobile')} />
    </div>
  );
}
