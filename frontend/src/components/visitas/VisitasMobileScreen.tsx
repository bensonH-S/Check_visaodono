import { Link } from 'react-router-dom';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { fmtData, fmtNota } from '../../api/client';
import type { VisitaResumo } from '../../api/client';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import './visitas-mobile.css';

type Filtro = '' | 'Rascunho' | 'Finalizada';
type Ordenacao = 'data_desc' | 'nota_desc';

type Props = {
  visitas: VisitaResumo[];
  visitasFiltradas: VisitaResumo[];
  filtroStatus: Filtro;
  onFiltro: (f: Filtro) => void;
  pessoas: Array<{ id: number; nome: string }>;
  filtroUsuario: number | '';
  onFiltroUsuario: (id: number | '') => void;
  tiposChecklist: Array<{ codigo: string; nome: string }>;
  filtroTipo: string;
  onFiltroTipo: (codigo: string) => void;
  ordenacao: Ordenacao;
  onOrdenacao: (o: Ordenacao) => void;
  onGerarRelatorio: () => void;
  gerandoPdf?: boolean;
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
  pessoas,
  filtroUsuario,
  onFiltroUsuario,
  tiposChecklist,
  filtroTipo,
  onFiltroTipo,
  ordenacao,
  onOrdenacao,
  onGerarRelatorio,
  gerandoPdf,
  checklistBase,
  podeApagar,
  onApagar,
  podeReabrir,
  onReabrir,
  enviandoEmailId,
  onEnviarEmail,
}: Props) {
  const baseContagem = visitas.filter((v) => {
    if (filtroUsuario !== '' && v.id_usuario !== filtroUsuario) return false;
    if (filtroTipo && codigoTipo(v) !== filtroTipo) return false;
    return true;
  });
  const finalizadas = baseContagem.filter((v) => v.status === 'Finalizada').length;
  const rascunhos = baseContagem.filter((v) => v.status === 'Rascunho').length;

  return (
    <div className="ck-visitas ck-visitas--lista">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-visitas__title--oneline">Suas visitas</h1>
            </div>
            <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Separe por checklist (Auditoria ou Time de Campo), ordene por nota e gere o PDF.
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric">
              <strong>{finalizadas}</strong>
              <span>finalizadas</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{rascunhos}</strong>
              <span>rascunhos</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{baseContagem.length}</strong>
              <span>total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-visitas__filters" style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#64748B' }}>
            Pessoa
            <select
              value={filtroUsuario === '' ? '' : String(filtroUsuario)}
              onChange={(e) => {
                const v = e.target.value;
                onFiltroUsuario(v === '' ? '' : Number(v));
                if (v !== '') onOrdenacao('nota_desc');
              }}
              style={{
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                padding: '10px 12px',
                fontSize: 14,
                background: '#fff',
                color: '#0F1A45',
              }}
            >
              <option value="">Todas as pessoas</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#64748B' }}>
            Checklist
            <select
              value={filtroTipo}
              onChange={(e) => onFiltroTipo(e.target.value)}
              style={{
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                padding: '10px 12px',
                fontSize: 14,
                background: '#fff',
                color: '#0F1A45',
              }}
            >
              <option value="">Todos os checklists</option>
              {tiposChecklist.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#64748B' }}>
            Ordenar
            <select
              value={ordenacao}
              onChange={(e) => onOrdenacao(e.target.value as Ordenacao)}
              style={{
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                padding: '10px 12px',
                fontSize: 14,
                background: '#fff',
                color: '#0F1A45',
              }}
            >
              <option value="data_desc">Data (mais recente)</option>
              <option value="nota_desc">Nota (maior → menor)</option>
            </select>
          </label>

          <button
            type="button"
            className="ck-visitas__cta"
            disabled={filtroUsuario === '' || !filtroTipo || gerandoPdf}
            onClick={onGerarRelatorio}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: filtroUsuario === '' || !filtroTipo || gerandoPdf ? 0.55 : 1,
            }}
          >
            <PictureAsPdfIcon sx={{ fontSize: 18 }} />
            {gerandoPdf ? 'Gerando PDF…' : 'Relatório PDF (por checklist)'}
          </button>
        </div>

        <div className="ck-visitas__seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === ''}
            className={`ck-visitas__seg-btn${filtroStatus === '' ? ' is-on' : ''}`}
            onClick={() => onFiltro('')}
          >
            Todas · {baseContagem.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === 'Finalizada'}
            className={`ck-visitas__seg-btn${filtroStatus === 'Finalizada' ? ' is-on' : ''}`}
            onClick={() => onFiltro(filtroStatus === 'Finalizada' ? '' : 'Finalizada')}
          >
            Finalizadas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtroStatus === 'Rascunho'}
            className={`ck-visitas__seg-btn${filtroStatus === 'Rascunho' ? ' is-on' : ''}`}
            onClick={() => onFiltro(filtroStatus === 'Rascunho' ? '' : 'Rascunho')}
          >
            Rascunhos
          </button>
        </div>

        <div className="ck-visitas__sheet-body">
          <p className="ck-visitas__section">Histórico</p>

          {!visitas.length ? (
            <div className="ck-visitas__empty">
              Nenhuma visita registrada ainda.
              <Link className="ck-visitas__cta" to="/checklist/mobile">
                Iniciar checklist
              </Link>
            </div>
          ) : !visitasFiltradas.length ? (
            <div className="ck-visitas__empty">Nenhuma visita com este filtro.</div>
          ) : (
            <div className="ck-visitas__list">
              {visitasFiltradas.map((v) => {
                const emRascunho = v.status === 'Rascunho';
                const destino = emRascunho
                  ? `${checklistBase}?visita=${v.id_visita}`
                  : `/relatorio/visita/${v.id_visita}`;
                return (
                  <div key={v.id_visita} className="ck-visitas__card-wrap">
                    <Link
                      to={destino}
                      className={`ck-visitas__card${emRascunho ? ' is-draft' : ' is-done'}`}
                    >
                      <span className="ck-visitas__mono" aria-hidden>
                        {monoTipo(v.tipo_checklist_nome)}
                      </span>
                      <span className="ck-visitas__copy">
                        <strong>{v.name}</strong>
                        <small>
                          {fmtData(v.data_visita)}
                          {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
                          {' · '}
                          {v.nome_usuario}
                          {' · '}
                          {v.tipo_checklist_nome ?? 'Checklist'}
                        </small>
                      </span>
                      <span className="ck-visitas__side">
                        <span className={`ck-visitas__chip ${emRascunho ? 'ck-visitas__chip--warn' : 'ck-visitas__chip--ok'}`}>
                          {emRascunho ? 'Rascunho' : 'Finalizada'}
                        </span>
                        {v.nota_final != null && (
                          <span className="ck-visitas__chip ck-visitas__chip--navy">
                            {fmtNota(Number(v.nota_final))}
                          </span>
                        )}
                      </span>
                    </Link>
                    {onEnviarEmail &&
                      !emRascunho &&
                      codigoTipo(v) === 'auditoria_operacional' && (
                        <button
                          type="button"
                          className="ck-visitas__del"
                          aria-label="Enviar relatório por e-mail"
                          title="Enviar e-mail"
                          disabled={enviandoEmailId === v.id_visita}
                          onClick={() => onEnviarEmail(v)}
                          style={{ color: '#E8520A' }}
                        >
                          <EmailOutlinedIcon fontSize="small" />
                        </button>
                      )}
                    {podeReabrir && !emRascunho && onReabrir && (
                      <button
                        type="button"
                        className="ck-visitas__del"
                        aria-label="Reabrir visita"
                        title="Reabrir"
                        onClick={() => onReabrir(v)}
                        style={{ color: '#0F1A45' }}
                      >
                        <LockOpenIcon fontSize="small" />
                      </button>
                    )}
                    {podeApagar && (
                      <button
                        type="button"
                        className="ck-visitas__del"
                        aria-label="Apagar relatório"
                        onClick={() => onApagar(v)}
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
