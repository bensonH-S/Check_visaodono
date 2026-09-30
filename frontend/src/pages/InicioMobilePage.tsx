import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP, toAppPath } from '../config/paths';
import { APP_NAME } from '../config/brand';
import { dataHojeBrasilia } from '../utils/dateBr';
import MobileUsuarioMenu from '../components/MobileUsuarioMenu';
import NotificacoesSino from '../components/NotificacoesSino';
import AppHubDock from '../components/hub/AppHubDock';
import '../components/estoque/estoque-hub.css';
import '../components/checklist/checklist-hub.css';

function primeiroNome(nome?: string | null) {
  const p = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  return p || 'time';
}

function saudacao() {
  const h = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dataExtensoHoje() {
  const iso = dataHojeBrasilia();
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function InicioMobilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUsuario();
  const nome = primeiroNome(user?.nome);
  const dataLabel = dataExtensoHoje();

  useEffect(() => {
    if (toAppPath(location.pathname) !== '/inicio/mobile') return;
    document.title = `Início | ${APP_NAME}`;
  }, [location.pathname]);

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-checklist-hub ck-inicio-hub"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
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
      </header>

      <div className="ck-estoque-hub__scroll ck-inicio-hub__scroll ck-inicio-hub__welcome">
        <div className="ck-inicio-hub__welcome-copy">
          <p className="ck-inicio-hub__welcome-hello">
            {saudacao()}, {nome}
          </p>
          <h1 className="ck-inicio-hub__welcome-title">Bem-vindo</h1>
          <p className="ck-inicio-hub__welcome-date">{dataLabel}</p>
          <p className="ck-inicio-hub__welcome-sub">
            Use as abas abaixo para acessar os módulos do app.
          </p>
        </div>
      </div>

      <AppHubDock ativo="inicio" plusLabel="Sem ação nesta tela" plusDisabled onPlus={() => {}} />
    </div>
  );
}
