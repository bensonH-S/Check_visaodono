import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import ChamadoDetalheConteudo from '../../components/manutencao/ChamadoDetalheConteudo';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import type { ManutChamadoDetalhe } from '../../api/client';
import { STATUS_CHAMADO } from '../../utils/manutencaoUi';
import '../../components/visitas/visitas-mobile.css';
import '../../components/manutencao/chamados-mobile.css';

const ORANGE = '#E8520A';
const ROTA_LISTA = '/chamados/mobile';

type ResumoChamado = Pick<
  ManutChamadoDetalhe,
  'numero' | 'titulo' | 'status' | 'urgencia' | 'loja'
>;

export default function ChamadosMobileDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const id = Number(idChamado);
  const [resumo, setResumo] = useState<ResumoChamado | null>(null);
  const [falhou, setFalhou] = useState(false);

  const onDetalheCarregado = useCallback((d: ManutChamadoDetalhe) => {
    setFalhou(false);
    setResumo({
      numero: d.numero,
      titulo: d.titulo,
      status: d.status,
      urgencia: d.urgencia,
      loja: d.loja,
    });
  }, []);

  const onFalhaCarregar = useCallback(() => setFalhou(true), []);

  useEffect(() => {
    setResumo(null);
    setFalhou(false);
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      navigate(ROTA_LISTA, { replace: true });
    }
  }, [id, navigate]);

  if (!Number.isFinite(id)) return null;

  const statusLabel = resumo
    ? STATUS_CHAMADO[resumo.status]?.label ?? resumo.status
    : '—';

  return (
    <div className="ck-visitas ck-chamados ck-chamados--page">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-chamados__title">
                {resumo?.numero != null ? `Chamado #${resumo.numero}` : 'Chamado'}
              </h1>
            </div>
            <div className="ck-chamados__hero-end">
              <button
                type="button"
                className="ck-visitas__back"
                aria-label="Voltar"
                onClick={() => navigate(ROTA_LISTA)}
              >
                ←
              </button>
              <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
            </div>
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            {resumo?.titulo?.trim() || 'Detalhe do chamado e histórico.'}
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong style={{ fontSize: '0.95rem' }}>{statusLabel}</strong>
              <span>status</span>
            </div>
            <div className="ck-visitas__metric">
              <strong style={{ fontSize: '0.95rem' }}>
                {resumo?.loja?.trim() || '—'}
              </strong>
              <span>loja</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-chamados__sheet--fill ck-visitas__anim ck-visitas__anim--4">
        {!resumo && !falhou ? (
          <div className="ck-visitas__loading">
            <CircularProgress size={28} sx={{ color: ORANGE }} />
          </div>
        ) : null}
        <ChamadoDetalheConteudo
          idChamado={id}
          variante="mobile"
          immersive
          permitirEncerrar={false}
          onDetalheCarregado={onDetalheCarregado}
          onFalhaCarregar={onFalhaCarregar}
        />
      </div>
    </div>
  );
}
