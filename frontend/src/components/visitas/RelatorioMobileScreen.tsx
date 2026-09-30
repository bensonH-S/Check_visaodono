import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import ShareIcon from '@mui/icons-material/Share';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fmtData, fmtNota, fetchMediaAutenticada } from '../../api/client';
import type { VisitaDetalhe } from '../../api/client';
import { formatarHoraVisita } from '../../utils/visitaFormat';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import ImageLightbox from '../ImageLightbox';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import AppHubDock from '../hub/AppHubDock';
import '../estoque/estoque-hub.css';
import './visitas-mobile.css';

type Props = {
  data: VisitaDetalhe;
  exportandoPdf: boolean;
  onExportarPdf: () => void;
  podeReabrir?: boolean;
  reabrindo?: boolean;
  onReabrir?: () => void;
};

function tituloChecklist(v: VisitaDetalhe['visita']): string {
  if (v.tipo_checklist_codigo === 'time_de_campo') return 'Time de Campo';
  if (v.tipo_checklist_nome) return v.tipo_checklist_nome;
  return 'Auditoria Operacional';
}

function formatarResposta(r: VisitaDetalhe['respostas'][0]): string {
  if (r.nota_estrelas != null) return `${r.nota_estrelas}★`;
  if (r.resposta) return r.resposta;
  return '—';
}

function chipClass(
  resposta: string | null | undefined,
  pergunta?: { texto?: string; sim_indica_problema?: boolean },
): string {
  const invertida = pergunta
    ? pergunta.sim_indica_problema === true ||
      (pergunta.sim_indica_problema !== false && /possui alguma obstru/i.test(pergunta.texto || ''))
    : false;
  if (invertida) {
    if (resposta === 'Não') return 'is-ok';
    if (resposta === 'Sim') return 'is-fail';
  }
  if (resposta === 'Sim') return 'is-ok';
  if (resposta === 'Não') return 'is-fail';
  return 'is-muted';
}

function barColor(pct: number): string {
  if (pct >= 80) return '#4ade80';
  if (pct >= 60) return '#ff9a5c';
  return '#94a3b8';
}

function RespostaCard({
  r,
  onAbrirFoto,
}: {
  r: VisitaDetalhe['respostas'][0];
  onAbrirFoto: (src: string, pergunta: string) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    const objectUrls: string[] = [];
    const carregar = async () => {
      const paths = r.midia_urls || [];
      const carregadas: string[] = [];
      for (const p of paths) {
        try {
          const url = await fetchMediaAutenticada(p);
          objectUrls.push(url);
          if (!cancelado) carregadas.push(url);
        } catch {
          /* ignore */
        }
      }
      if (!cancelado) setUrls(carregadas);
    };
    void carregar();
    return () => {
      cancelado = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [r.midia_urls]);

  return (
    <article className="ck-visitas-hub__card">
      <span className="ck-visitas-hub__mono" aria-hidden>
        {r.codigo?.slice(0, 2) || '·'}
      </span>
      <span className="ck-visitas-hub__copy">
        <strong>
          {r.codigo ? `${r.codigo}. ` : ''}
          {r.texto}
        </strong>
        {r.observacao?.trim() ? <small>{r.observacao.trim()}</small> : null}
        {urls.length > 0 && (
          <span className="ck-visitas-hub__photos">
            {urls.map((src, i) => (
              <button
                key={i}
                type="button"
                className="ck-visitas-hub__photo-btn"
                aria-label={`Ampliar evidência ${i + 1}`}
                onClick={() =>
                  onAbrirFoto(src, `${r.codigo ? `${r.codigo}. ` : ''}${r.texto || ''}`.trim())
                }
              >
                <img src={src} alt={`Evidência ${i + 1}`} />
              </button>
            ))}
          </span>
        )}
      </span>
      <span className={`ck-visitas-hub__chip ${chipClass(r.resposta, r)}`}>
        {formatarResposta(r)}
      </span>
    </article>
  );
}

export default function RelatorioMobileScreen({
  data,
  exportandoPdf,
  onExportarPdf,
  podeReabrir,
  reabrindo,
  onReabrir,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUsuario();
  const [fotoAberta, setFotoAberta] = useState<{ src: string; pergunta: string } | null>(null);
  const v = data.visita;
  const nota = Number(v.nota_final);
  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} · ${hora}` : fmtData(v.data_visita);
  const titulo = tituloChecklist(v);

  const porCategoria = useMemo(() => {
    const map = new Map<string, VisitaDetalhe['respostas']>();
    for (const r of data.respostas) {
      const cat = r.categoria || 'Outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return map;
  }, [data.respostas]);

  const hintNota =
    !Number.isFinite(nota) ? '' : nota >= 85 ? 'excelente' : nota >= 75 ? 'na meta' : 'abaixo da meta';

  const fromState = (location.state as { from?: string } | null)?.from;
  const rotaVoltar =
    fromState === '/checklist/mobile' || fromState === '/visitas/mobile'
      ? fromState
      : '/checklist/mobile';

  const voltar = () => navigate(rotaVoltar, { replace: true });

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-visitas-hub"
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
            <button
              type="button"
              className="ck-estoque-hub__icon-btn ck-visitas-hub__icon-btn"
              aria-label={rotaVoltar === '/checklist/mobile' ? 'Voltar para checklist' : 'Voltar para visitas'}
              onClick={voltar}
            >
              <ArrowBackIcon />
            </button>
            {podeReabrir ? (
              <button
                type="button"
                className="ck-estoque-hub__icon-btn ck-visitas-hub__icon-btn"
                aria-label="Reabrir visita"
                title="Reabrir"
                disabled={reabrindo}
                onClick={onReabrir}
              >
                {reabrindo ? (
                  <CircularProgress size={16} sx={{ color: '#fff' }} />
                ) : (
                  <LockOpenIcon />
                )}
              </button>
            ) : null}
            <button
              type="button"
              className="ck-estoque-hub__icon-btn ck-visitas-hub__icon-btn is-pri is-share"
              aria-label="Partilhar PDF"
              disabled={exportandoPdf}
              onClick={onExportarPdf}
            >
              {exportandoPdf ? (
                <CircularProgress size={14} sx={{ color: '#fff' }} />
              ) : (
                <ShareIcon sx={{ fontSize: 16 }} />
              )}
            </button>
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
            <h1>Relatório</h1>
          </div>
          <p className="ck-visitas-hub__sub">
            {titulo} · {v.name}
            {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
          </p>
        </div>
      </header>

      <div className="ck-estoque-hub__panel">
        <div className="ck-visitas-hub__kpis" aria-live="polite">
          <div className="ck-visitas-hub__kpi is-nota">
            <strong>{fmtNota(v.nota_final)}</strong>
            <span>Nota</span>
          </div>
          <div className="ck-visitas-hub__kpi">
            <strong>{data.desempenho_categorias.length}</strong>
            <span>Categorias</span>
          </div>
          <div className={`ck-visitas-hub__kpi${data.nao_conformidades.length ? ' is-alerta' : ''}`}>
            <strong>{data.nao_conformidades.length}</strong>
            <span>NCs</span>
          </div>
          <div className="ck-visitas-hub__kpi">
            <strong>{v.duracao_minutos != null ? `${v.duracao_minutos}m` : '—'}</strong>
            <span>Duração</span>
          </div>
        </div>
        <p className="ck-visitas-hub__meta">
          <span>Auditor</span>
          <strong>{v.nome_usuario}</strong>
          <em>
            {dataTxt}
            {hintNota ? ` · ${hintNota}` : ''}
          </em>
        </p>
      </div>

      <div className="ck-estoque-hub__scroll ck-visitas-hub__scroll">
        {exportandoPdf || reabrindo ? (
          <LinearProgress
            sx={{
              mb: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : null}

        <section className="ck-visitas-hub__sec">
          <h2 className="ck-visitas-hub__sec-title">Desempenho por categoria</h2>
          {data.desempenho_categorias.length ? (
            <div className="ck-visitas-hub__bars">
              {data.desempenho_categorias.map((c) => {
                const temNota =
                  c.percentual != null &&
                  c.percentual !== '' &&
                  Number.isFinite(Number(c.percentual));
                const pct = temNota ? Number(c.percentual) : 0;
                const cor = barColor(pct);
                return (
                  <div key={c.categoria} className="ck-visitas-hub__bar">
                    <div className="ck-visitas-hub__bar-head">
                      <strong>{c.categoria}</strong>
                      <span style={{ color: cor }}>{pct}%</span>
                    </div>
                    <div className="ck-visitas-hub__bar-track">
                      <div
                        className="ck-visitas-hub__bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, pct))}%`,
                          background: cor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ck-visitas-hub__empty">Sem categorias registradas.</div>
          )}
        </section>

        <section className="ck-visitas-hub__sec">
          <h2 className="ck-visitas-hub__sec-title">Respostas do checklist</h2>
          {[...porCategoria.entries()].map(([categoria, items]) => (
            <div key={categoria} className="ck-visitas-hub__cat">
              <h3>{categoria}</h3>
              <div className="ck-visitas-hub__list">
                {items.map((r) => (
                  <RespostaCard
                    key={r.id_pergunta}
                    r={r}
                    onAbrirFoto={(src, pergunta) => setFotoAberta({ src, pergunta })}
                  />
                ))}
              </div>
            </div>
          ))}
          {!data.respostas.length ? (
            <div className="ck-visitas-hub__empty">Nenhuma resposta registrada.</div>
          ) : null}
        </section>

        {data.nao_conformidades.length > 0 ? (
          <section className="ck-visitas-hub__sec">
            <h2 className="ck-visitas-hub__sec-title">Não conformidades</h2>
            <div className="ck-visitas-hub__list">
              {data.nao_conformidades.map((nc, i) => (
                <div key={i} className="ck-visitas-hub__nc">
                  <strong>
                    [{nc.gravidade}] {nc.area}
                  </strong>
                  <p>{nc.descricao}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <AppHubDock ativo={null} plusLabel="Sem ação nesta tela" plusDisabled onPlus={() => {}} />

      <ImageLightbox
        open={Boolean(fotoAberta)}
        src={fotoAberta?.src ?? null}
        titulo={fotoAberta?.pergunta}
        onClose={() => setFotoAberta(null)}
      />
    </div>
  );
}
