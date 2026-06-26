import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { showToast } from '../../utils/toast';
import AddIcon from '@mui/icons-material/Add';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PauseOutlinedIcon from '@mui/icons-material/PauseOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconeMenuTresTracos from '../../components/IconeMenuTresTracos';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import {
  getUsuario,
  filtraChamadosPorLojaMobile,
  modoCabecalhoContextoMobile,
  tecnicoCampoSemRegiao,
  temPermissao,
} from '../../lib/auth';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { parseDataApi } from '../../utils/dateBr';
import ChamadoCardResumo from '../../components/manutencao/ChamadoCardResumo';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';
const PAGE_BG = '#f5f5f3';
const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);

type AbaLista = 'abertos' | 'fechados';

function CardResumoChamados({
  valor,
  rotulo,
  fundoIcone,
  bordaIcone,
  icone,
}: {
  valor: number;
  rotulo: string;
  fundoIcone: string;
  bordaIcone: string;
  icone: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1.5,
        py: 2,
        minHeight: 92,
        borderRadius: 3.5,
        bgcolor: '#fff',
        border: 'none',
        boxShadow: '0 4px 20px rgba(27, 42, 107, 0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.15,
      }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: 1.75,
          bgcolor: fundoIcone,
          border: `2px solid ${bordaIcone}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icone}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '2.35rem',
            lineHeight: 1,
            color: NAVY,
            letterSpacing: '-0.04em',
          }}
        >
          {valor}
        </Typography>
        <Typography
          sx={{
            mt: 0.45,
            fontSize: '0.78rem',
            fontWeight: 500,
            color: NAVY,
            opacity: 0.72,
            lineHeight: 1.2,
          }}
        >
          {rotulo}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function ChamadosMobileHistoricoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessao = getUsuario();
  const { idLoja, setIdLoja } = useChamadosMobileLoja();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<AbaLista>('abertos');
  const [modoLista, setModoLista] = useState(false);
  const [assumindoId, setAssumindoId] = useState<number | null>(null);
  const [filtroLojaAberto, setFiltroLojaAberto] = useState(false);

  function recarregar() {
    return api
      .manutChamados({ mobile: true })
      .then(setLista)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar';
        if (/internal|500|fetch|network|proxy|refused/i.test(msg)) {
          setErro('Não foi possível conectar ao servidor. Verifique se a API está rodando (npm run dev).');
        } else {
          setErro(msg);
        }
      });
  }

  useEffect(() => {
    recarregar().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onRefresh() {
      recarregar();
    }
    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    return () => window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
  }, []);

  useEffect(() => {
    const fromState = (location.state as { chamadoCriado?: number } | null)?.chamadoCriado;
    const fromStorage = sessionStorage.getItem('chamado_criado_numero');
    const numero = fromState ?? (fromStorage ? Number(fromStorage) : null);
    if (!numero || Number.isNaN(numero)) return;
    sessionStorage.removeItem('chamado_criado_numero');
    showToast(`Chamado #${numero} aberto com sucesso!`, 'success');
    setAba('abertos');
    if (fromState) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    recarregar();
  }, [location.state, location.pathname, navigate]);

  const semRegiaoVinculada = tecnicoCampoSemRegiao(sessao);
  const modoCabecalho = modoCabecalhoContextoMobile(sessao);

  const multiplasLojas = (sessao?.lojas?.length ?? 0) > 1;
  const filtrarPorLoja = filtraChamadosPorLojaMobile(sessao);

  const listaFiltrada = useMemo(() => {
    const aplicarFiltroLoja = filtrarPorLoja && multiplasLojas && idLoja != null;
    const base = aplicarFiltroLoja ? lista.filter((c) => c.id_loja === idLoja) : lista;
    return [...base].sort(
      (a, b) =>
        parseDataApi(b.aberto_em || b.prazo_sla).getTime() -
        parseDataApi(a.aberto_em || a.prazo_sla).getTime(),
    );
  }, [lista, multiplasLojas, idLoja, filtrarPorLoja]);

  const emAberto = useMemo(
    () => listaFiltrada.filter((c) => ABERTOS.has(c.status)),
    [listaFiltrada],
  );

  const fechados = useMemo(
    () =>
      [...listaFiltrada.filter((c) => !ABERTOS.has(c.status))].sort(
        (a, b) =>
          parseDataApi(b.fechado_em || b.aberto_em || b.prazo_sla).getTime() -
          parseDataApi(a.fechado_em || a.aberto_em || a.prazo_sla).getTime(),
      ),
    [listaFiltrada],
  );

  const listaAba = aba === 'abertos' ? emAberto : fechados;

  const urgentes = useMemo(
    () => emAberto.filter((c) => c.urgencia === 'alta' || c.urgencia === 'critica').length,
    [emAberto],
  );

  const qtdEmAberto = useMemo(
    () => emAberto.filter((c) => c.status === 'aberto').length,
    [emAberto],
  );

  const qtdEmTratamento = useMemo(
    () => emAberto.filter((c) => c.status === 'em_atendimento').length,
    [emAberto],
  );

  const lojasUsuario = sessao?.lojas ?? [];

  async function assumirTicket(e: MouseEvent, c: ManutChamado) {
    e.stopPropagation();
    if (assumindoId != null) return;
    setAssumindoId(c.id_chamado);
    try {
      await api.manutAssumirChamado(c.id_chamado);
      showToast('Ticket assumido!', 'success');
      window.dispatchEvent(new CustomEvent(NOTIFICACOES_REFRESH));
      await recarregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao assumir ticket', 'error');
    } finally {
      setAssumindoId(null);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: NAVY }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%', bgcolor: PAGE_BG, minHeight: '100%' }}>
      {erro && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }}>
          {erro}
        </Alert>
      )}

      {urgentes > 0 && (
        <Typography sx={{ mb: 2.25, fontSize: '0.8rem', fontWeight: 600, color: ORANGE }}>
          {urgentes === 1
            ? '1 chamado precisa de atenção prioritária'
            : `${urgentes} chamados precisam de atenção prioritária`}
        </Typography>
      )}

      {/* Cards resumo */}
      <Box sx={{ display: 'flex', gap: 1.25, mb: 2.25 }}>
        <CardResumoChamados
          valor={qtdEmAberto}
          rotulo="em aberto"
          fundoIcone="rgba(232, 82, 10, 0.14)"
          bordaIcone={ORANGE}
          icone={<TrendingUpIcon sx={{ color: ORANGE, fontSize: 22 }} />}
        />
        <CardResumoChamados
          valor={qtdEmTratamento}
          rotulo="em andamento"
          fundoIcone="rgba(27, 42, 107, 0.14)"
          bordaIcone={NAVY}
          icone={<PauseOutlinedIcon sx={{ color: NAVY, fontSize: 22 }} />}
        />
      </Box>

      {/* Abas + filtro */}
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1, mb: 2 }}>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            bgcolor: '#fff',
            borderRadius: 999,
            p: 0.4,
            boxShadow: '0 2px 14px rgba(27, 42, 107, 0.07)',
            minWidth: 0,
          }}
        >
          {(
            [
              { id: 'abertos' as const, label: 'Em aberto' },
              { id: 'fechados' as const, label: 'Fechados' },
            ] as const
          ).map(({ id, label }) => {
            const ativa = aba === id;
            return (
              <Button
                key={id}
                fullWidth
                onClick={() => setAba(id)}
                sx={{
                  minHeight: 0,
                  py: 0.9,
                  px: 1.5,
                  borderRadius: 999,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  color: ativa ? '#fff' : 'rgba(27, 42, 107, 0.55)',
                  bgcolor: ativa ? ORANGE : 'transparent',
                  boxShadow: ativa ? '0 2px 10px rgba(232, 82, 10, 0.32)' : 'none',
                  '&:hover': { bgcolor: ativa ? ORANGE : 'rgba(27, 42, 107, 0.04)' },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>

        <Box
          component="button"
          type="button"
          aria-label={modoLista ? 'Ver em cards' : 'Ver em lista'}
          aria-pressed={modoLista}
          onClick={() => setModoLista((v) => !v)}
          sx={{
            flexShrink: 0,
            alignSelf: 'stretch',
            aspectRatio: '1',
            width: 'auto',
            minWidth: 40,
            borderRadius: 2.5,
            bgcolor: '#fff',
            boxShadow: '0 2px 14px rgba(27, 42, 107, 0.07)',
            border: 'none',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            p: 0,
            font: 'inherit',
          }}
        >
          <IconeMenuTresTracos ativo={modoLista} />
        </Box>

        {multiplasLojas && filtrarPorLoja && (
          <>
            <IconButton
              aria-label="Filtrar loja"
              onClick={() => setFiltroLojaAberto(true)}
              sx={{
                flexShrink: 0,
                alignSelf: 'stretch',
                aspectRatio: '1',
                width: 'auto',
                minWidth: 40,
                borderRadius: 2.5,
                bgcolor: '#fff',
                boxShadow: '0 2px 12px rgba(27, 42, 107, 0.08)',
                border: idLoja ? '2px solid rgba(232, 82, 10, 0.35)' : '1px solid rgba(27, 42, 107, 0.08)',
              }}
            >
              <FilterListIcon sx={{ color: NAVY, fontSize: 22 }} />
            </IconButton>

            <Dialog open={filtroLojaAberto} onClose={() => setFiltroLojaAberto(false)} fullWidth maxWidth="xs">
              <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY }}>
                Filtrar por loja
              </DialogTitle>
              <List sx={{ pt: 0, pb: 1 }}>
                {lojasUsuario.map((loja) => {
                  const ativa = loja.id_loja === idLoja;
                  return (
                    <ListItemButton
                      key={loja.id_loja}
                      selected={ativa}
                      onClick={() => {
                        setIdLoja(loja.id_loja);
                        setFiltroLojaAberto(false);
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={loja.nome}
                        slotProps={{
                          primary: {
                            sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' },
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Dialog>
          </>
        )}
      </Box>

      {/* Lista */}
      {!listaAba.length && !erro && (
        <Paper
          elevation={0}
          sx={{
            p: 3.5,
            textAlign: 'center',
            borderRadius: 2.5,
            border: `1.5px dashed ${aba === 'abertos' ? ORANGE : 'rgba(27,42,107,0.25)'}`,
            bgcolor: aba === 'abertos' ? 'rgba(232, 82, 10, 0.04)' : 'rgba(27, 42, 107, 0.03)',
          }}
        >
          {aba === 'abertos' ? (
            <InboxOutlinedIcon sx={{ fontSize: 40, color: ORANGE, mb: 1, opacity: 0.85 }} />
          ) : (
            <ArchiveOutlinedIcon sx={{ fontSize: 40, color: NAVY, mb: 1, opacity: 0.5 }} />
          )}
          <Typography sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
            {aba === 'abertos' ? 'Nenhum chamado aberto' : 'Nenhum chamado fechado'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: aba === 'abertos' ? 2 : 0 }}>
            {semRegiaoVinculada
              ? 'Você não está vinculado a nenhuma região. Peça ao administrador para associar sua região de atuação.'
              : aba === 'abertos'
                ? 'Quando houver uma solicitação de manutenção, ela aparecerá aqui.'
                : 'Chamados concluídos ou cancelados aparecem na aba Fechados.'}
          </Typography>
          {aba === 'abertos' && sessao && temPermissao('chamados.abrir', sessao) && !semRegiaoVinculada && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/chamados/mobile/novo')}
              sx={{ mt: 0.5 }}
            >
              Abrir chamado
            </Button>
          )}
        </Paper>
      )}

      {modoLista ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: '#fff',
            border: '1px solid rgba(27, 42, 107, 0.08)',
            boxShadow: '0 4px 18px rgba(27, 42, 107, 0.06)',
          }}
        >
          {listaAba.map((c, i) => (
            <ChamadoCardResumo
              key={c.id_chamado}
              chamado={c}
              variant="mobile"
              mobileLayout="lista"
              isLast={i === listaAba.length - 1}
              showLoja={multiplasLojas || modoCabecalho === 'regiao'}
              showSla={aba === 'abertos'}
              onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}
            />
          ))}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {listaAba.map((c) => (
            <ChamadoCardResumo
              key={c.id_chamado}
              chamado={c}
              variant="mobile"
              compact={aba === 'fechados'}
              showLoja={multiplasLojas || modoCabecalho === 'regiao'}
              showSla={aba === 'abertos'}
              showDataEncerramento={aba === 'fechados'}
              mostrarAssumir={aba === 'abertos'}
              onAssumir={(e) => void assumirTicket(e, c)}
              assumindo={assumindoId === c.id_chamado}
              onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
