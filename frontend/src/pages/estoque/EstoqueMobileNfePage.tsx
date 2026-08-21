/**
 * Conferência de recebimento NF no mobile.
 * Fluxo: NF do fornecedor → lista itens → OK chegou / X não chegou → lança estoque.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import {
  api,
  type EstoqueNfeDetalhe,
  type EstoqueNfeItem,
  type EstoqueNfeResumo,
  type Loja,
} from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

type ItemCheck = {
  id_item: number;
  /** true = chegou, false = não chegou, null = ainda não marcado */
  ok: boolean | null;
  qtd_esperada: number;
  qtd_recebida: number;
};

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtMoeda(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function rotuloLoja(l: Loja) {
  const nome = String(l.name || '').trim() || 'Loja';
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

function qtdEsperada(it: EstoqueNfeItem) {
  const q = it.qtd_estoque ?? it.q_com ?? 0;
  return Number(q) || 0;
}

function nomeItem(it: EstoqueNfeItem) {
  return (
    it.descricao_insumo ||
    it.descricao ||
    it.codigo_insumo ||
    it.codigo_nf ||
    `Item ${it.n_item ?? it.id_item}`
  );
}

export default function EstoqueMobileNfePage() {
  const navigate = useNavigate();
  const { idNfe: idNfeParam } = useParams<{ idNfe?: string }>();
  const idNfe = idNfeParam ? Number(idNfeParam) : null;

  const [idLoja, setIdLoja] = useState<number | null>(() => {
    const u = getUsuario();
    if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
    if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lista, setLista] = useState<EstoqueNfeResumo[]>([]);
  const [det, setDet] = useState<EstoqueNfeDetalhe | null>(null);
  const [checks, setChecks] = useState<Record<number, ItemCheck>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await api.estoqueLojas({ ativas: true, operacionais: true });
        setLojas(rows);
        if (!idLoja && rows[0]) {
          setIdLoja(rows[0].id_loja);
          localStorage.setItem(LOJA_STORAGE_KEY, String(rows[0].id_loja));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [idLoja]);

  const carregarLista = useCallback(async () => {
    if (!idLoja) return;
    setLoading(true);
    try {
      const rows = await api.estoqueNfes(idLoja, { conferir: true, limit: 40 });
      setLista(rows);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao listar NFs', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  const carregarDetalhe = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const d = await api.estoqueNfeDetalhe(id);
      setDet(d);
      const map: Record<number, ItemCheck> = {};
      for (const it of d.itens || []) {
        const esp = qtdEsperada(it);
        const ja = it.conferido
          ? it.qtd_conferida != null && Number(it.qtd_conferida) > 0
            ? true
            : it.qtd_conferida === 0
              ? false
              : null
          : null;
        map[it.id_item] = {
          id_item: it.id_item,
          ok: ja,
          qtd_esperada: esp,
          qtd_recebida: ja === false ? 0 : esp,
        };
      }
      setChecks(map);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao abrir NF', 'error');
      navigate('/estoque/mobile/nfes', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (idNfe && Number.isFinite(idNfe)) {
      void carregarDetalhe(idNfe);
    } else {
      void carregarLista();
    }
  }, [idNfe, carregarDetalhe, carregarLista]);

  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;

  const marcar = (idItem: number, ok: boolean) => {
    setChecks((prev) => {
      const cur = prev[idItem];
      if (!cur) return prev;
      return {
        ...prev,
        [idItem]: {
          ...cur,
          ok,
          qtd_recebida: ok ? cur.qtd_esperada : 0,
        },
      };
    });
  };

  const resumo = useMemo(() => {
    const vals = Object.values(checks);
    const total = vals.length;
    const ok = vals.filter((c) => c.ok === true).length;
    const nao = vals.filter((c) => c.ok === false).length;
    const pend = vals.filter((c) => c.ok == null).length;
    return { total, ok, nao, pend };
  }, [checks]);

  const finalizar = async () => {
    if (!det) return;
    if (resumo.pend > 0) {
      showToast(`Ainda faltam ${resumo.pend} item(ns) para marcar`, 'error');
      return;
    }
    setSalvando(true);
    try {
      const itens = Object.values(checks).map((c) => ({
        id_item: c.id_item,
        conferido: true,
        qtd_conferida: c.ok ? c.qtd_recebida : 0,
        divergencia_obs: c.ok ? undefined : 'Não chegou na entrega',
      }));
      const r = await api.estoqueNfeConferir(det.id_nfe, { itens });
      showToast(
        r.divergente
          ? `NF lançada com divergência · ${fmtDataBR(r.data_entrega)}`
          : `Recebimento OK · estoque atualizado`,
        r.divergente ? 'warning' : 'success',
      );
      navigate('/estoque/mobile/nfes', { replace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao finalizar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const marcarTodosOk = () => {
    setChecks((prev) => {
      const next: Record<number, ItemCheck> = {};
      for (const [k, c] of Object.entries(prev)) {
        next[Number(k)] = { ...c, ok: true, qtd_recebida: c.qtd_esperada };
      }
      return next;
    });
  };

  // ── Detalhe: Resumo de ocorrências ─────────────────────────────────────
  if (idNfe && det) {
    return (
      <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque-nfe">
        <div className="ck-visitas__hero">
          <div className="ck-visitas__top">
            <CkMarkLogoMenu />
            <div className="ck-visitas__titles">
              <h1>Resumo de ocorrências</h1>
              <p>
                NF {det.numero || det.id_nfe} · {det.emitente_nome || det.fornecedor}
              </p>
            </div>
          </div>
          <div className="ck-estoque-nfe__meta">
            <span>Emissão {fmtDataBR(det.emissao)}</span>
            <span>Saída {fmtDataBR(det.data_saida)}</span>
            <span>{fmtMoeda(det.valor_total)}</span>
          </div>
        </div>

        <div className="ck-visitas__sheet">
          <div className="ck-estoque-nfe__head">
            <span>Produto</span>
            <span>Unidades</span>
            <span>Estado</span>
          </div>

          {loading && <LinearProgress sx={{ my: 1, borderRadius: 1 }} />}

          <div className="ck-estoque-nfe__lista">
            {(det.itens || []).map((it) => {
              const c = checks[it.id_item];
              const esp = c?.qtd_esperada ?? qtdEsperada(it);
              const rec = c?.qtd_recebida ?? esp;
              const estado = c?.ok;
              const semMatch = !it.id_insumo;
              return (
                <div
                  key={it.id_item}
                  className={`ck-estoque-nfe__row${estado === false ? ' is-falta' : ''}${
                    estado === true ? ' is-ok' : ''
                  }${semMatch ? ' is-nomatch' : ''}`}
                >
                  <div className="ck-estoque-nfe__prod">
                    <strong>{nomeItem(it)}</strong>
                    {semMatch ? (
                      <small>Sem cadastro de insumo — só registra ocorrência</small>
                    ) : (
                      <small>{it.codigo_nf || it.codigo_insumo}</small>
                    )}
                  </div>
                  <div className="ck-estoque-nfe__qtd">
                    {rec}/{esp}
                  </div>
                  <div className="ck-estoque-nfe__acoes">
                    <button
                      type="button"
                      className={`ck-estoque-nfe__btn ck-estoque-nfe__btn--ok${
                        estado === true ? ' is-on' : ''
                      }`}
                      aria-label="Chegou"
                      disabled={semMatch && esp <= 0}
                      onClick={() => marcar(it.id_item, true)}
                    >
                      <CheckCircleOutlinedIcon />
                    </button>
                    <button
                      type="button"
                      className={`ck-estoque-nfe__btn ck-estoque-nfe__btn--no${
                        estado === false ? ' is-on' : ''
                      }`}
                      aria-label="Não chegou"
                      onClick={() => marcar(it.id_item, false)}
                    >
                      <HighlightOffIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ck-estoque-nfe__footer">
            <button
              type="button"
              className="ck-estoque-nfe__foot-btn"
              onClick={() => navigate('/estoque/mobile/nfes')}
            >
              Voltar
            </button>
            <button
              type="button"
              className="ck-estoque-nfe__foot-btn ck-estoque-nfe__foot-btn--ghost"
              onClick={marcarTodosOk}
            >
              Todos OK
            </button>
            <button
              type="button"
              className="ck-estoque-nfe__foot-btn ck-estoque-nfe__foot-btn--pri"
              disabled={salvando || resumo.pend > 0}
              onClick={() => void finalizar()}
            >
              {salvando ? 'Salvando…' : `Continuar (${resumo.ok}/${resumo.total})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lista de NFs pendentes ─────────────────────────────────────────────
  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque-nfe">
      <div className="ck-visitas__hero">
        <div className="ck-visitas__top">
          <CkMarkLogoMenu />
          <div className="ck-visitas__titles">
            <h1>Recebimentos NF</h1>
            <p>Nota do fornecedor → só confirmar o que chegou</p>
          </div>
        </div>
        {lojaAtual && (
          <p className="ck-estoque-nfe__loja">{rotuloLoja(lojaAtual)}</p>
        )}
      </div>

      <div className="ck-visitas__sheet">
        <div className="ck-estoque__sheet-head">
          <button
            type="button"
            className="ck-estoque__voltar ck-visitas__btn-ghost"
            onClick={() => navigate('/estoque/mobile')}
          >
            ← Contagens
          </button>
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && !lista.length && (
            <div className="ck-estoque__empty">
              Nenhuma NF aguardando conferência nesta loja.
              <br />
              Quando o sync do fornecedor trouxer a nota, ela aparece aqui.
            </div>
          )}

          {lista.map((n) => (
            <button
              key={n.id_nfe}
              type="button"
              className="ck-estoque__card ck-estoque-nfe__card"
              onClick={() => navigate(`/estoque/mobile/nfes/${n.id_nfe}`)}
            >
              <div className="ck-estoque__card-top">
                <strong>NF {n.numero || n.id_nfe}</strong>
                <LocalShippingOutlinedIcon fontSize="small" />
              </div>
              <div className="ck-estoque__meta">
                {n.emitente_nome || n.fornecedor} · {n.itens_casados ?? n.itens ?? 0} itens
              </div>
              <div className="ck-estoque__chips">
                <span className="ck-estoque__chip">Emis. {fmtDataBR(n.emissao)}</span>
                <span className="ck-estoque__chip ck-estoque__chip--ok">
                  Saída {fmtDataBR(n.data_saida)}
                </span>
                <span className="ck-estoque__chip">{fmtMoeda(n.valor_total)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
