/**
 * Conferência de recebimento NF no mobile.
 * Fluxo: NF do fornecedor → lista itens → OK chegou / X não chegou → lança estoque.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import { api, type EstoqueNfeDetalhe, type EstoqueNfeItem } from '../../api/client';
import { getUsuario, podeReabrirConferenciaNfe } from '../../lib/auth';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import { dialogContentSx } from '../../utils/dialogForm';
import { assetUrl, ICONE_PWA, LOGO_GA_LOCKUP } from '../../config/paths';
import { thumbInsumo } from '../../components/estoque/estoqueHub';
import { showToast } from '../../utils/toast';
import '../../components/estoque/estoque-hub.css';
import '../../components/estoque/estoque-mobile.css';

type ItemCheck = {
  id_item: number;
  /** true = chegou (total ou parcial), false = não chegou, null = ainda não marcado */
  ok: boolean | null;
  qtd_esperada: number;
  qtd_recebida: number;
};

function ehParcial(c: ItemCheck | undefined) {
  if (!c || c.ok !== true) return false;
  return Math.abs(c.qtd_recebida - c.qtd_esperada) > 0.0001 && c.qtd_recebida > 0;
}

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '?';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtMoeda(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '?';
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

/** Quantos produtos cabem na tela do celular sem depender da rolagem. */
const ITENS_POR_PAGINA = 4;

function qtdEsperada(it: EstoqueNfeItem) {
  const q = it.qtd_estoque ?? it.q_com ?? 0;
  return Number(q) || 0;
}

/** Nome da conferência = texto da NF. O cadastro não substitui o produto da nota. */
function nomeItem(it: EstoqueNfeItem) {
  return (
    it.descricao ||
    it.descricao_insumo ||
    it.codigo_nf ||
    it.codigo_insumo ||
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
  const [pagina, setPagina] = useState(0);
  const [dlgDevolver, setDlgDevolver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregarDetalhe = useCallback(
    async (id: number, opts?: { avisoXml?: boolean }) => {
      setLoading(true);
      try {
        const d = await api.estoqueNfeDetalhe(id);
        setPagina(0);
        setDet(d);
        const map: Record<number, ItemCheck> = {};
        for (const it of d.itens || []) {
          const esp = qtdEsperada(it);
          const conf =
            it.qtd_conferida != null && Number.isFinite(Number(it.qtd_conferida))
              ? Number(it.qtd_conferida)
              : null;
          let ok: boolean | null = null;
          let recebida = esp;
          if (it.conferido || conf != null) {
            if (conf != null && conf <= 0) {
              ok = false;
              recebida = 0;
            } else if (conf != null) {
              ok = true;
              recebida = conf;
            } else {
              ok = true;
              recebida = esp;
            }
          }
          map[it.id_item] = {
            id_item: it.id_item,
            ok,
            qtd_esperada: esp,
            qtd_recebida: recebida,
          };
        }
        setChecks(map);
        const semItens = !(d.itens || []).length && !d.entrada_registrada;
        if (opts?.avisoXml && semItens) {
          showToast(
            (d as { xml_motivo?: string | null }).xml_motivo
              || 'Ainda sem XML da Receita. Tente de novo em alguns segundos.',
            'warning',
          );
        } else if (opts?.avisoXml && !semItens) {
          showToast('XML carregado  produtos liberados.', 'success');
        }
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
    if (det?.entrada_registrada) return;
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

  /** Digita a quantidade que realmente chegou (ex.: 3 de 5). */
  const alterarQtd = (idItem: number, texto: string) => {
    if (det?.entrada_registrada) return;
    setChecks((prev) => {
      const cur = prev[idItem];
      if (!cur) return prev;
      const limpo = String(texto).replace(',', '.').trim();
      if (limpo === '') {
        return {
          ...prev,
          [idItem]: { ...cur, ok: null, qtd_recebida: cur.qtd_esperada },
        };
      }
      let n = Number(limpo);
      if (!Number.isFinite(n) || n < 0) n = 0;
      if (n > cur.qtd_esperada) n = cur.qtd_esperada;
      return {
        ...prev,
        [idItem]: {
          ...cur,
          ok: n <= 0 ? false : true,
          qtd_recebida: n,
        },
      };
    });
  };

  const resumo = useMemo(() => {
    const vals = Object.values(checks);
    const total = vals.length;
    const ok = vals.filter((c) => c.ok === true && !ehParcial(c)).length;
    const parcial = vals.filter((c) => ehParcial(c)).length;
    const nao = vals.filter((c) => c.ok === false).length;
    const pend = vals.filter((c) => c.ok == null).length;
    return { total, ok, parcial, nao, pend };
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
      const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdf);
      const janela = window.open(url, '_blank');
      if (janela) {
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        return;
      }
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

  const abrirDanfeFora = () => {
    if (!danfeUrl) return;
    window.open(danfeUrl, '_blank', 'noopener');
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
        showToast(
          c.tem_xml
            ? 'Esta NF não tem cobrança no XML'
            : 'O XML desta nota ainda não está no banco.',
          'error',
        );
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
    if (!det || det.entrada_registrada) return;
    if (resumo.pend > 0) {
      showToast(`Ainda faltam ${resumo.pend} item(ns) para marcar`, 'error');
      return;
    }
    setSalvando(true);
    try {
      const itens = Object.values(checks).map((c) => {
        const qtd = c.ok === false ? 0 : c.qtd_recebida;
        const parcial = Math.abs(qtd - c.qtd_esperada) > 0.0001;
        let obs;
        if (qtd <= 0) obs = 'N�o chegou na entrega';
        else if (parcial) obs = `Recebido parcial: ${fmtQtd(qtd)} de ${fmtQtd(c.qtd_esperada)}`;
        return {
          id_item: c.id_item,
          conferido: true,
          qtd_conferida: qtd,
          divergencia_obs: obs,
        };
      });
      const r = await api.estoqueNfeConferir(det.id_nfe, { itens });
      showToast(
        r.divergente
          ? `NF lançada com divergência · ${fmtDataBR(r.data_entrega)}`
          : 'Recebimento OK � estoque atualizado',
        r.divergente ? 'warning' : 'success',
      );
      navigate('/estoque/mobile', { replace: true, state: { aba: 'nf' } });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao finalizar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const jaEntrou = !!det?.entrada_registrada;
  const itensNota = det?.itens || [];
  const totalPaginas = Math.max(1, Math.ceil(itensNota.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const itensPagina = itensNota.slice(
    paginaAtual * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA + ITENS_POR_PAGINA,
  );
  const temProxima = paginaAtual < totalPaginas - 1;
  const podeFinalizar = !jaEntrou && resumo.total > 0 && resumo.pend === 0;

  const irPagina = (proxima: number) => {
    const destino = Math.max(0, Math.min(totalPaginas - 1, proxima));
    setPagina(destino);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  /** Na última página o lançamento não sobe enquanto houver item sem visto ou X. */
  const irParaPendentes = () => {
    const idx = itensNota.findIndex((it) => checks[it.id_item]?.ok == null);
    if (idx < 0) return;
    irPagina(Math.floor(idx / ITENS_POR_PAGINA));
    const nomes = itensNota
      .filter((it) => checks[it.id_item]?.ok == null)
      .slice(0, 2)
      .map((it) => nomeItem(it));
    const resto = resumo.pend - nomes.length;
    const lista = resto > 0 ? `${nomes.join(', ')} e mais ${resto}` : nomes.join(', ');
    showToast(
      `A nota ainda não lança. Faltam ${resumo.pend} sem marca${lista ? `: ${lista}` : ''}. Toque no visto ou no X.`,
      'warning',
    );
  };

  const marcarTodosOk = () => {
    if (jaEntrou) return;
    setChecks((prev) => {
      const next: Record<number, ItemCheck> = {};
      for (const [k, c] of Object.entries(prev)) {
        next[Number(k)] = { ...c, ok: true, qtd_recebida: c.qtd_esperada };
      }
      return next;
    });
  };


  /** Um toque: mercadoria não chegou → sai da fila sem entrar estoque. */
  const marcarNotaNaoChegou = async () => {
    if (!det || det.entrada_registrada) return;
    const rotulo = det.numero || det.id_nfe;
    const ok = window.confirm(
      `Confirmar que a NF ${rotulo} não chegou na loja?\nNenhum item entra no estoque e a nota sai da fila.`,
    );
    if (!ok) return;
    setSalvando(true);
    try {
      await api.estoqueNfeConferir(det.id_nfe, { nenhum_chegou: true });
      showToast('NF marcada: mercadoria não chegou', 'warning');
      navigate('/estoque/mobile', { replace: true, state: { aba: 'nf' } });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao marcar NF', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const dialogDanfe = (
    <Dialog
      fullScreen
      open={!!danfeUrl}
      onClose={fecharDanfe}
      slotProps={{
        paper: { sx: { bgcolor: '#525659', display: 'flex', flexDirection: 'column', height: '100%' } },
      }}
    >
      <div className="ck-estoque-nfe__danfe-bar">
        <strong>DANFE</strong>
        <span>
          <IconButton aria-label="Abrir em nova aba" onClick={abrirDanfeFora} size="small">
            <OpenInNewIcon />
          </IconButton>
          <IconButton aria-label="Baixar PDF" onClick={baixarDanfe} size="small">
            <DownloadIcon />
          </IconButton>
          <IconButton aria-label="Fechar" onClick={fecharDanfe} size="small">
            <CloseIcon />
          </IconButton>
        </span>
      </div>
      {danfeUrl ? <iframe className="ck-estoque-nfe__danfe-frame" title="DANFE" src={danfeUrl} /> : null}
    </Dialog>
  );

  if (!idNfe || !Number.isFinite(idNfe)) {
    return <Navigate to="/estoque/mobile" replace state={{ aba: 'nf' }} />;
  }

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--nfe ck-estoque-hub--hero"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(ICONE_PWA)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img className="ck-estoque-hub__mark ck-estoque-hub__mark--hero" src={assetUrl(LOGO_GA_LOCKUP)} alt="Meridian Gestão Operacional" />
        </div>
        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>{det ? `NF ${det.numero || det.id_nfe}` : 'Nota fiscal'}</h1>
          </div>
          {det ? (
            <p className="ck-estoque-hub__nfe-sub">
              {rotuloFornecedor(det.fornecedor, det.emitente_nome)}
              {det.valor_total != null ? ` · ${fmtMoeda(det.valor_total)}` : ''}
            </p>
          ) : null}
        </div>
      </header>

      <div className="ck-estoque-hub__panel">
        {loading && !det ? (
          <>
            <LinearProgress
              sx={{
                my: 1,
                borderRadius: 1,
                bgcolor: '#333840',
                '& .MuiLinearProgress-bar': { bgcolor: '#0548d1' },
              }}
            />
            <p className="ck-estoque-hub__empty">Abrindo a nota…</p>
          </>
        ) : null}
        {!loading && !det ? <p className="ck-estoque-hub__empty">Nota fiscal não encontrada.</p> : null}
        {det ? (
          <>
            <div className="ck-estoque-hub__nfe-docs">
              <button
                type="button"
                disabled={abrindoDanfe}
                onClick={() => void abrirDanfe(det.id_nfe)}
              >
                <DescriptionOutlinedIcon />
                {abrindoDanfe ? 'Abrindo…' : 'Visualizar DANFE'}
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
            <div className="ck-estoque-hub__table ck-estoque-hub__table--head">
              <div className="ck-estoque-hub__cols">
                <span>Produto</span>
                <span>Qtd</span>
                <span>Estado</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="ck-estoque-hub__scroll" ref={scrollRef}>
        <div className="ck-estoque-hub__body ck-estoque-hub__body--scroll">
          {det ? (
            <div className="ck-estoque-hub__table ck-estoque-hub__table--body">
              <div className="ck-estoque-hub__lista">
                {jaEntrou ? (
                  <p className="ck-estoque-hub__entrada-feita">Entrada já feita. Esta nota não entra de novo.</p>
                ) : null}
                {det.fornecedor === 'sefaz' && !(det.itens || []).length && !jaEntrou ? (
                  <div className="ck-estoque-hub__empty">
                    <p>Esta nota ainda não tem o XML completo da Receita. Sem o XML não há produtos para dar entrada.</p>
                    <button type="button" disabled={loading} onClick={() => void carregarDetalhe(det.id_nfe, { avisoXml: true })}>
                      {loading ? 'Buscando…' : 'Tentar de novo'}
                    </button>
                  </div>
                ) : null}
                {totalPaginas > 1 ? (
                  <p className="ck-estoque-hub__nfe-pagina">
                    Página {paginaAtual + 1} de {totalPaginas}
                    {resumo.pend > 0 ? ` · faltam ${resumo.pend}` : ''}
                  </p>
                ) : null}
                {itensPagina.map((it) => {
                  const c = checks[it.id_item];
                  const esp = c?.qtd_esperada ?? qtdEsperada(it);
                  const rec = c?.qtd_recebida ?? esp;
                  const estado = c?.ok;
                  const parcial = ehParcial(c);
                  const semMatch = !it.id_insumo;
                  const und = unidadeEstoque(it);
                  const { linhaEmb } = rotuloQtd(it, rec, esp);
                  return (
                    <div
                      key={it.id_item}
                      className={`ck-estoque-hub__row${
                        estado == null && !jaEntrou
                          ? ' is-pend'
                          : estado === false
                            ? ' is-falta'
                            : parcial
                              ? ' is-parcial'
                              : ''
                      }`}
                    >
                      <span className="ck-estoque-hub__item">
                        <img
                          className="ck-estoque-hub__thumb"
                          src={assetUrl(
                            thumbInsumo({
                              codigo: it.codigo_nf || it.codigo_insumo,
                              descricao: it.descricao || it.descricao_insumo,
                            }),
                          )}
                          alt=""
                        />
                        <span className="ck-estoque-hub__copy">
                          <strong>{nomeItem(it)}</strong>
                          <small>
                            {it.codigo_nf || it.codigo_insumo || (semMatch ? 'Sem cadastro' : '')}
                            {semMatch && (it.codigo_nf || it.codigo_insumo) ? ' · não entra no estoque' : ''}
                            {parcial ? ` · parcial ${fmtQtd(rec)}/${fmtQtd(esp)}` : ''}
                          </small>
                        </span>
                      </span>
                      <span className="ck-estoque-hub__qtd ck-estoque-hub__qtd--nfe">
                        {jaEntrou ? (
                          <>
                            {rotuloQtd(it, rec, esp).linhaEstoque}
                            {linhaEmb ? <small>{linhaEmb}</small> : null}
                          </>
                        ) : (
                          <>
                            <label className="ck-estoque-hub__qtd-edit">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={esp}
                                step="any"
                                disabled={jaEntrou}
                                value={estado == null ? '' : String(rec)}
                                placeholder={fmtQtd(esp)}
                                aria-label={`Quantidade recebida (NF ${fmtQtd(esp)}${und ? ` ${und}` : ''})`}
                                onChange={(e) => alterarQtd(it.id_item, e.target.value)}
                                onFocus={() => {
                                  if (estado == null) marcar(it.id_item, true);
                                }}
                              />
                              <small>
                                de {fmtQtd(esp)}
                                {und ? ` ${und}` : ''}
                              </small>
                            </label>
                            {linhaEmb ? <small>{linhaEmb}</small> : null}
                          </>
                        )}
                      </span>
                      <span className="ck-estoque-hub__nfe-acoes">
                        <button
                          type="button"
                          className={`ck-estoque-hub__nfe-btn ck-estoque-hub__nfe-btn--ok${
                            estado === true && !parcial ? ' is-on' : ''
                          }${parcial ? ' is-parcial' : ''}`}
                          aria-label="Chegou tudo"
                          disabled={jaEntrou || (semMatch && esp <= 0)}
                          onClick={() => marcar(it.id_item, true)}
                        >
                          <CheckCircleOutlinedIcon />
                        </button>
                        <button
                          type="button"
                          className={`ck-estoque-hub__nfe-btn ck-estoque-hub__nfe-btn--no${
                            estado === false ? ' is-on' : ''
                          }`}
                          aria-label="N�o chegou"
                          disabled={jaEntrou}
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
          ) : null}
        </div>
      </div>

      {det ? (
        <div className="ck-estoque-hub__foot">
          {jaEntrou ? (
            <>
              <button type="button" onClick={voltarHubNf}>
                Voltar
              </button>
              {podeReabrirConferenciaNfe(getUsuario()) ? (
                <button type="button" disabled={salvando} onClick={() => setDlgDevolver(true)}>
                  Devolver à conferência
                </button>
              ) : (
                <button type="button" className="is-feita" disabled>
                  Entrada já feita
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="is-pri"
                disabled={salvando || (resumo.total === 0 && !temProxima)}
                onClick={() => {
                  if (podeFinalizar) {
                    void finalizar();
                    return;
                  }
                  if (temProxima) {
                    irPagina(paginaAtual + 1);
                    return;
                  }
                  irParaPendentes();
                }}
              >
                {salvando
                  ? 'Salvando…'
                  : podeFinalizar
                    ? resumo.parcial > 0
                      ? `Continuar (${resumo.ok + resumo.parcial}/${resumo.total} · ${resumo.parcial} parcial)`
                      : `Continuar (${resumo.ok}/${resumo.total})`
                    : temProxima
                      ? `Próxima página (${paginaAtual + 2}/${totalPaginas})`
                      : `Ver os ${resumo.pend} que faltam`}
              </button>
              <div className="ck-estoque-hub__foot-acoes">
                <button type="button" onClick={voltarHubNf}>
                  Voltar
                </button>
                {paginaAtual > 0 ? (
                  <button type="button" className="is-ghost" onClick={() => irPagina(paginaAtual - 1)}>
                    Anterior
                  </button>
                ) : null}
                <button type="button" className="is-ghost" disabled={salvando} onClick={marcarTodosOk}>
                  Todos OK
                </button>
                <button
                  type="button"
                  className="is-no"
                  disabled={salvando}
                  onClick={() => void marcarNotaNaoChegou()}
                >
                  Não chegou
                </button>
              </div>
            </>
          )}
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
      <Dialog
        open={dlgDevolver}
        onClose={() => !salvando && setDlgDevolver(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitleWithIcon plainIcon divider icon={<ReplayOutlinedIcon />}>
          Devolver à conferência
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2" color="text.secondary">
            A NF <strong>{det?.numero || det?.id_nfe}</strong> volta para a fila. As marcas de “não
            chegou” saem e o gestor confere de novo, item a item.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDlgDevolver(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={salvando || !det}
            onClick={() => {
              if (!det) return;
              setSalvando(true);
              api
                .estoqueNfeReabrirConferencia(det.id_nfe)
                .then(async () => {
                  showToast('NF devolvida à conferência', 'success');
                  setDlgDevolver(false);
                  await carregarDetalhe(det.id_nfe);
                })
                .catch((e) => showToast(e instanceof Error ? e.message : 'Não deu para devolver a NF', 'error'))
                .finally(() => setSalvando(false));
            }}
          >
            {salvando ? 'Devolvendo…' : 'Devolver'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
