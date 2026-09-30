import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import NotificacoesSino from '../NotificacoesSino';
import AppHubDock from '../hub/AppHubDock';
import FrotaPlusSheet from './FrotaPlusSheet';
import '../estoque/estoque-hub.css';
import './frota-mobile.css';

export type FrotaMetric = {
  value: ReactNode;
  label: string;
  accent?: boolean;
  /** Destaque verde (ex.: status Em uso). */
  ok?: boolean;
};

type Props = {
  titleLine1: string;
  titleLine2?: string;
  sub?: string;
  metrics?: FrotaMetric[];
  onBack?: () => void;
  children: ReactNode;
  variant?: 'hub' | 'page';
  extraStage?: ReactNode;
  plusLabel?: string;
  plusDisabled?: boolean;
  onPlus?: () => void;
  /** Se false, desabilita combustível/manutenção no sheet do +. */
  temVeiculo?: boolean;
};

/** Casca da Frota mobile — mesmo tema do hub estoque/checklist. */
export default function FrotaMobileShell({
  titleLine1,
  titleLine2,
  sub,
  metrics,
  onBack,
  children,
  variant = 'page',
  extraStage,
  plusLabel = 'Operações',
  plusDisabled,
  onPlus,
  temVeiculo = true,
}: Props) {
  const navigate = useNavigate();
  const user = getUsuario();
  const [plusAberto, setPlusAberto] = useState(false);
  const titulo = titleLine2 ? `${titleLine1} ${titleLine2}` : titleLine1;

  return (
    <div
      className={`ck-estoque-hub ck-estoque-hub--hero ck-frota-hub${
        variant === 'page' ? ' ck-frota-hub--page' : ''
      }`}
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
            {onBack ? (
              <button
                type="button"
                className="ck-estoque-hub__icon-btn ck-frota-hub__btn-voltar-topo"
                aria-label="Voltar"
                onClick={onBack}
              >
                <ArrowBackIcon />
              </button>
            ) : null}
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

        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>{titulo}</h1>
          </div>
          {sub ? <p className="ck-frota-hub__sub">{sub}</p> : null}
        </div>

        {metrics && metrics.length > 0 ? (
          <div className="ck-frota-hub__kpis ck-frota-hub__kpis--in-header" aria-live="polite">
            {metrics.map((m) => (
              <div
                key={m.label}
                className={`ck-frota-hub__kpi${m.accent ? ' is-on' : ''}${m.ok ? ' is-ok' : ''}`}
              >
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {extraStage}
      </header>

      <div
        className={`ck-estoque-hub__scroll ck-frota-hub__scroll${
          variant === 'page' ? ' ck-frota-hub__scroll--page' : ''
        }`}
      >
        {children}
      </div>

      <AppHubDock
        ativo={null}
        plusLabel={plusLabel}
        plusDisabled={plusDisabled}
        onPlus={onPlus ?? (() => setPlusAberto(true))}
      />

      {!onPlus ? (
        <FrotaPlusSheet
          open={plusAberto}
          onClose={() => setPlusAberto(false)}
          temVeiculo={temVeiculo}
        />
      ) : null}
    </div>
  );
}
