import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  api,
  type EstoqueSyncFornecedor,
  type EstoqueSyncPainel,
  type EstoqueSyncPainelFornecedor,
  type Loja,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import {
  tableContainerSx,
  tablePageLayoutSx,
  tablePaperSx,
  tableSx,
} from '../../utils/tablePageLayout';

type FornecedorCodigo = 'platlog' | 'coca' | 'cokenet' | 'idealwork' | 'gimba';

const FORNECEDORES: Array<{
  codigo: FornecedorCodigo;
  nome: string;
  portal: string;
  soPedido?: boolean;
}> = [
  { codigo: 'platlog', nome: 'Platlog', portal: 'eSupri' },
  { codigo: 'coca', nome: 'Coca-Cola', portal: 'Conecta Brasal' },
  { codigo: 'cokenet', nome: 'Coke.Net', portal: 'Pedido', soPedido: true },
  { codigo: 'idealwork', nome: 'Ideal Work', portal: 'Workexpress' },
  { codigo: 'gimba', nome: 'Gimba', portal: 'Gimba' },
];

const HINT_LOGIN: Record<FornecedorCodigo, string> = {
  platlog: 'Conta da rede (VERONICA) já cobre as lojas. Só preencha se a unidade tiver login próprio no eSupri.',
  coca: 'NF: CNPJ + senha do Conecta Brasal (conectabrasal.com.br).',
  cokenet: 'E-mail e senha do Coke.Net (coke.net/BRASAL). O Alvim usa este login para pedir.',
  idealwork: 'Login do Workexpress BK (loja.workexpress.com.br/bk).',
  gimba: 'E-mail e senha do portal corporativo gimbaempresas.com.br.',
};

function nomeLojaCurto(nome: string) {
  return nome.replace(/^burger\s*king\s*[-–—]?\s*/i, '').trim() || nome;
}

function fmtQuando(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TomCelula = 'ok' | 'off' | 'run' | 'err' | 'empty';

function erroLoginPortalErrado(erro?: string | null) {
  const t = String(erro || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return t.includes('validacao de registro');
}

function tomDaCelula(item: EstoqueSyncFornecedor | undefined, puxando: boolean): TomCelula {
  if (puxando) return 'run';
  if (!item) return 'empty';
  if (!item.credenciais_ok || erroLoginPortalErrado(item.ultimo_erro)) return 'off';
  if (item.ultimo_status === 'erro') return 'err';
  if (item.ultimo_status === 'rodando') return 'run';
  if (item.credenciais_ok) return 'ok';
  return 'empty';
}

const TOM: Record<TomCelula, { bg: string; fg: string; title: string }> = {
  ok: { bg: 'rgba(27, 122, 74, 0.10)', fg: '#1B7A4A', title: 'Conectada' },
  off: { bg: 'rgba(180, 35, 24, 0.08)', fg: '#B42318', title: 'Sem login' },
  run: { bg: 'rgba(232, 82, 10, 0.12)', fg: '#E8520A', title: 'Puxando' },
  err: { bg: 'rgba(180, 35, 24, 0.10)', fg: '#B42318', title: 'Falhou' },
  empty: { bg: 'transparent', fg: 'text.disabled', title: '—' },
};

export default function EstoqueSyncNfPage() {
  const [itens, setItens] = useState<EstoqueSyncFornecedor[]>([]);
  const [painel, setPainel] = useState<EstoqueSyncPainel | null>(null);
  const [lojasCadastro, setLojasCadastro] = useState<Loja[]>([]);
  const [agoraSp, setAgoraSp] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rodandoId, setRodandoId] = useState<number | null>(null);
  const [puxandoForn, setPuxandoForn] = useState<FornecedorCodigo | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [dialog, setDialog] = useState<{
    fornecedor: FornecedorCodigo;
    idLoja: number;
    item?: EstoqueSyncFornecedor;
  } | null>(null);
  const [form, setForm] = useState({
    ativo: true,
    horario: '06:00',
    limite: 20,
    usuario: '',
    senha: '',
  });

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
      setLojasCadastro(lojasResp || []);
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
    puxandoForn != null ||
    itens.some((i) => i.ultimo_status === 'rodando') ||
    rodandoId != null;

  useEffect(() => {
    if (!algumRodando) return undefined;
    const t = window.setInterval(() => void carregar(true), 4000);
    return () => window.clearInterval(t);
  }, [algumRodando, carregar]);

  useEffect(() => {
    if (rodandoId == null) return;
    const ainda = itens.find((i) => i.id_sync === rodandoId);
    if (ainda && ainda.ultimo_status !== 'rodando') setRodandoId(null);
  }, [itens, rodandoId]);

  useEffect(() => {
    if (!puxandoForn) return;
    const lote = painel?.lote;
    if (lote && lote.fornecedor === puxandoForn && !lote.rodando && lote.fim) {
      setPuxandoForn(null);
      if (lote.lojas_erro === 0) showToast(lote.mensagem || 'Puxou corretamente');
    }
  }, [painel, puxandoForn]);

  const porChave = useMemo(() => {
    const mapa = new Map<string, EstoqueSyncFornecedor>();
    for (const item of itens) mapa.set(`${item.fornecedor}:${item.id_loja}`, item);
    return mapa;
  }, [itens]);

  const lojas = useMemo(() => {
    const mapa = new Map<number, { id_loja: number; nome: string; codigo: string }>();
    for (const l of lojasCadastro) {
      if (l.is_active === false) continue;
      if (String(l.bk_number || '') === '15022') continue;
      if (/popeyes|popyes/i.test(l.name || '')) continue;
      mapa.set(l.id_loja, {
        id_loja: l.id_loja,
        nome: l.name,
        codigo: l.bk_number || '',
      });
    }
    for (const item of itens) {
      if (mapa.has(item.id_loja)) continue;
      if (String(item.loja_codigo || '') === '15022') continue;
      if (/popeyes|popyes/i.test(item.loja_nome || '')) continue;
      mapa.set(item.id_loja, {
        id_loja: item.id_loja,
        nome: item.loja_nome || `Loja ${item.id_loja}`,
        codigo: item.loja_codigo || '',
      });
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itens, lojasCadastro]);

  const lojasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter(
      (l) => l.nome.toLowerCase().includes(q) || String(l.codigo).includes(q),
    );
  }, [busca, lojas]);

  function itemDe(forn: FornecedorCodigo, idLoja: number) {
    return porChave.get(`${forn}:${idLoja}`);
  }

  function puxandoCelula(forn: FornecedorCodigo, idLoja: number, item?: EstoqueSyncFornecedor) {
    return (
      item?.ultimo_status === 'rodando' ||
      (Boolean(painel?.lote?.rodando && painel.lote.fornecedor === forn) &&
        painel?.lote?.loja_atual === idLoja)
    );
  }

  function abrirDialog(fornecedor: FornecedorCodigo, idLoja: number, item?: EstoqueSyncFornecedor) {
    setDialog({ fornecedor, idLoja, item });
    setForm({
      ativo: item?.ativo ?? true,
      horario: item?.horario || '06:00',
      limite: item?.limite || 20,
      usuario: item?.usuario || '',
      senha: '',
    });
  }

  const salvar = async () => {
    if (!dialog) return;
    if (form.senha.trim() && !form.usuario.trim()) {
      showToast('Informe o usuário junto com a senha', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.estoqueSyncFornecedorSalvar({
        fornecedor: dialog.fornecedor,
        id_loja: dialog.idLoja,
        ativo: form.ativo,
        horario: form.horario,
        limite: form.limite,
        usuario: form.usuario,
        senha: form.senha,
      });
      showToast(
        dialog.fornecedor === 'cokenet'
          ? form.senha.trim()
            ? 'Login Coke.Net salvo'
            : 'Coke.Net atualizado'
          : form.senha.trim()
            ? 'Login e agenda salvos'
            : 'Agenda salva',
      );
      setDialog(null);
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
      showToast('Puxão iniciado');
      await carregar(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar', 'error');
      setRodandoId(null);
    }
  };

  const puxarTodas = async (codigo: Exclude<FornecedorCodigo, 'cokenet'>) => {
    setPuxandoForn(codigo);
    try {
      await api.estoqueSyncFornecedorRodarTodas({ fornecedor: codigo });
      showToast(`Puxando NFs · ${FORNECEDORES.find((f) => f.codigo === codigo)?.nome}`);
      await carregar(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao puxar', 'error');
      setPuxandoForn(null);
    }
  };

  const lojaDialog = dialog
    ? lojas.find((l) => l.id_loja === dialog.idLoja)
    : null;

  return (
    <Box sx={{ ...tablePageLayoutSx, p: { xs: 1.5, md: 2 }, gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Sync NF</Typography>
          {agoraSp ? (
            <Typography variant="caption" color="text.secondary">
              {agoraSp}
            </Typography>
          ) : null}
        </Box>
        <TextField
          size="small"
          placeholder="Buscar loja"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ width: 220 }}
        />
        <IconButton onClick={() => void carregar()} disabled={loading} size="small">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {erro ? <Alert severity="error">{erro}</Alert> : null}
      {loading ? <LinearProgress sx={{ flexShrink: 0 }} /> : null}

      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader sx={{ ...tableSx, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 180, fontWeight: 800 }}>Loja</TableCell>
                {FORNECEDORES.map((cat) => {
                  const resumo = painel?.[cat.codigo] as EstoqueSyncPainelFornecedor | undefined;
                  const conexao = resumo?.conexao;
                  const puxando =
                    Boolean(painel?.lote?.rodando && painel.lote.fornecedor === cat.codigo) ||
                    puxandoForn === cat.codigo;
                  const temAtiva = itens.some(
                    (i) =>
                      i.fornecedor === cat.codigo &&
                      i.ativo &&
                      i.credenciais_ok &&
                      !erroLoginPortalErrado(i.ultimo_erro),
                  );
                  const totalLogin = conexao
                    ? conexao.lojas_com_login + conexao.lojas_sem_login
                    : 0;
                  return (
                    <TableCell key={cat.codigo} sx={{ py: 1.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{cat.nome}</Typography>
                          <Typography variant="caption" color={puxando ? '#E8520A' : 'text.secondary'}>
                            {puxando
                              ? painel?.lote?.mensagem || 'Puxando'
                              : conexao
                                ? `${conexao.lojas_com_login}/${totalLogin}`
                                : cat.portal}
                          </Typography>
                        </Box>
                        {cat.soPedido ? null : (
                          <IconButton
                            size="small"
                            disabled={loading || algumRodando || !temAtiva}
                            onClick={() => void puxarTodas(cat.codigo as Exclude<FornecedorCodigo, 'cokenet'>)}
                            title={`Puxar ${cat.nome}`}
                          >
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {lojasFiltradas.map((loja) => (
                <TableRow key={loja.id_loja} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.25 }}>
                      {nomeLojaCurto(loja.nome)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {loja.codigo ? `BK ${loja.codigo}` : `Loja ${loja.id_loja}`}
                    </Typography>
                  </TableCell>
                  {FORNECEDORES.map((cat) => {
                    const item = itemDe(cat.codigo, loja.id_loja);
                    const puxando = puxandoCelula(cat.codigo, loja.id_loja, item);
                    const tom = tomDaCelula(item, puxando);
                    const visual = TOM[tom];
                    const soPedido = Boolean(cat.soPedido || item?.so_pedido);
                    const semLogin =
                      !item ||
                      !item.credenciais_ok ||
                      erroLoginPortalErrado(item.ultimo_erro);
                    const detalhe = puxando
                      ? ''
                      : semLogin
                        ? ''
                        : soPedido
                          ? item?.usuario || ''
                          : item?.nfes_total
                            ? `${item.nfes_total} NFs`
                            : textoUltimo(item);

                    return (
                      <TableCell key={cat.codigo} sx={{ py: 1, px: 1 }}>
                        <Box
                          onClick={() => abrirDialog(cat.codigo, loja.id_loja, item)}
                          sx={{
                            bgcolor: visual.bg,
                            borderRadius: 1.5,
                            px: 1.5,
                            py: 1.25,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 0.75,
                            minHeight: 56,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: visual.fg }}>
                              {puxando ? 'Puxando' : visual.title}
                            </Typography>
                            {detalhe ? (
                              <Typography
                                variant="caption"
                                color={tom === 'err' ? 'error' : 'text.secondary'}
                                sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {item?.credenciais_ok && item.ultimo_erro && !erroLoginPortalErrado(item.ultimo_erro)
                                  ? item.ultimo_erro
                                  : detalhe}
                              </Typography>
                            ) : null}
                          </Box>
                          {item?.credenciais_ok && !soPedido && !erroLoginPortalErrado(item.ultimo_erro) ? (
                            <IconButton
                              size="small"
                              disabled={algumRodando || rodandoId === item.id_sync}
                              onClick={(e) => {
                                e.stopPropagation();
                                void rodarAgora(item.id_sync);
                              }}
                            >
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {FORNECEDORES.find((f) => f.codigo === dialog?.fornecedor)?.nome}
          {lojaDialog ? ` · ${lojaDialog.nome}` : ''}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="caption" color="text.secondary">
            {dialog ? HINT_LOGIN[dialog.fornecedor] : ''}
          </Typography>
          <TextField
            {...dialogFieldProps}
            label="Usuário"
            value={form.usuario}
            onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
            autoComplete="off"
          />
          <TextField
            {...dialogFieldProps}
            label="Senha"
            type="password"
            value={form.senha}
            onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            placeholder={dialog?.item?.tem_senha ? 'Deixe em branco para manter a atual' : ''}
            autoComplete="new-password"
          />
          {dialog?.fornecedor === 'cokenet' ? null : (
            <>
              <TextField
                {...dialogFieldProps}
                label="Horário da agenda"
                type="time"
                value={form.horario}
                onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
              />
              <TextField
                {...dialogFieldProps}
                label="Limite de NFs por puxão"
                type="number"
                value={form.limite}
                onChange={(e) => setForm((f) => ({ ...f, limite: Number(e.target.value) || 20 }))}
                slotProps={{ ...dialogFieldProps.slotProps, htmlInput: { min: 1, max: 200 } }}
              />
              <FormControlLabel
                control={<Switch checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />}
                label="Agenda ativa"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button variant="contained" disabled={salvando} onClick={() => void salvar()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function textoUltimo(item: EstoqueSyncFornecedor) {
  const quando = fmtQuando(item.ultimo_fim || item.ultimo_inicio);
  if (item.ultimo_status === 'ok') return quando ? `Puxou ${quando}` : 'Puxou certo';
  if (item.ultimo_status === 'parcial') return quando ? `Parcial ${quando}` : 'Parcial';
  if (item.ultimo_status === 'erro') return quando ? `Falhou ${quando}` : 'Falhou';
  return 'Ainda não puxou';
}
