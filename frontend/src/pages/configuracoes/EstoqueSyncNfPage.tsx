import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import {
  api,
  type EstoqueSyncFornecedor,
  type EstoqueSyncPainel,
  type Loja,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { portalPanelSx } from '../../theme/tokens';

function fmtQuando(iso: string | null | undefined) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function chipStatus(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok') return <Chip size="small" label="Puxou certo" color="success" />;
  if (s === 'rodando') return <Chip size="small" label="Puxando…" color="warning" />;
  if (s === 'parcial') return <Chip size="small" label="Parcial" color="warning" />;
  if (s === 'erro') return <Chip size="small" label="Falhou" color="error" />;
  return <Chip size="small" label="Ainda não puxou" variant="outlined" />;
}

const LABEL_FORN: Record<string, string> = {
  platlog: 'Platlog (eSupri)',
  coca: 'Coca-Cola (Conecta Brasal)',
};

export default function EstoqueSyncNfPage() {
  const [itens, setItens] = useState<EstoqueSyncFornecedor[]>([]);
  const [painel, setPainel] = useState<EstoqueSyncPainel | null>(null);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [agoraSp, setAgoraSp] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rodandoId, setRodandoId] = useState<number | null>(null);
  const [puxandoTodas, setPuxandoTodas] = useState(false);
  const [erro, setErro] = useState('');

  const [fornecedor, setFornecedor] = useState<'platlog' | 'coca'>('platlog');
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [ativo, setAtivo] = useState(false);
  const [horario, setHorario] = useState('06:00');
  const [limite, setLimite] = useState(20);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setErro('');
    try {
      const [sync, lojasResp] = await Promise.all([
        api.estoqueSyncFornecedorListar(),
        api.lojas(),
      ]);
      setItens(sync.itens || []);
      setPainel(sync.painel || null);
      setAgoraSp(sync.agora_sp || '');
      setLojas(lojasResp || []);
      if (!silencioso) {
        const plat = (sync.itens || []).find((i) => i.fornecedor === 'platlog');
        if (plat) {
          setFornecedor('platlog');
          setIdLoja(plat.id_loja);
          setAtivo(plat.ativo);
          setHorario(plat.horario || '06:00');
          setLimite(plat.limite || 20);
        } else if (lojasResp?.length) {
          const terraco = lojasResp.find(
            (l) => String(l.bk_number) === '30797' || /terra/i.test(l.name || ''),
          );
          if (terraco) setIdLoja(terraco.id_loja);
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const loteAndamento = Boolean(painel?.lote?.rodando || painel?.lote?.em_andamento);
  const algumRodando =
    loteAndamento ||
    puxandoTodas ||
    itens.some((i) => i.ultimo_status === 'rodando') ||
    rodandoId != null;

  useEffect(() => {
    if (!algumRodando) return undefined;
    const t = window.setInterval(() => void carregar(true), 4000);
    return () => window.clearInterval(t);
  }, [algumRodando, carregar]);

  const salvar = async () => {
    if (!idLoja) {
      showToast('Selecione a loja', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.estoqueSyncFornecedorSalvar({
        fornecedor,
        id_loja: Number(idLoja),
        ativo,
        horario,
        limite,
      });
      showToast('Configuração salva');
      await carregar(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const rodarAgora = async (id: number) => {
    setRodandoId(id);
    try {
      await api.estoqueSyncFornecedorRodar(id);
      showToast('Puxão iniciado · acompanhe o status');
      await carregar(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar sync', 'error');
      setRodandoId(null);
    }
  };

  const puxarTodas = async () => {
    setPuxandoTodas(true);
    try {
      await api.estoqueSyncFornecedorRodarTodas({ fornecedor: 'platlog' });
      showToast('Puxando NFs de todas as lojas · demora alguns minutos');
      await carregar(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao puxar todas', 'error');
      setPuxandoTodas(false);
    }
  };

  useEffect(() => {
    if (rodandoId == null) return;
    const ainda = itens.find((i) => i.id_sync === rodandoId);
    if (ainda && ainda.ultimo_status !== 'rodando') setRodandoId(null);
  }, [itens, rodandoId]);

  useEffect(() => {
    if (!puxandoTodas) return;
    if (painel?.lote && !painel.lote.rodando && painel.lote.fim) {
      setPuxandoTodas(false);
      if (painel.lote.lojas_erro === 0) {
        showToast(painel.lote.mensagem || 'Puxou corretamente');
      }
    }
  }, [painel, puxandoTodas]);

  const plat = painel?.platlog;
  const alertaSeverity =
    plat?.situacao === 'ok'
      ? 'success'
      : plat?.situacao === 'rodando'
        ? 'info'
        : plat?.situacao === 'erro'
          ? 'error'
          : plat?.situacao === 'parcial'
            ? 'warning'
            : 'info';

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sync NF · fornecedores
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Agenda diária (Brasília) e puxão manual. A nota entra no app para conferência; estoque só
          depois que a loja confirma o recebimento.
        </Typography>
        {agoraSp && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Agora em Brasília: {agoraSp}
          </Typography>
        )}
      </Box>

      {erro && <Alert severity="error">{erro}</Alert>}
      {loading && <LinearProgress />}

      <Paper sx={{ ...portalPanelSx, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Status do puxão
        </Typography>
        {plat && (
          <Alert severity={alertaSeverity} sx={{ mb: 1.5 }}>
            <strong>Platlog:</strong> {plat.texto}
            {plat.ultima ? ` · última ${fmtQuando(plat.ultima)}` : ''}
          </Alert>
        )}
        {(loteAndamento || puxandoTodas) && (
          <Box sx={{ mb: 1.5 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {painel?.lote?.mensagem || 'Puxando notas no eSupri…'}
              {painel?.lote?.lojas_total
                ? ` (${painel.lote.lojas_ok} ok · ${painel.lote.lojas_erro} erro)`
                : ''}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<CloudDownloadIcon />}
            disabled={loading || algumRodando}
            onClick={() => void puxarTodas()}
          >
            Puxar todas as NFs agora
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => void carregar()} disabled={loading}>
            Atualizar status
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ ...portalPanelSx, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Configurar agenda
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1.4fr 0.8fr 0.7fr auto' },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Fornecedor</InputLabel>
            <Select
              label="Fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value as 'platlog' | 'coca')}
            >
              <MenuItem value="platlog">Platlog (eSupri)</MenuItem>
              <MenuItem value="coca">Coca-Cola (Conecta Brasal)</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Loja</InputLabel>
            <Select
              label="Loja"
              value={idLoja}
              onChange={(e) => setIdLoja(Number(e.target.value))}
            >
              {lojas.map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {l.name}
                  {l.bk_number ? ` (${l.bk_number})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Horário (HH:MM)"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { step: 300 },
            }}
          />
          <TextField
            size="small"
            label="Limite NFs"
            type="number"
            value={limite}
            onChange={(e) => setLimite(Number(e.target.value) || 20)}
            slotProps={{ htmlInput: { min: 1, max: 200 } }}
          />
          <FormControlLabel
            control={<Switch checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />}
            label="Ativo"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            disabled={salvando || loading}
            onClick={() => void salvar()}
          >
            Salvar
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ ...portalPanelSx, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Por loja
        </Typography>
        {!itens.length && !loading && (
          <Typography color="text.secondary">Nenhuma configuração salva ainda.</Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {itens.map((i) => (
            <Box
              key={i.id_sync}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {LABEL_FORN[i.fornecedor] || i.fornecedor}
                </Typography>
                <Chip
                  size="small"
                  label={i.ativo ? `Agenda ${i.horario}` : `Inativo · ${i.horario}`}
                  color={i.ativo ? 'primary' : 'default'}
                  variant={i.ativo ? 'filled' : 'outlined'}
                />
                {chipStatus(i.ultimo_status)}
                <Chip
                  size="small"
                  label={`${Number(i.nfes_total) || 0} NFs no app`}
                  variant="outlined"
                />
                {!i.credenciais_ok && (
                  <Chip size="small" label="Credenciais ausentes" color="error" variant="outlined" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {i.loja_nome}
                {i.loja_codigo ? ` · BK ${i.loja_codigo}` : ''} · até {i.limite} NFs/puxão
              </Typography>
              <Typography variant="body2">
                Último puxão: {fmtQuando(i.ultimo_fim || i.ultimo_inicio)}
                {i.ultima_execucao_dia
                  ? ` · dia ${i.ultima_execucao_dia.split('-').reverse().join('/')}`
                  : ''}
              </Typography>
              {i.ultimo_resumo && (
                <Typography variant="caption" color="text.secondary">
                  Na última: {Number(i.ultimo_resumo.baixadas) || 0} baixadas ·{' '}
                  {Number(i.ultimo_resumo.aplicadas) || 0} novas no app
                  {i.ultimo_resumo.erros ? ` · ${i.ultimo_resumo.erros} erro(s)` : ''}
                </Typography>
              )}
              {i.ultimo_erro && (
                <Alert severity="error" sx={{ py: 0 }}>
                  {i.ultimo_erro}
                </Alert>
              )}
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  disabled={!i.credenciais_ok || algumRodando || rodandoId === i.id_sync}
                  onClick={() => void rodarAgora(i.id_sync)}
                >
                  Puxar só esta loja
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
