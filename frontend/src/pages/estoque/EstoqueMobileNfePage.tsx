/**
 * Conferência de recebimento NF no mobile.
 * Fluxo: NF do fornecedor → lista itens → OK chegou / X não chegou → lança estoque.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloseIcon from '@mui/icons-material/Close';
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

function fmtQtd(v: number) {
  return Number(v).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
}

function rotuloLoja(l: Loja) {
  const nome = String(l.name || '').trim() || 'Loja';
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

/** Código interno → nome amigável (coca = portal Brasal da Coca-Cola). */
function rotuloFornecedor(codigo: string | null | undefined, emitente?: string | null) {
  const f = String(codigo || '').toLowerCase();
  if (f === 'coca') return 'Coca-Cola';
  if (f === 'platlog') return 'Platlog';
  if (emitente && String(emitente).trim()) return String(emitente).trim();
  return codigo || 'Fornecedor';
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

/** Unidade de estoque: cadastro → NF (uCom) → texto da descrição. Sem placeholder. */
function unidadeEstoque(it: EstoqueNfeItem): string {
  const cad = String(it.unidade_contagem || '').trim();
  if (cad) return normalizarUnidade(cad);

  const desc = `${it.descricao || ''} ${it.descricao_insumo || ''}`;
  const fromDesc = unidadeNaDescricao(desc);
  if (fromDesc) return fromDesc;

  const uCom = String(it.u_com || '').trim();
  if (uCom && !ehEmbalagem(uCom)) return normalizarUnidade(uCom);

  return '';
}

function unidadeEmbalagem(it: EstoqueNfeItem): string {
  const uCom = String(it.u_com || '').trim();
  if (uCom && ehEmbalagem(uCom)) return normalizarUnidade(uCom);
  const desc = `${it.descricao || ''} ${it.descricao_insumo || ''}`;
  if (/\bCXA?\b|\bCAIXA\b/i.test(desc)) return 'cx';
  if (/\bPCT|PACOTE|FD|FARDO|SC|SACO\b/i.test(desc)) return 'pct';
  return uCom ? normalizarUnidade(uCom) : '';
}

function ehEmbalagem(u: string) {
  return /^(cx|cxa|caixa|fd|fardo|pc|pct|pacote|dz|duzia|sc|saco|un|und|unid)$/i.test(
    String(u).trim(),
  );
}

function normalizarUnidade(u: string) {
  const t = String(u).trim().toLowerCase();
  if (!t) return '';
  if (/^(kg|kgs|quilo|quilos)$/.test(t)) return 'kg';
  if (/^(g|gr|grama|gramas)$/.test(t)) return 'g';
  if (/^(l|lt|ltr|litro|litros)$/.test(t)) return 'lt';
  if (/^(ml|mililitro|mililitros)$/.test(t)) return 'ml';
  if (/^(cx|cxa|caixa)$/.test(t)) return 'cx';
  if (/^(un|und|unid|unidade|unidades)$/.test(t)) return 'un';
  if (/^(pct|pc|pacote)$/.test(t)) return 'pct';
  if (/^(fd|fardo)$/.test(t)) return 'fd';
  return t;
}

function unidadeNaDescricao(desc: string): string {
  const d = String(desc || '').toUpperCase();
  if (!d.trim()) return '';
  // "7K", "12KG", "CX 6KG", "17,66 KG", "1KG"
  if (/\d([.,]\d+)?\s*KG\b/.test(d) || /\dK(?:\s|$)/.test(d) || /\bKG\b/.test(d)) return 'kg';
  if (/\d([.,]\d+)?\s*G\b/.test(d) && !/\bKG\b/.test(d)) return 'g';
  if (/\d([.,]\d+)?\s*L(?:T|ITROS?)?\b/.test(d) || /\bLITRO/.test(d)) return 'lt';
  if (/\d([.,]\d+)?\s*ML\b/.test(d)) return 'ml';
  if (/\bUN(?:ID|IDADE)?S?\b/.test(d)) return 'un';
  return '';
}

function rotuloQtd(it: EstoqueNfeItem, recebida: number, esperada: number) {
  const undEst = unidadeEstoque(it);
  const undEmb = unidadeEmbalagem(it);
  const qCom = it.q_com != null ? Number(it.q_com) : null;

  const linhaEstoque = undEst
    ? `${fmtQtd(recebida)}/${fmtQtd(esperada)} ${undEst}`
    : `${fmtQtd(recebida)}/${fmtQtd(esperada)}`;

  let linhaEmb = '';
  if (qCom != null && qCom > 0 && undEmb && undEmb !== undEst) {
    const recEmb = esperada > 0 ? (recebida / esperada) * qCom : qCom;
    linhaEmb = `${fmtQtd(recEmb)}/${fmtQtd(qCom)} ${undEmb}`;
  }

  return { linhaEstoque, linhaEmb };
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
  const [danfeHtml, setDanfeHtml] = useState<string | null>(null);
  const [abrindoDanfe, setAbrindoDanfe] = useState(false);
  const [filtroForn, setFiltroForn] = useState<'todas' | 'platlog' | 'coca'>('todas');

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
      const rows = await api.estoqueNfes(idLoja, { conferir: true, limit: 80 });
      setLista(rows);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao listar NFs', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  const carregarDetalhe = useCallback(
    async (id: number) => {
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
    },
    [navigate],
  );

  useEffect(() => {
    if (idNfe && Number.isFinite(idNfe)) {
      void carregarDetalhe(idNfe);
    } else {
      setDet(null);
      void carregarLista();
    }
  }, [idNfe, carregarDetalhe, carregarLista]);

  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;

  const listaFiltrada = useMemo(() => {
    if (filtroForn === 'todas') return lista;
    return lista.filter((n) => String(n.fornecedor || '').toLowerCase() === filtroForn);
  }, [lista, filtroForn]);

  const contagemForn = useMemo(() => {
    let platlog = 0;
    let coca = 0;
    for (const n of lista) {
      const f = String(n.fornecedor || '').toLowerCase();
      if (f === 'platlog') platlog += 1;
      if (f === 'coca') coca += 1;
    }
    return { platlog, coca, todas: lista.length };
  }, [lista]);

  const heroRecebimento = (
    <div className="ck-visitas__stage">
      <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
      <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
      <div className="ck-visitas__mesh" aria-hidden />
      <div className="ck-visitas__stage-inner">
        <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
          <div>
            <p className="ck-visitas__mark-text">Grupo Alvim</p>
            <h1 className="ck-visitas__title">Recebimentos</h1>
          </div>
          <CkMarkLogoMenu size={48} className="ck-visitas__mark-icon" />
        </div>
        <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
          Nota do fornecedor → só confirmar o que chegou
          {lojaAtual ? ` · ${rotuloLoja(lojaAtual)}` : ''}
        </p>
      </div>
    </div>
  );

  const heroDetalhe = det ? (
    <div className="ck-visitas__stage">
      <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
      <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
      <div className="ck-visitas__mesh" aria-hidden />
      <div className="ck-visitas__stage-inner">
        <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
          <div>
            <p className="ck-visitas__mark-text">
              {rotuloFornecedor(det.fornecedor, det.emitente_nome)}
            </p>
            <h1 className="ck-visitas__title" style={{ fontSize: 'clamp(1.85rem, 8vw, 2.4rem)' }}>
              Ocorrências
            </h1>
          </div>
          <CkMarkLogoMenu size={48} className="ck-visitas__mark-icon" />
        </div>
        <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
          NF {det.numero || det.id_nfe}
          {det.emitente_nome ? ` · ${det.emitente_nome}` : ''}
        </p>
        <div className="ck-estoque-nfe__meta ck-visitas__anim ck-visitas__anim--3">
          <span>Emissão {fmtDataBR(det.emissao)}</span>
          <span>Saída {fmtDataBR(det.data_saida)}</span>
          <span>{fmtMoeda(det.valor_total)}</span>
        </div>
        {det.tem_xml ? (
          <button
            type="button"
            className="ck-estoque-nfe__danfe-btn"
            disabled={abrindoDanfe}
            onClick={() => void abrirDanfe(det.id_nfe)}
          >
            <DescriptionOutlinedIcon fontSize="small" />
            {abrindoDanfe ? 'Abrindo…' : 'Ver DANFE / nota fiscal'}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

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

  const abrirDanfe = async (id: number) => {
    setAbrindoDanfe(true);
    try {
      const html = await api.estoqueNfeDanfeHtml(id);
      setDanfeHtml(html);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível abrir a DANFE', 'error');
    } finally {
      setAbrindoDanfe(false);
    }
  };

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

  const dialogDanfe = (
    <Dialog
      fullScreen
      open={!!danfeHtml}
      onClose={() => setDanfeHtml(null)}
      slotProps={{ paper: { sx: { bgcolor: '#f3f1ec' } } }}
    >
      <div className="ck-estoque-nfe__danfe-bar">
        <strong>DANFE</strong>
        <IconButton aria-label="Fechar" onClick={() => setDanfeHtml(null)} size="small">
          <CloseIcon />
        </IconButton>
      </div>
      {danfeHtml ? (
        <iframe title="DANFE" className="ck-estoque-nfe__danfe-frame" srcDoc={danfeHtml} />
      ) : null}
    </Dialog>
  );

  // ── Detalhe: Resumo de ocorrências ─────────────────────────────────────
  if (idNfe && det) {
    return (
      <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque-nfe ck-estoque-nfe--detalhe">
        {heroDetalhe}

        <div className="ck-visitas__sheet ck-estoque-nfe__sheet">
          <div className="ck-estoque-nfe__scroll">
            <div className="ck-estoque-nfe__head">
              <span>Produto</span>
              <span>Qtd</span>
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
                const { linhaEstoque, linhaEmb } = rotuloQtd(it, rec, esp);
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
                      <span>{linhaEstoque}</span>
                      {linhaEmb ? <small>{linhaEmb}</small> : null}
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
        {dialogDanfe}
      </div>
    );
  }

  // ── Lista de NFs pendentes ─────────────────────────────────────────────
  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque-nfe">
      {heroRecebimento}

      <div className="ck-visitas__sheet">
        <div className="ck-estoque-nfe__lista-head">
          <button
            type="button"
            className="ck-estoque-nfe__back"
            onClick={() => navigate('/estoque/mobile')}
          >
            ← Contagens
          </button>
        </div>

        <div className="ck-visitas__seg" role="tablist">
          {(
            [
              ['todas', `Todas (${contagemForn.todas})`],
              ['platlog', `Platlog (${contagemForn.platlog})`],
              ['coca', `Coca-Cola (${contagemForn.coca})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filtroForn === value}
              className={`ck-visitas__seg-btn${filtroForn === value ? ' is-on' : ''}`}
              onClick={() => setFiltroForn(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && !listaFiltrada.length && (
            <div className="ck-estoque__empty">
              {lista.length
                ? 'Nenhuma NF neste filtro.'
                : 'Nenhuma NF aguardando conferência nesta loja.'}
            </div>
          )}

          {listaFiltrada.map((n) => (
            <div key={n.id_nfe} className="ck-estoque__card ck-estoque-nfe__card">
              <button
                type="button"
                className="ck-estoque-nfe__card-main"
                onClick={() => navigate(`/estoque/mobile/nfes/${n.id_nfe}`)}
              >
                <div className="ck-estoque__card-top">
                  <strong>NF {n.numero || n.id_nfe}</strong>
                  <LocalShippingOutlinedIcon fontSize="small" />
                </div>
                <div className="ck-estoque__meta">
                  <span className="ck-estoque-nfe__forn">
                    {rotuloFornecedor(n.fornecedor, n.emitente_nome)}
                  </span>
                  {' · '}
                  {n.itens_casados ?? n.itens ?? 0} itens
                </div>
                {n.emitente_nome && String(n.fornecedor).toLowerCase() === 'coca' ? (
                  <div className="ck-estoque-nfe__emit-hint">{n.emitente_nome}</div>
                ) : null}
                <div className="ck-estoque__chips">
                  <span className="ck-estoque__chip">Emis. {fmtDataBR(n.emissao)}</span>
                  <span className="ck-estoque__chip ck-estoque__chip--ok">
                    Saída {fmtDataBR(n.data_saida)}
                  </span>
                  <span className="ck-estoque__chip">{fmtMoeda(n.valor_total)}</span>
                </div>
              </button>
              {n.tem_xml ? (
                <button
                  type="button"
                  className="ck-estoque-nfe__card-danfe"
                  disabled={abrindoDanfe}
                  onClick={() => void abrirDanfe(n.id_nfe)}
                >
                  <DescriptionOutlinedIcon fontSize="small" />
                  Ver DANFE
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {dialogDanfe}
    </div>
  );
}
