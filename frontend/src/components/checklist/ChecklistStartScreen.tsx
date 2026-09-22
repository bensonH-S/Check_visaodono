import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Loja, TipoChecklist, Usuario, MetaVisitaTimeCampo } from '../../api/client';
import type { ChecklistSessaoLocal } from '../../utils/checklistSessao';
import { getUsuario, logout, primeiraRotaMobileApp } from '../../lib/auth';
import { assetUrl, CHECKLIST_FUNDO_BK, LOGO_GA_LOCKUP } from '../../config/paths';
import { nomeLojaCurta } from '../estoque/estoqueHub';
import { useMobileMais } from '../MobileTabBar';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import NotificacoesSino from '../NotificacoesSino';
import TimeCampoMetaForm from './TimeCampoMetaForm';
import ChecklistIonicShell from './ChecklistIonicShell';
import ChecklistPickSheet from './ChecklistPickSheet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import '../estoque/estoque-hub.css';
import './checklist-hub.css';

type Props = {
  msg: string;
  onClearMsg: () => void;
  sessaoLocal: ChecklistSessaoLocal | null;
  onContinuar: () => void;
  onEsquecer: () => void;
  saving: boolean;
  retomando: boolean;
  totalPerguntas: number;
  totalSecoes: number;
  carregandoTipo: boolean;
  auditores: Usuario[];
  idAuditor: number | '';
  nomeAuditorFallback: string;
  onSelecionarAuditor: (id: number) => void;
  lojas: Loja[];
  idLoja: number | '';
  onSelecionarLoja: (id: number) => void;
  tiposChecklist: TipoChecklist[];
  tipoCodigo: string;
  onSelecionarTipo: (codigo: string) => void;
  metaVisita: MetaVisitaTimeCampo;
  onMetaChange: (patch: Partial<MetaVisitaTimeCampo>) => void;
  podeIniciar: boolean;
  onIniciar: () => void;
};

function monogramaTipo(codigo: string, nome: string) {
  if (codigo.includes('time')) return 'TC';
  if (codigo.includes('visao') || codigo.includes('dono')) return 'VD';
  if (codigo.includes('oper')) return 'OP';
  const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return (letras.slice(0, 2) || 'CK').toUpperCase();
}

export default function ChecklistStartScreen(props: Props) {
  const {
    msg,
    onClearMsg,
    sessaoLocal,
    onContinuar,
    onEsquecer,
    saving,
    retomando,
    totalPerguntas,
    totalSecoes,
    carregandoTipo,
    lojas,
    idLoja,
    onSelecionarLoja,
    tiposChecklist,
    tipoCodigo,
    onSelecionarTipo,
    metaVisita,
    onMetaChange,
    podeIniciar,
    onIniciar,
  } = props;

  const navigate = useNavigate();
  const { openMais } = useMobileMais();
  const user = getUsuario();
  const [pickLoja, setPickLoja] = useState(false);
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja);
  const podeTrocarLoja = lojas.length > 1;
  const rotuloLoja = lojaAtual
    ? nomeLojaCurta(lojaAtual.name, lojaAtual.bk_number)
    : 'Selecionar loja';

  const lojaOptions = useMemo(
    () =>
      lojas.map((l) => ({
        id: l.id_loja,
        label: l.name,
        meta: l.bk_number ? `BKN ${l.bk_number}` : undefined,
      })),
    [lojas],
  );

  return (
    <ChecklistIonicShell scrollY={false}>
      <div
        className="ck-estoque-hub ck-checklist-hub ck-checklist-hub--hero"
        style={{ ['--ck-hero' as string]: `url(${assetUrl(CHECKLIST_FUNDO_BK)})` }}
      >
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
              <h1>Checklist</h1>
              <div className="ck-estoque-hub__loja-drop">
                <button
                  type="button"
                  className="ck-estoque-hub__store"
                  disabled={!podeTrocarLoja}
                  onClick={() => podeTrocarLoja && setPickLoja(true)}
                >
                  <span className="ck-estoque-hub__store-name">{rotuloLoja}</span>
                  {podeTrocarLoja ? <ExpandMoreIcon sx={{ fontSize: 18, color: '#8d8d8d' }} /> : null}
                </button>
              </div>
            </div>
          </header>

          <div className="ck-checklist-hub__body">
            {msg ? (
              <div className="ck-checklist-hub__banner ck-checklist-hub__banner--err" role="alert">
                <p>{msg}</p>
                <button type="button" onClick={onClearMsg}>
                  Fechar
                </button>
              </div>
            ) : null}

            {sessaoLocal ? (
              <div className="ck-checklist-hub__banner ck-checklist-hub__banner--warn">
                <div>
                  <strong>Visita pausada</strong>
                  <p>Protocolo #{sessaoLocal.visitaId}</p>
                </div>
                <div className="ck-checklist-hub__banner-actions">
                  <button type="button" disabled={saving || retomando} onClick={onContinuar}>
                    Continuar
                  </button>
                  <button type="button" disabled={saving || retomando} onClick={onEsquecer}>
                    Esquecer
                  </button>
                </div>
              </div>
            ) : null}

            <div role="listbox" aria-label="Tipo de checklist">
              {tiposChecklist.map((t) => {
                const on = tipoCodigo === t.codigo;
                return (
                  <button
                    key={t.codigo}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ck-checklist-hub__tipo${on ? ' is-on' : ''}`}
                    onClick={() => onSelecionarTipo(t.codigo)}
                  >
                    <span className="ck-checklist-hub__tipo-mono">{monogramaTipo(t.codigo, t.nome)}</span>
                    <span className="ck-checklist-hub__tipo-copy">
                      <strong>{t.nome}</strong>
                      {on && !carregandoTipo ? (
                        <small>
                          {totalPerguntas} perguntas · {totalSecoes} seções
                        </small>
                      ) : null}
                    </span>
                    <span className="ck-checklist-hub__tipo-check">{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>

            {tipoCodigo === 'time_de_campo' ? (
              <div className="ck-checklist-hub__meta">
                <p className="ck-checklist-hub__sec">Time de campo</p>
                <TimeCampoMetaForm value={metaVisita} onChange={onMetaChange} />
              </div>
            ) : null}
          </div>
        </div>

        <nav className="ck-estoque-hub__dock" aria-label="Checklist">
          <button
            type="button"
            onClick={() => {
              const dest = user ? primeiraRotaMobileApp(user) : '/visitas/mobile';
              navigate(dest.startsWith('/checklist') ? '/visitas/mobile' : dest);
            }}
          >
            <HomeOutlinedIcon />
            Início
          </button>
          <button type="button" className="is-on">
            <AssignmentOutlinedIcon />
            Checklist
          </button>
          <button
            type="button"
            className="ck-estoque-hub__dock-plus"
            aria-label="Iniciar visita"
            disabled={saving || carregandoTipo || !podeIniciar}
            onClick={onIniciar}
          >
            <AddIcon />
          </button>
          <button type="button" onClick={() => navigate('/visitas/mobile')}>
            <HistoryOutlinedIcon />
            Visitas
          </button>
          <button type="button" aria-label="Mais módulos" onClick={openMais}>
            <MoreHorizIcon />
            Mais
          </button>
        </nav>
      </div>

      <ChecklistPickSheet
        open={pickLoja}
        title="Escolher loja"
        options={lojaOptions}
        selectedId={idLoja === '' ? null : idLoja}
        onSelect={(id) => onSelecionarLoja(Number(id))}
        onClose={() => setPickLoja(false)}
      />
    </ChecklistIonicShell>
  );
}
