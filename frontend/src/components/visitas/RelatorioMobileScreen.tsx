import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { fmtData, fmtNota, fetchMediaAutenticada } from '../../api/client';
import type { VisitaDetalhe } from '../../api/client';
import { formatarHoraVisita } from '../../utils/visitaFormat';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import ImageLightbox from '../ImageLightbox';
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
    if (resposta === 'Não') return 'ck-visitas__chip--ok';
    if (resposta === 'Sim') return 'ck-visitas__chip--fail';
  }
  if (resposta === 'Sim') return 'ck-visitas__chip--ok';
  if (resposta === 'Não') return 'ck-visitas__chip--fail';
  return 'ck-visitas__chip--navy';
}

function barColor(pct: number): string {
  if (pct >= 80) return '#15803d';
  if (pct >= 60) return '#e8520a';
  return '#1b2a6b';
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
    <article className="ck-visitas__card is-done ck-visitas__card--rel">
      <span className="ck-visitas__mono" aria-hidden>
        {r.codigo?.slice(0, 2) || '·'}
      </span>
      <span className="ck-visitas__copy">
        <strong>
          {r.codigo ? `${r.codigo}. ` : ''}
          {r.texto}
        </strong>
        {r.observacao?.trim() ? <small>{r.observacao.trim()}</small> : null}
        {urls.length > 0 && (
          <span className="ck-visitas__photos">
            {urls.map((src, i) => (
              <button
                key={i}
                type="button"
                className="ck-visitas__photo-btn"
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
      <span className="ck-visitas__side">
        <span className={`ck-visitas__chip ${chipClass(r.resposta, r)}`}>{formatarResposta(r)}</span>
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

  return (
    <div className="ck-visitas ck-visitas--relatorio">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__toolbar ck-visitas__anim ck-visitas__anim--1">
            <div className="ck-visitas__toolbar-heading">
              <p className="ck-visitas__mark-text ck-visitas__mark-text--toolbar">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-visitas__title--toolbar">
                Relatório
                <br />
                da visita
              </h1>
            </div>
            <div className="ck-visitas__toolbar-actions ck-visitas__toolbar-actions--with-logo">
              <button
                type="button"
                className="ck-visitas__back"
                aria-label="Voltar para visitas"
                onClick={() => navigate('/visitas/mobile', { replace: true })}
              >
                ←
              </button>
              {podeReabrir && (
                <button
                  type="button"
                  className="ck-visitas__pdf"
                  aria-label="Reabrir visita"
                  title="Reabrir"
                  disabled={reabrindo}
                  onClick={onReabrir}
                  style={{ background: '#1B2A6B' }}
                >
                  {reabrindo ? (
                    <CircularProgress size={18} sx={{ color: '#fff' }} />
                  ) : (
                    <LockOpenIcon fontSize="small" />
                  )}
                </button>
              )}
              <button
                type="button"
                className="ck-visitas__pdf"
                aria-label="Baixar PDF"
                disabled={exportandoPdf}
                onClick={onExportarPdf}
              >
                {exportandoPdf ? (
                  <CircularProgress size={18} sx={{ color: '#fff' }} />
                ) : (
                  <PictureAsPdfIcon fontSize="small" />
                )}
              </button>
              <CkMarkLogoMenu size={48} className="ck-visitas__toolbar-logo" />
            </div>
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            {titulo} · {v.name}
            {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{fmtNota(v.nota_final)}</strong>
              <span>nota</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{data.desempenho_categorias.length}</strong>
              <span>categorias</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{data.nao_conformidades.length}</strong>
              <span>NCs</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{v.duracao_minutos != null ? `${v.duracao_minutos}m` : '—'}</strong>
              <span>duração</span>
            </div>
          </div>

          <p className="ck-visitas__auditor-line ck-visitas__anim ck-visitas__anim--4">
            <span>Auditor</span>
            <strong>{v.nome_usuario}</strong>
            <em>
              {dataTxt}
              {hintNota ? ` · ${hintNota}` : ''}
            </em>
          </p>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <p className="ck-visitas__section">Desempenho por categoria</p>
        {data.desempenho_categorias.length ? (
          <div className="ck-visitas__list">
            {data.desempenho_categorias.map((c) => {
              const temNota =
                c.percentual != null &&
                c.percentual !== '' &&
                Number.isFinite(Number(c.percentual));
              const pct = temNota ? Number(c.percentual) : 0;
              const cor = barColor(pct);
              return (
                <div key={c.categoria} className="ck-visitas__bar">
                  <div className="ck-visitas__bar-head">
                    <strong>{c.categoria}</strong>
                    <span style={{ color: cor }}>{pct}%</span>
                  </div>
                  <div className="ck-visitas__bar-track">
                    <div
                      className="ck-visitas__bar-fill"
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
          <div className="ck-visitas__empty">Sem categorias registradas.</div>
        )}

        <p className="ck-visitas__section">Respostas do checklist</p>
        {[...porCategoria.entries()].map(([categoria, items]) => (
          <div key={categoria} className="ck-visitas__cat-block">
            <h2 className="ck-visitas__cat">{categoria}</h2>
            <div className="ck-visitas__list">
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
        {!data.respostas.length && <div className="ck-visitas__empty">Nenhuma resposta registrada.</div>}

        {data.nao_conformidades.length > 0 && (
          <>
            <p className="ck-visitas__section">Não conformidades</p>
            <div className="ck-visitas__list">
              {data.nao_conformidades.map((nc, i) => (
                <div key={i} className="ck-visitas__nc">
                  <strong>
                    [{nc.gravidade}] {nc.area}
                  </strong>
                  <p>{nc.descricao}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ImageLightbox
        open={Boolean(fotoAberta)}
        src={fotoAberta?.src ?? null}
        titulo={fotoAberta?.pergunta}
        onClose={() => setFotoAberta(null)}
      />
    </div>
  );
}
