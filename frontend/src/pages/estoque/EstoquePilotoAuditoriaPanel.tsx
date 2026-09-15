import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api, type EstoqueSaudeBaixa } from '../../api/client';
import { showToast } from '../../utils/toast';
import { colors, radius, shadows } from '../../theme/tokens';

const OK = '#127846';
const RUIM = '#B42318';
const ALERTA = '#C2410C';

type ListaAbaixo = 'insumos' | 'vendas' | 'desperdicio';

const MOTIVO: Record<string, { titulo: string; texto: string }> = {
  INSUMO_NAO_CADASTRADO: {
    titulo: 'Não está no cadastro da loja',
    texto: 'A receita pede este item, mas ele não existe ou está desligado aqui.',
  },
  CONVERSAO_NAO_VALIDADA: {
    titulo: 'Receita e estoque usam unidade diferente',
    texto: 'A ficha fala em unidade e o estoque conta em kg (ou o contrário). Sem essa conta o item não sai do saldo.',
  },
  CONVERSAO_BLOQUEADA: {
    titulo: 'Conversão bloqueada',
    texto: 'Alguém bloqueou de propósito a conta entre a receita e o estoque.',
  },
  QUANTIDADE_INVALIDA: {
    titulo: 'Quantidade estranha na receita',
    texto: 'A ficha ou a venda veio com quantidade que o sistema não consegue usar.',
  },
  FORA_PILOTO: {
    titulo: 'Item ainda fora do teste',
    texto: 'Este item ainda não entra na baixa automática.',
  },
};

const toggleSx = {
  bgcolor: colors.canvasAlt,
  borderRadius: 2,
  p: 0.3,
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    borderRadius: '8px !important',
    px: 1.2,
    py: 0.4,
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.75rem',
    color: colors.textSecondary,
    '&.Mui-selected': {
      bgcolor: colors.surface,
      color: colors.textPrimary,
      boxShadow: shadows.sm,
      '&:hover': { bgcolor: colors.surface },
    },
  },
} as const;

function fmtPeriodo(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(v));
  } catch {
    return String(v);
  }
}

function fmtDia(v: string | null | undefined) {
  if (!v) return '—';
  const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  return fmtPeriodo(v);
}

function fraseErroVenda(texto: string | null | undefined) {
  const t = String(texto || '').toLowerCase();
  if (t.includes('ficha')) return 'Produto vendido sem receita';
  if (t.includes('convers')) return 'Unidade da receita não bate com o estoque';
  if (t.includes('cadastr')) return 'Insumo sem cadastro na loja';
  return texto || 'Não conseguiu baixar o estoque';
}

function rotuloBreak(tipo: string | null | undefined) {
  const t = String(tipo || '');
  if (t.includes('desperdicio')) return 'Desperdício';
  if (t.includes('break')) return 'Break';
  return t || 'Lançamento';
}

function cardSx(destaque?: boolean) {
  return {
    border: `1px solid ${destaque ? 'rgba(180,35,24,0.28)' : colors.border}`,
    borderRadius: `${radius.lg}px`,
    bgcolor: colors.surface,
    boxShadow: shadows.sm,
  } as const;
}

/**
 * Aba Baixa: venda deveria tirar insumo do estoque. Aqui o gestor vê se isso aconteceu.
 */
export default function EstoquePilotoAuditoriaPanel({
  idLoja,
  onSetHeaderActions,
  onIrFichas,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
  onIrFichas?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [escopo, setEscopo] = useState<'loja' | 'rede'>('loja');
  const [lista, setLista] = useState<ListaAbaixo>('insumos');
  const [data, setData] = useState<EstoqueSaudeBaixa | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.estoqueSaudeBaixa({
        idLoja: escopo === 'loja' ? idLoja : undefined,
        escopo,
      });
      setData(r);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar a baixa', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, escopo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const baixar = useCallback(async () => {
    setBaixando(true);
    try {
      await api.estoqueBaixarSaudeBaixa({
        idLoja: escopo === 'loja' ? idLoja : undefined,
        escopo,
      });
      showToast('Planilha baixada', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao baixar Excel', 'error');
    } finally {
      setBaixando(false);
    }
  }, [idLoja, escopo]);

  useEffect(() => {
    onSetHeaderActions?.(
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" aria-label="Atualizar" onClick={() => void carregar()}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" aria-label="Baixar Excel" disabled={baixando} onClick={() => void baixar()}>
          <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>,
    );
    return () => onSetHeaderActions?.(null);
  }, [carregar, baixar, baixando, onSetHeaderActions]);

  const r = data?.resumo;
  const totalVendas = (r?.processada ?? 0) + (r?.parcial ?? 0) + (r?.erro ?? 0) + (r?.pendente ?? 0);
  const incompletas = (r?.parcial ?? 0) + (r?.erro ?? 0);
  const semReceita = r?.sem_ficha ?? 0;
  const problemas = data?.problemas ?? [];
  const vendasRuim = data?.vendas_com_problema ?? [];
  const breaksAviso = data?.breaks_com_aviso ?? [];
  const taxa = r?.taxa_processada_pct;

  const fraseHero = useMemo(() => {
    if (taxa == null || !totalVendas) return 'Ainda não tem venda nesta janela para julgar a baixa.';
    if (taxa >= 80) return `Quase tudo certo: ${taxa}% das vendas já tiraram o insumo do estoque.`;
    if (taxa >= 40) return `A baixa está pela metade: só ${taxa}% das vendas fecharam o estoque.`;
    return `A venda está passando e o estoque quase não acompanha: só ${taxa}% baixou até o fim.`;
  }, [taxa, totalVendas]);

  useEffect(() => {
    if (lista === 'vendas' && !vendasRuim.length) setLista('insumos');
    if (lista === 'desperdicio' && !breaksAviso.length) setLista('insumos');
  }, [lista, vendasRuim.length, breaksAviso.length]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={escopo}
          onChange={(_e, v: 'loja' | 'rede' | null) => {
            if (v) setEscopo(v);
          }}
          sx={toggleSx}
        >
          <ToggleButton value="loja">Esta loja</ToggleButton>
          <ToggleButton value="rede">Rede</ToggleButton>
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
          {fmtPeriodo(data?.janela?.desde)}
          {data?.janela?.previsto_fim ? ` a ${fmtPeriodo(data.janela.previsto_fim)}` : ''}
          {escopo === 'loja' ? ' · quando a loja vende, o estoque deveria cair' : ' · mesma leitura em todas as lojas'}
        </Typography>
      </Box>

      <Paper sx={{ ...cardSx(taxa != null && taxa < 40), flexShrink: 0, px: 2, py: 1.5 }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: colors.textPrimary, lineHeight: 1.35, maxWidth: 720 }}>
          {fraseHero}
        </Typography>
        <Box sx={{ mt: 1, height: 6, bgcolor: colors.canvasAlt, borderRadius: 1, overflow: 'hidden', maxWidth: 420 }}>
          <Box
            sx={{
              width: `${Math.max(0, Math.min(100, taxa ?? 0))}%`,
              height: '100%',
              bgcolor: taxa == null || taxa < 40 ? RUIM : taxa < 80 ? ALERTA : OK,
            }}
          />
        </Box>
        {!data?.piloto_desligado ? (
          <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mt: 0.85 }}>
            Ainda em teste: nem todo item da loja entra nessa baixa.
          </Typography>
        ) : null}
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
          flexShrink: 0,
        }}
      >
        <ResumoCard
          n={r?.processada ?? 0}
          titulo="Estoque acompanhou a venda"
          texto={totalVendas ? `de ${totalVendas} vendas` : 'vendas que baixaram tudo'}
          tom="ok"
        />
        <ResumoCard
          n={incompletas}
          titulo="Baixou só uma parte"
          texto="Tirou alguns insumos e deixou outros"
          tom={incompletas > 0 ? 'ruim' : 'neutro'}
        />
        <ResumoCard
          n={semReceita}
          titulo="Vendeu sem receita"
          texto="O sistema não sabe o que tirar do estoque"
          tom={semReceita > 0 ? 'ruim' : 'neutro'}
          acao={semReceita > 0 && onIrFichas ? { label: 'Abrir cadastro', onClick: onIrFichas } : undefined}
        />
      </Box>

      <Paper sx={{ ...cardSx(), flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box
          sx={{
            px: 1.5,
            pt: 1.15,
            pb: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={lista}
            onChange={(_e, v: ListaAbaixo | null) => {
              if (v) setLista(v);
            }}
            sx={toggleSx}
          >
            <ToggleButton value="insumos">O que corrigir ({problemas.length})</ToggleButton>
            {vendasRuim.length ? (
              <ToggleButton value="vendas">Vendas incompletas ({vendasRuim.length})</ToggleButton>
            ) : null}
            {breaksAviso.length ? (
              <ToggleButton value="desperdicio">Desperdício sem baixa ({breaksAviso.length})</ToggleButton>
            ) : null}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.5, pb: 1.5 }}>
          {lista === 'insumos' && !problemas.length ? (
            <Vazio>Nenhum insumo travando a baixa nesta janela.</Vazio>
          ) : null}

          {lista === 'insumos'
            ? problemas.map((p) => {
                const info = MOTIVO[p.motivo] || {
                  titulo: p.problema,
                  texto: p.o_que_fazer,
                };
                return (
                  <Box
                    key={`${p.codigo}-${p.motivo}`}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      py: 1.15,
                      borderBottom: `1px solid ${colors.border}`,
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.84rem', fontWeight: 800, color: colors.textPrimary }}>
                        {p.nome}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, fontFamily: 'ui-monospace, monospace' }}>
                        {p.codigo}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: RUIM, mt: 0.45 }}>
                        {info.titulo}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, mt: 0.2, maxWidth: 560 }}>
                        {info.texto}
                      </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: colors.textPrimary, lineHeight: 1 }}>
                        {p.vezes}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: colors.textMuted, fontWeight: 600 }}>
                        {escopo === 'rede' ? `${p.lojas} lojas` : 'vezes'}
                      </Typography>
                      {onIrFichas ? (
                        <Button
                          size="small"
                          onClick={onIrFichas}
                          sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1 }}
                        >
                          Abrir cadastro
                        </Button>
                      ) : null}
                    </Box>
                  </Box>
                );
              })
            : null}

          {lista === 'vendas'
            ? vendasRuim.map((v) => (
                <Box
                  key={`${v.id_loja}-${v.id_venda}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 1,
                    borderBottom: `1px solid ${colors.border}`,
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      Venda #{v.id_venda}
                      {escopo === 'rede' ? ` · loja ${v.id_loja}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                      {fraseErroVenda(v.erros)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                    {fmtDia(v.data_venda)}
                  </Typography>
                </Box>
              ))
            : null}

          {lista === 'desperdicio'
            ? breaksAviso.map((b) => (
                <Box
                  key={b.id_break}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 1,
                    borderBottom: `1px solid ${colors.border}`,
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      {rotuloBreak(b.tipo)} #{b.id_break}
                      {escopo === 'rede' ? ` · loja ${b.id_loja}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                      {fraseErroVenda((b.avisos && b.avisos[0]) || b.avisos_texto)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                    {fmtDia(b.data_break)}
                  </Typography>
                </Box>
              ))
            : null}
        </Box>
      </Paper>
    </Box>
  );
}

function ResumoCard({
  n,
  titulo,
  texto,
  tom,
  acao,
}: {
  n: number;
  titulo: string;
  texto: string;
  tom: 'ok' | 'ruim' | 'neutro';
  acao?: { label: string; onClick: () => void };
}) {
  const cor = tom === 'ok' ? OK : tom === 'ruim' ? RUIM : colors.textPrimary;
  return (
    <Paper sx={{ ...cardSx(tom === 'ruim' && n > 0), px: 1.5, py: 1.25 }}>
      <Typography sx={{ fontSize: '1.55rem', fontWeight: 800, color: cor, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {n}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: colors.textPrimary, mt: 0.55 }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mt: 0.2 }}>{texto}</Typography>
      {acao ? (
        <Button
          size="small"
          onClick={acao.onClick}
          sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 0 }}
        >
          {acao.label}
        </Button>
      ) : null}
    </Paper>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ color: colors.textMuted, fontSize: '0.8rem', py: 3, textAlign: 'center' }}>
      {children}
    </Typography>
  );
}
