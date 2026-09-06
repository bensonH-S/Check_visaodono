import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api, type EstoqueSaudeBaixa } from '../../api/client';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

function fmtData(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(v));
  } catch {
    return String(v);
  }
}

function Kpi({
  titulo,
  valor,
  detalhe,
  tom,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: string;
  tom?: 'ok' | 'ruim' | 'neutro';
}) {
  const border =
    tom === 'ok' ? 'rgba(18, 120, 70, 0.35)' : tom === 'ruim' ? 'rgba(180, 35, 24, 0.35)' : colors.border;
  const valorCor = tom === 'ok' ? '#127846' : tom === 'ruim' ? '#B42318' : colors.textPrimary;
  return (
    <Box
      sx={{
        flex: '1 1 140px',
        minWidth: 130,
        border: `1px solid ${border}`,
        borderRadius: 1.5,
        px: 1.5,
        py: 1.25,
        bgcolor: colors.surface,
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', color: colors.textSecondary, fontWeight: 600 }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: '1.55rem', fontWeight: 800, color: valorCor, lineHeight: 1.2 }}>
        {valor}
      </Typography>
      {detalhe ? (
        <Typography sx={{ fontSize: '0.7rem', color: colors.textMuted, mt: 0.25 }}>{detalhe}</Typography>
      ) : null}
    </Box>
  );
}

/**
 * Aba Baixa: relatório para o gestor entender sozinho o que travou e o que fazer.
 * Substitui a auditoria técnica do piloto.
 */
export default function EstoquePilotoAuditoriaPanel({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [escopo, setEscopo] = useState<'loja' | 'rede'>('loja');
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
      showToast(e instanceof Error ? e.message : 'Erro ao carregar saúde da baixa', 'error');
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

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const r = data?.resumo;
  const taxa = r?.taxa_processada_pct;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ maxWidth: 720 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: colors.textPrimary }}>
            Saúde da baixa (venda → estoque)
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mt: 0.35 }}>
            Aqui você vê o que baixou certo e o que falta resolver. Sem jargão técnico.
            {data?.janela?.previsto_fim
              ? ` Janela até ${fmtData(data.janela.previsto_fim)}.`
              : ''}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<FileDownloadOutlinedIcon />}
          disabled={baixando}
          onClick={() => void baixar()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {baixando ? 'Gerando…' : 'Baixar Excel'}
        </Button>
      </Box>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label="Esta loja"
          onClick={() => setEscopo('loja')}
          variant={escopo === 'loja' ? 'filled' : 'outlined'}
          sx={{ height: 26, fontWeight: escopo === 'loja' ? 700 : 500 }}
        />
        <Chip
          size="small"
          label="Rede inteira"
          onClick={() => setEscopo('rede')}
          variant={escopo === 'rede' ? 'filled' : 'outlined'}
          sx={{ height: 26, fontWeight: escopo === 'rede' ? 700 : 500 }}
        />
        <Chip
          size="small"
          label={data?.piloto_desligado ? 'Baixa total ligada' : 'Ainda em modo piloto'}
          sx={{
            height: 26,
            fontWeight: 700,
            bgcolor: data?.piloto_desligado ? 'rgba(18,120,70,0.12)' : 'rgba(180,35,24,0.1)',
            color: data?.piloto_desligado ? '#127846' : '#B42318',
          }}
        />
        <Chip
          size="small"
          label={`Desde ${fmtData(data?.janela?.desde)}`}
          variant="outlined"
          sx={{ height: 26 }}
        />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Kpi
          titulo="Baixou certo"
          valor={r?.processada ?? 0}
          detalhe={taxa != null ? `${taxa}% das vendas` : 'vendas processadas'}
          tom="ok"
        />
        <Kpi
          titulo="Baixou pela metade"
          valor={r?.parcial ?? 0}
          detalhe="faltou algum insumo"
          tom={(r?.parcial ?? 0) > 0 ? 'ruim' : 'neutro'}
        />
        <Kpi
          titulo="Não baixou"
          valor={r?.erro ?? 0}
          detalhe="venda com erro"
          tom={(r?.erro ?? 0) > 0 ? 'ruim' : 'neutro'}
        />
        <Kpi
          titulo="Sem ficha"
          valor={r?.sem_ficha ?? 0}
          detalhe="produto sem receita"
          tom={(r?.sem_ficha ?? 0) > 0 ? 'ruim' : 'neutro'}
        />
        <Kpi
          titulo="Falhas registradas"
          valor={r?.pendencias ?? 0}
          detalhe="desde o início da janela"
          tom={(r?.pendencias ?? 0) > 0 ? 'ruim' : 'ok'}
        />
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, mb: 0.75 }}>
          O que resolver (prioridade)
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, mb: 1 }}>
          Cada linha = um insumo que a venda pediu e o sistema não conseguiu tirar do estoque.
        </Typography>
        {!data?.problemas?.length ? (
          <Typography sx={{ color: colors.textMuted, fontSize: '0.85rem', py: 2 }}>
            Nenhum problema na janela ainda. Quando aparecer falha, entra aqui com o que fazer.
          </Typography>
        ) : (
          <TableContainer sx={{ ...tableContainerSx, ...tablePaperSx, maxHeight: 360 }}>
            <Table stickyHeader size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  {['Código', 'Insumo', 'Problema', 'O que fazer', 'Vezes', escopo === 'rede' ? 'Lojas' : null]
                    .filter(Boolean)
                    .map((h) => (
                      <TableCell key={h!} sx={{ fontWeight: 700, fontSize: '0.68rem', color: colors.textSecondary }}>
                        {h}
                      </TableCell>
                    ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.problemas.map((p) => (
                  <TableRow key={`${p.codigo}-${p.motivo}`} hover>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {p.codigo}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', maxWidth: 220 }}>{p.nome}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', maxWidth: 260, color: '#B42318', fontWeight: 600 }}>
                      {p.problema}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', maxWidth: 280 }}>{p.o_que_fazer}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.vezes}</TableCell>
                    {escopo === 'rede' ? (
                      <TableCell sx={{ fontSize: '0.8rem' }}>{p.lojas}</TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, mb: 0.75 }}>
          Últimas vendas com problema
        </Typography>
        {!data?.vendas_com_problema?.length ? (
          <Typography sx={{ color: colors.textMuted, fontSize: '0.85rem' }}>Nenhuma nesta janela.</Typography>
        ) : (
          <TableContainer sx={{ ...tableContainerSx, ...tablePaperSx, flex: 1 }}>
            <Table stickyHeader size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  {['Data', 'Venda', escopo === 'rede' ? 'Loja' : null, 'Status', 'Erro']
                    .filter(Boolean)
                    .map((h) => (
                      <TableCell key={h!} sx={{ fontWeight: 700, fontSize: '0.68rem', color: colors.textSecondary }}>
                        {h}
                      </TableCell>
                    ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.vendas_com_problema.map((v) => (
                  <TableRow key={`${v.id_loja}-${v.id_venda}`} hover>
                    <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{v.data_venda}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>#{v.id_venda}</TableCell>
                    {escopo === 'rede' ? (
                      <TableCell sx={{ fontSize: '0.78rem' }}>{v.id_loja}</TableCell>
                    ) : null}
                    <TableCell sx={{ fontSize: '0.75rem' }}>
                      <Chip
                        size="small"
                        label={v.status === 'parcial' ? 'Parcial' : 'Erro'}
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(180,35,24,0.1)',
                          color: '#B42318',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                      {v.erros || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}
