import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { api, type EstoqueMetaVendas, type Loja } from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';
const REFRESH_MS = 45000;

function nomeLoja(l: Loja) {
  return String(l.name || '').trim() || 'Loja';
}

function rotuloLoja(l: Loja) {
  const nome = nomeLoja(l);
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

function fmtMoeda(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtHoraBR(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function textoSync(meta: EstoqueMetaVendas | null) {
  if (!meta) return 'aguardando…';
  const hora = fmtHoraBR(meta.ultimo_sync_em);
  if (meta.hoje_ausente) {
    return `hoje não entrou · último ${fmtDataBR(meta.ultima_data_venda)}`;
  }
  if (meta.hoje_parcial) {
    return hora ? `hoje incompleto · sync ${hora}` : 'hoje incompleto';
  }
  return hora ? `sync ${hora}` : 'BK Office';
}

export default function EstoqueMobileVendasPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const u = getUsuario();
    if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
    if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [meta, setMeta] = useState<EstoqueMetaVendas | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;

  const carregar = useCallback(async (lojaId: number, silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setErr(null);
    }
    try {
      const m = await api.estoqueMetaVendas(lojaId, { crescimento: 0.1 });
      setMeta(m);
    } catch (e) {
      if (!silencioso) {
        setMeta(null);
        setErr(e instanceof Error ? e.message : 'Erro ao carregar vendas');
        showToast(e instanceof Error ? e.message : 'Erro ao carregar vendas', 'error');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await api.estoqueLojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        if (!idLoja && rows[0]) {
          setIdLoja(rows[0].id_loja);
          localStorage.setItem(LOJA_STORAGE_KEY, String(rows[0].id_loja));
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas');
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount
  }, []);

  useEffect(() => {
    if (!idLoja) return;
    void carregar(idLoja);
  }, [idLoja, carregar]);

  useEffect(() => {
    if (!idLoja) return;
    const t = window.setInterval(() => void carregar(idLoja, true), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [idLoja, carregar]);

  const diasRecentes = useMemo(() => {
    const lista = meta?.dias || [];
    return [...lista].reverse().slice(0, 10);
  }, [meta?.dias]);

  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">Vendas</h1>
            </div>
            <CkMarkLogoMenu size={48} className="ck-visitas__mark-icon" />
          </div>
          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Coluna Bruto do BK Office · atualiza a cada 45s
          </p>
          <div
            className="ck-visitas__metrics ck-visitas__metrics--row ck-visitas__anim ck-visitas__anim--3"
            aria-live="polite"
          >
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{loading && !meta ? '—' : fmtMoeda(meta?.venda_hoje)}</strong>
              <span>hoje</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading && !meta ? '—' : fmtMoeda(meta?.venda_mtd)}</strong>
              <span>mês</span>
            </div>
            <div className="ck-visitas__metric">
              <strong style={{ fontSize: '0.95rem' }}>{textoSync(meta)}</strong>
              <span>sync</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-estoque__sheet-head">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          {podeTrocarLoja ? (
            <div className="ck-estoque__loja">
              <button
                type="button"
                className="ck-estoque__loja-btn"
                onClick={() => {
                  const idx = lojas.findIndex((l) => l.id_loja === idLoja);
                  const next = lojas[(idx + 1) % lojas.length];
                  if (!next) return;
                  setIdLoja(next.id_loja);
                  localStorage.setItem(LOJA_STORAGE_KEY, String(next.id_loja));
                }}
              >
                <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
                <span aria-hidden>▾</span>
              </button>
            </div>
          ) : lojaAtual ? (
            <div className="ck-estoque__loja">
              <div className="ck-estoque__loja-fix" aria-label="Loja">
                <StorefrontOutlinedIcon className="ck-estoque__loja-fix-icon" />
                <div className="ck-estoque__loja-fix-text">
                  {lojaAtual.bk_number ? <small>{lojaAtual.bk_number}</small> : null}
                  <strong>{nomeLoja(lojaAtual)}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="ck-estoque-nfe__atalho"
            onClick={() => navigate('/estoque/mobile')}
          >
            <Inventory2OutlinedIcon fontSize="small" />
            <span>Voltar para conferências</span>
            <span aria-hidden>›</span>
          </button>
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && !meta && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {meta?.meta_mes != null ? (
            <div className="ck-estoque__card ck-estoque__card--lista" style={{ marginBottom: 12 }}>
              <div className="ck-estoque__card-top">
                <div className="ck-estoque__card-title">
                  <strong>Meta do mês (+10%)</strong>
                  <span className="ck-estoque__card-tipo">
                    {meta.atingimento_mtd_pct != null
                      ? `${meta.atingimento_mtd_pct}% do MTD`
                      : `LY ${fmtMoeda(meta.venda_ly_mes)}`}
                  </span>
                </div>
                <div className="ck-estoque__card-valor">
                  <strong>{fmtMoeda(meta.meta_mes)}</strong>
                  <span>projeção {fmtMoeda(meta.projecao_mes)}</span>
                </div>
              </div>
            </div>
          ) : null}

          <p
            style={{
              margin: '0 0 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            Últimos dias
          </p>

          {!loading && !diasRecentes.length && (
            <div className="ck-estoque__empty">Nenhuma venda no mês ainda.</div>
          )}

          {diasRecentes.map((d) => (
            <div key={d.data} className="ck-estoque__card ck-estoque__card--lista">
              <div className="ck-estoque__card-top">
                <div className="ck-estoque__card-title">
                  <strong>{fmtDataBR(d.data)}</strong>
                  <span className="ck-estoque__card-tipo">
                    {d.sem_sync ? 'sem sync' : `LY ${fmtMoeda(d.venda_ly)}`}
                  </span>
                </div>
                <div className="ck-estoque__card-valor">
                  <strong>{fmtMoeda(d.venda)}</strong>
                  <span>{d.data === meta?.ate ? 'hoje' : 'venda'}</span>
                </div>
              </div>
            </div>
          ))}

          {(meta?.top_produtos || []).length > 0 ? (
            <>
              <p
                style={{
                  margin: '16px 0 8px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#64748b',
                }}
              >
                Top produtos (mês)
              </p>
              {meta!.top_produtos.map((p) => (
                <div key={p.codigo} className="ck-estoque__card ck-estoque__card--lista">
                  <div className="ck-estoque__card-top">
                    <div className="ck-estoque__card-title">
                      <strong>{p.descricao || p.codigo}</strong>
                      <span className="ck-estoque__card-tipo">{p.codigo}</span>
                    </div>
                    <div className="ck-estoque__card-valor">
                      <strong>{fmtMoeda(p.venda)}</strong>
                      <span>{p.qtde} un</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
