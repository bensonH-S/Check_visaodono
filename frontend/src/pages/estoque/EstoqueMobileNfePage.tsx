/**
 * Conferência de recebimento NF no mobile.
 * Fluxo: NF do fornecedor → lista itens → OK chegou / X não chegou → lança estoque.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { api, type EstoqueNfeDetalhe, type EstoqueNfeItem } from '../../api/client';
import { assetUrl, LOGO_GA_LOCKUP } from '../../config/paths';
import { thumbInsumo } from '../../components/estoque/estoqueHub';
import DanfePdfPreview from '../../components/estoque/DanfePdfPreview';
import { showToast } from '../../utils/toast';
import '../../components/estoque/estoque-hub.css';
import '../../components/estoque/estoque-mobile.css';

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

  const igual = Math.abs(recebida - esperada) < 0.001;
  const linhaEstoque = undEst
    ? igual
      ? `${fmtQtd(esperada)} ${undEst}`
      : `${fmtQtd(recebida)} / ${fmtQtd(esperada)} ${undEst}`
    : igual
      ? fmtQtd(esperada)
      : `${fmtQtd(recebida)} / ${fmtQtd(esperada)}`;

  let linhaEmb = '';
  if (qCom != null && qCom > 0 && undEmb && undEmb !== undEst) {
    const recEmb = esperada > 0 ? (recebida / esperada) * qCom : qCom;
    const igualEmb = Math.abs(recEmb - qCom) < 0.001;
    linhaEmb = igualEmb
      ? `${fmtQtd(qCom)} ${undEmb}`
      : `${fmtQtd(recEmb)} / ${fmtQtd(qCom)} ${undEmb}`;
  }

  return { linhaEstoque, linhaEmb };
}

export default function EstoqueMobileNfePage() {
  const navigate = useNavigate();
  const { idNfe: idNfeParam } = useParams<{ idNfe?: string }>();
  const idNfe = idNfeParam ? Number(idNfeParam) : null;
  const [det, setDet] = useState<EstoqueNfeDetalhe | null>(null);
  const [checks, setChecks] = useState<Record<number, ItemCheck>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [danfeUrl, setDanfeUrl] = useState<string | null>(null);
  const [abrindoDanfe, setAbrindoDanfe] = useState(false);
  const [cobranca, setCobranca] = useState<Awaited<ReturnType<typeof api.estoqueNfeCobranca>> | null>(
    null,
  );
  const [abrindoCobranca, setAbrindoCobranca] = useState(false);

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
        navigate('/estoque/mobile', { replace: true, state: { aba: 'nf' } });
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
      setLoading(false);
    }
  }, [idNfe, carregarDetalhe]);

  useEffect(() => {
    return () => {
      setDanfeUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return null;
      });
    };
  }, []);

  const voltarHubNf = () => navigate('/estoque/mobile', { state: { aba: 'nf' } });

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

  const fecharDanfe = () => {
    setDanfeUrl((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return null;
    });
  };

  const abrirDanfe = async (id: number) => {
    setAbrindoDanfe(true);
    try {
      const blob = await api.estoqueNfeDanfePdf(id);
      const url = URL.createObjectURL(blob);
      setDanfeUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível abrir a DANFE', 'error');
    } finally {
      setAbrindoDanfe(false);
    }
  };

  const baixarDanfe = () => {
    if (!danfeUrl) return;
    const a = document.createElement('a');
    a.href = danfeUrl;
    a.download = `DANFE-NF-${det?.numero || det?.id_nfe || 'nota'}.pdf`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const abrirCobranca = async (id: number) => {
    setAbrindoCobranca(true);
    try {
      const c = await api.estoqueNfeCobranca(id);
      if (!c.duplicatas?.length && !c.vencimento) {
        showToast('Esta NF não tem cobrança no XML', 'error');
        return;
      }
      setCobranca(c);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível abrir a cobrança', 'error');
    } finally {
      setAbrindoCobranca(false);
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
      navigate('/estoque/mobile', { replace: true, state: { aba: 'nf' } });
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
      open={!!danfeUrl}
      onClose={fecharDanfe}
      slotProps={{ paper: { sx: { bgcolor: '#111' } } }}
    >
      <div className="ck-estoque-nfe__danfe-bar">
        <strong>DANFE</strong>
        <span>
          <IconButton aria-label="Baixar PDF" onClick={baixarDanfe} size="small">
            <DownloadIcon />
          </IconButton>
          <IconButton aria-label="Fechar" onClick={fecharDanfe} size="small">
            <CloseIcon />
          </IconButton>
        </span>
      </div>
      {danfeUrl ? <DanfePdfPreview url={danfeUrl} /> : null}
    </Dialog>
  );

  if (!idNfe || !Number.isFinite(idNfe)) {
    return <Navigate to="/estoque/mobile" replace state={{ aba: 'nf' }} />;
  }

  return (
    <div className="ck-estoque-hub ck-estoque-hub--nfe">
      <div className="ck-estoque-hub__scroll">
        <header className="ck-estoque-hub__top">
          <div className="ck-estoque-hub__brand-row">
            <button type="button" className="ck-estoque-hub__icon-btn" aria-label="Voltar" onClick={voltarHubNf}>
              <ArrowBackIcon />
            </button>
            <img className="ck-estoque-hub__mark" src={assetUrl(LOGO_GA_LOCKUP)} alt="Grupo Alvim" />
            <span className="ck-estoque-hub__icon-btn" aria-hidden />
          </div>
          <div className="ck-estoque-hub__store-row">
            <h1>{det ? `NF ${det.numero || det.id_nfe}` : 'Nota fiscal'}</h1>
          </div>
          {det ? (
            <p className="ck-estoque-hub__nfe-sub">
              {rotuloFornecedor(det.fornecedor, det.emitente_nome)}
              {det.valor_total != null ? ` · ${fmtMoeda(det.valor_total)}` : ''}
            </p>
          ) : null}
        </header>

        <div className="ck-estoque-hub__body">
          {loading && !det ? <LinearProgress sx={{ my: 1, borderRadius: 1, bgcolor: '#333840' }} /> : null}
          {!loading && !det ? <p className="ck-estoque-hub__empty">Nota fiscal não encontrada.</p> : null}

          {det ? (
            <>
              <div className="ck-estoque-hub__nfe-docs">
                <button
                  type="button"
                  disabled={!det.tem_xml || abrindoDanfe}
                  onClick={() => void abrirDanfe(det.id_nfe)}
                >
                  <DescriptionOutlinedIcon />
                  {abrindoDanfe ? 'Abrindo…' : 'DANFE'}
                </button>
                <button
                  type="button"
                  disabled={abrindoCobranca}
                  onClick={() => void abrirCobranca(det.id_nfe)}
                >
                  <RequestQuoteOutlinedIcon />
                  {abrindoCobranca ? 'Abrindo…' : 'Cobrança'}
                </button>
              </div>

              <div className="ck-estoque-hub__table">
                <div className="ck-estoque-hub__cols">
                  <span>Produto</span>
                  <span>Qtd</span>
                  <span>Estado</span>
                </div>
                <div className="ck-estoque-hub__lista">
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
                        className={`ck-estoque-hub__row${estado === false ? ' is-falta' : ''}`}
                      >
                        <span className="ck-estoque-hub__item">
                          <img
                            className="ck-estoque-hub__thumb"
                            src={assetUrl(
                              thumbInsumo({
                                codigo: it.codigo_insumo || it.codigo_nf,
                                descricao: it.descricao_insumo || it.descricao,
                              }),
                            )}
                            alt=""
                          />
                          <span className="ck-estoque-hub__copy">
                            <strong>{nomeItem(it)}</strong>
                            <small>
                              {semMatch
                                ? 'Sem cadastro — só ocorrência'
                                : it.codigo_nf || it.codigo_insumo || ''}
                            </small>
                          </span>
                        </span>
                        <span className="ck-estoque-hub__qtd ck-estoque-hub__qtd--nfe">
                          {linhaEstoque}
                          {linhaEmb ? <small>{linhaEmb}</small> : null}
                        </span>
                        <span className="ck-estoque-hub__nfe-acoes">
                          <button
                            type="button"
                            className={`ck-estoque-hub__nfe-btn ck-estoque-hub__nfe-btn--ok${
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
                            className={`ck-estoque-hub__nfe-btn ck-estoque-hub__nfe-btn--no${
                              estado === false ? ' is-on' : ''
                            }`}
                            aria-label="Não chegou"
                            onClick={() => marcar(it.id_item, false)}
                          >
                            <HighlightOffIcon />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {det ? (
        <div className="ck-estoque-hub__foot">
          <button type="button" onClick={voltarHubNf}>
            Voltar
          </button>
          <button type="button" className="is-ghost" onClick={marcarTodosOk}>
            Todos OK
          </button>
          <button
            type="button"
            className="is-pri"
            disabled={salvando || resumo.pend > 0}
            onClick={() => void finalizar()}
          >
            {salvando ? 'Salvando…' : `Continuar (${resumo.ok}/${resumo.total})`}
          </button>
        </div>
      ) : null}
      {dialogDanfe}
      {cobranca &&
        createPortal(
          <div className="ck-estoque-hub ck-estoque-hub--sheet">
            <button
              type="button"
              className="ck-estoque-hub__sheet-back"
              aria-label="Fechar"
              onClick={() => setCobranca(null)}
            />
            <div className="ck-estoque-hub__sheet" role="dialog" aria-modal="true" aria-label="Cobrança">
              <div className="ck-estoque-hub__sheet-handle" />
              <div className="ck-estoque-hub__sheet-head">
                <span className="ck-estoque-hub__thumb ck-estoque-hub__thumb--nf">
                  <RequestQuoteOutlinedIcon />
                </span>
                <div>
                  <strong>Cobrança da NF {cobranca.numero || det?.numero || ''}</strong>
                  <small>{cobranca.emitente || 'Fornecedor'}</small>
                </div>
              </div>
              <div className="ck-estoque-hub__sheet-grid">
                <div>
                  <span>Valor</span>
                  <b>{fmtMoeda(cobranca.valor_total)}</b>
                </div>
                <div>
                  <span>Vencimento</span>
                  <b>{fmtDataBR(cobranca.vencimento)}</b>
                </div>
              </div>
              {(cobranca.duplicatas || []).length > 1 ? (
                <div className="ck-estoque-hub__nfe-parcelas">
                  {cobranca.duplicatas.map((d, i) => (
                    <div key={`${d.numero || i}-${d.vencimento || i}`}>
                      <span>Parcela {d.numero || i + 1}</span>
                      <b>
                        {fmtMoeda(d.valor)}
                        <small> · {fmtDataBR(d.vencimento)}</small>
                      </b>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="ck-estoque-hub__nfe-hint">
                Dados da NF. O boleto bancário em PDF não vem no XML do fornecedor.
              </p>
              <button type="button" className="ck-estoque-hub__sheet-fechar" onClick={() => setCobranca(null)}>
                Fechar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
