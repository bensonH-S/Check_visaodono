import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { api, type EstoqueSaldoItem, type Loja } from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

function nomeLoja(l: Loja) {
  return String(l.name || '').trim() || 'Loja';
}

function rotuloLoja(l: Loja) {
  const nome = nomeLoja(l);
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

function rotuloGrupo(g: string | null | undefined) {
  const mapa: Record<string, string> = {
    carne: 'Carne',
    frango: 'Frango',
    queijo: 'Queijo',
    bacon: 'Bacon',
    pao: 'Pão',
    batata: 'Batata',
    oleo: 'Óleo',
    refil: 'Copo / xarope',
    vegetais: 'Vegetais',
    mix_sobremesa: 'Mix',
  };
  return mapa[String(g || '')] || g || 'Outros';
}

export default function EstoqueMobileSaldoPage() {
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
  const [itens, setItens] = useState<EstoqueSaldoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;

  const carregar = useCallback(async (lojaId: number) => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await api.estoqueSaldos(lojaId, undefined, { diaria: true });
      setItens(rows);
    } catch (e) {
      setItens([]);
      setErr(e instanceof Error ? e.message : 'Erro ao carregar saldo');
      showToast(e instanceof Error ? e.message : 'Erro ao carregar saldo', 'error');
    } finally {
      setLoading(false);
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

  const grupos = useMemo(() => {
    const map = new Map<string, EstoqueSaldoItem[]>();
    for (const i of itens) {
      const g = i.grupo_diario || 'outros';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(i);
    }
    return [...map.entries()];
  }, [itens]);

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
              <h1 className="ck-visitas__title">Saldo</h1>
            </div>
            <CkMarkLogoMenu size={48} className="ck-visitas__mark-icon" />
          </div>
          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Só consulta — insumos da diária. Não abre contagem.
          </p>
          <div
            className="ck-visitas__metrics ck-visitas__metrics--row ck-visitas__anim ck-visitas__anim--3"
            aria-live="polite"
          >
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{loading ? '—' : itens.length}</strong>
              <span>itens</span>
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
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && !itens.length && (
            <div className="ck-estoque__empty">
              Nenhum insumo da diária nesta loja.
            </div>
          )}

          {!loading &&
            grupos.map(([grupo, rows]) => (
              <div key={grupo} style={{ marginBottom: 16 }}>
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
                  {rotuloGrupo(grupo)}
                </p>
                {rows.map((r) => (
                  <div key={r.id_insumo || r.id_produto} className="ck-estoque__card ck-estoque__card--lista">
                    <div className="ck-estoque__card-top">
                      <div className="ck-estoque__card-title">
                        <strong>{r.descricao}</strong>
                        <span className="ck-estoque__card-tipo">{r.codigo}</span>
                      </div>
                      <div className="ck-estoque__card-valor">
                        <strong>
                          {fmtNum(r.quantidade, 2)} {r.unidade_contagem || ''}
                        </strong>
                        <span>saldo</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
