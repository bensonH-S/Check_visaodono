import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtData, fmtNota, scoreColorTema, type Loja, type TipoChecklist, type Usuario, type MetaVisitaTimeCampo, type VisitaResumo } from '../../api/client';
import type { ChecklistSessaoLocal } from '../../utils/checklistSessao';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, CHECKLIST_FUNDO_BK, LOGO_GA_LOCKUP } from '../../config/paths';
import { nomeLojaCurta } from '../estoque/estoqueHub';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import NotificacoesSino from '../NotificacoesSino';
import TimeCampoMetaForm from './TimeCampoMetaForm';
import ChecklistIonicShell from './ChecklistIonicShell';
import ChecklistPickSheet from './ChecklistPickSheet';
import AppHubDock from '../hub/AppHubDock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  useEffect(() => {
    let vivo = true;
    api
      .visitas(idLoja ? { loja: Number(idLoja) } : undefined)
      .then((lista) => {
        if (vivo) setVisitas(lista.slice(0, 8));
      })
      .catch(() => {
        if (vivo) setVisitas([]);
      });
    return () => {
      vivo = false;
    };
  }, [idLoja]);

  function abrirVisita(v: VisitaResumo) {
    if (v.status === 'Rascunho') {
      navigate(`/checklist/mobile?visita=${v.id_visita}`);
      return;
    }
    navigate(`/relatorio/mobile/visita/${v.id_visita}`);
  }

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

            <section className="ck-checklist-hub__recente" aria-label="Visitas">
              <div className="ck-checklist-hub__recente-head">
                <h2>Visitas</h2>
                <span>{visitas.length ? visitas.length : ''}</span>
              </div>
              {visitas.length ? (
                visitas.map((v) => {
                  const aberta = v.status === 'Rascunho';
                  const titulo = idLoja
                    ? v.tipo_checklist_nome || 'Checklist'
                    : nomeLojaCurta(v.name, v.bk_number);
                  const meta = idLoja
                    ? `${fmtData(v.data_visita)}${v.nome_usuario ? ` · ${v.nome_usuario}` : ''}`
                    : `${fmtData(v.data_visita)} · ${v.tipo_checklist_nome || 'Checklist'}`;
                  const nota = v.nota_final == null ? null : Number(v.nota_final);
                  return (
                    <button
                      key={v.id_visita}
                      type="button"
                      className="ck-checklist-hub__visita"
                      onClick={() => abrirVisita(v)}
                    >
                      <span className="ck-checklist-hub__visita-copy">
                        <strong>{titulo}</strong>
                        <small>{meta}</small>
                      </span>
                      {aberta ? (
                        <span className="ck-checklist-hub__visita-side is-open">Aberta</span>
                      ) : (
                        <span
                          className="ck-checklist-hub__visita-side"
                          style={nota != null ? { color: scoreColorTema(nota, true) } : undefined}
                        >
                          {fmtNota(nota)}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="ck-checklist-hub__recente-empty">Nenhuma visita ainda. O + começa uma.</p>
              )}
            </section>
          </div>
        </div>

        <AppHubDock
          ativo="checklist"
          plusLabel="Iniciar visita"
          plusDisabled={saving || carregandoTipo || !podeIniciar}
          onPlus={onIniciar}
        />
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
