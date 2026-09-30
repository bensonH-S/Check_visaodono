import { Link, useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { fmtData, fmtNota } from '../../api/client';
import type { VisitaResumo } from '../../api/client';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import NotificacoesSino from '../NotificacoesSino';
import AppHubDock from '../hub/AppHubDock';
import '../estoque/estoque-hub.css';
import './visitas-mobile.css';

type Filtro = '' | 'Rascunho' | 'Finalizada';

type Props = {
  visitas: VisitaResumo[];
  visitasFiltradas: VisitaResumo[];
  filtroStatus: Filtro;
  onFiltro: (f: Filtro) => void;
  checklistBase: string;
  podeApagar: boolean;
  onApagar: (v: VisitaResumo) => void;
  podeReabrir?: boolean;
  onReabrir?: (v: VisitaResumo) => void;
  enviandoEmailId?: number | null;
  onEnviarEmail?: (v: VisitaResumo) => void;
  loading?: boolean;
};

function codigoTipo(v: VisitaResumo): string {
  return v.tipo_checklist_codigo || 'auditoria_operacional';
}

function monoTipo(nome?: string | null) {
  if (!nome) return 'CK';
  if (/time/i.test(nome)) return 'TC';
  if (/vis[aã]o|dono/i.test(nome)) return 'VD';
  if (/oper/i.test(nome)) return 'OP';
  const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return (letras.slice(0, 2) || 'CK').toUpperCase();
}

export default function VisitasMobileScreen({
  visitas,
  visitasFiltradas,
  filtroStatus,
  onFiltro,
  checklistBase,
  podeApagar,
  onApagar,
  podeReabrir,
  onReabrir,
  enviandoEmailId,
  onEnviarEmail,
  loading,
}: Props) {
  const navigate = useNavigate();
  const user = getUsuario();
  const baseContagem = visitas;
  const finalizadas = baseContagem.filter((v) => v.status === 'Finalizada').length;
  const rascunhos = baseContagem.filter((v) => v.status === 'Rascunho').length;

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-visitas-hub ck-visitas-hub--lista"
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
          <div className="ck-estoque-hub__actions ck-visitas-hub__actions">
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
            <h1>Visitas</h1>
          </div>
        </div>
      </header>

      <div className="ck-estoque-hub__panel ck-visitas-hub__panel--lista">
        <div className="ck-visitas-hub__kpis ck-visitas-hub__kpis--3" aria-live="polite">
          <div className="ck-visitas-hub__kpi is-nota">
            <strong>{finalizadas}</strong>
            <span>Finalizadas</span>
          </div>
          <div className={`ck-visitas-hub__kpi${rascunhos ? ' is-alerta' : ''}`}>
            <strong>{rascunhos}</strong>
            <span>Rascunhos</span>
          </div>
          <div className="ck-visitas-hub__kpi">
            <strong>{baseContagem.length}</strong>
            <span>Total</span>
          </div>
        </div>

        <div className="ck-visitas-hub__seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === ''}
            className={`ck-visitas-hub__seg-btn${filtroStatus === '' ? ' is-on' : ''}`}
            onClick={() => onFiltro('')}
          >
            Todas
            <em>{baseContagem.length}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === 'Finalizada'}
            className={`ck-visitas-hub__seg-btn${filtroStatus === 'Finalizada' ? ' is-on' : ''}`}
            onClick={() => onFiltro(filtroStatus === 'Finalizada' ? '' : 'Finalizada')}
          >
            Finalizadas
            <em>{finalizadas}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === 'Rascunho'}
            className={`ck-visitas-hub__seg-btn${filtroStatus === 'Rascunho' ? ' is-on' : ''}`}
            onClick={() => onFiltro(filtroStatus === 'Rascunho' ? '' : 'Rascunho')}
          >
            Rascunhos
            <em>{rascunhos}</em>
          </button>
        </div>
      </div>

      <div className="ck-estoque-hub__scroll ck-visitas-hub__scroll">
        {loading ? (
          <LinearProgress
            sx={{
              mb: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : null}

        <h2 className="ck-visitas-hub__sec-title">Histórico</h2>

        {loading && !visitas.length ? null : !visitas.length ? (
          <div className="ck-visitas-hub__empty">
            Nenhuma visita registrada ainda.
            <Link className="ck-visitas-hub__cta" to="/checklist/mobile">
              Iniciar checklist
            </Link>
          </div>
        ) : !visitasFiltradas.length ? (
          <div className="ck-visitas-hub__empty">Nenhuma visita com este filtro.</div>
        ) : (
          <div className="ck-visitas-hub__cards">
            {visitasFiltradas.map((v) => {
              const emRascunho = v.status === 'Rascunho';
              const destino = emRascunho
                ? `${checklistBase}?visita=${v.id_visita}`
                : `/relatorio/mobile/visita/${v.id_visita}`;
              return (
                <div key={v.id_visita} className="ck-visitas-hub__card-wrap">
                  <Link
                    to={destino}
                    state={emRascunho ? undefined : { from: '/visitas/mobile' }}
                    className={`ck-visitas-hub__row${emRascunho ? ' is-draft' : ''}`}
                  >
                    <span className="ck-visitas-hub__mono" aria-hidden>
                      {monoTipo(v.tipo_checklist_nome)}
                    </span>
                    <span className="ck-visitas-hub__copy">
                      <strong>{v.name}</strong>
                      <small>
                        {fmtData(v.data_visita)}
                        {v.bk_number ? ` · ${v.bk_number}` : ''}
                        {' · '}
                        {v.tipo_checklist_nome ?? 'Checklist'}
                      </small>
                    </span>
                    <span className="ck-visitas-hub__side">
                      <span className={`ck-visitas-hub__chip ${emRascunho ? 'is-warn' : 'is-ok'}`}>
                        {emRascunho ? 'Rasc.' : 'OK'}
                      </span>
                      {v.nota_final != null ? (
                        <span className="ck-visitas-hub__chip is-muted">{fmtNota(Number(v.nota_final))}</span>
                      ) : null}
                    </span>
                  </Link>
                  {onEnviarEmail && !emRascunho && codigoTipo(v) === 'auditoria_operacional' ? (
                    <button
                      type="button"
                      className="ck-visitas-hub__action is-email"
                      aria-label="Enviar relatório por e-mail"
                      title="Enviar e-mail"
                      disabled={enviandoEmailId === v.id_visita}
                      onClick={() => onEnviarEmail(v)}
                    >
                      <EmailOutlinedIcon fontSize="small" />
                    </button>
                  ) : null}
                  {podeReabrir && !emRascunho && onReabrir ? (
                    <button
                      type="button"
                      className="ck-visitas-hub__action is-unlock"
                      aria-label="Reabrir visita"
                      title="Reabrir"
                      onClick={() => onReabrir(v)}
                    >
                      <LockOpenIcon fontSize="small" />
                    </button>
                  ) : null}
                  {podeApagar ? (
                    <button
                      type="button"
                      className="ck-visitas-hub__action is-delete"
                      aria-label="Apagar relatório"
                      onClick={() => onApagar(v)}
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AppHubDock ativo={null} plusLabel="Sem ação nesta tela" plusDisabled onPlus={() => {}} />
    </div>
  );
}
