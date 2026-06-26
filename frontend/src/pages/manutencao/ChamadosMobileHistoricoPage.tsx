import type { MouseEvent } from 'react';
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
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import {
  getUsuario,
  filtraChamadosPorLojaMobile,
  modoCabecalhoContextoMobile,
  rotuloLojaMobile,
  rotuloRegiaoMobile,
  tecnicoCampoSemRegiao,
  temPermissao,
} from '../../lib/auth';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { parseDataApi } from '../../utils/dateBr';
import ChamadoCardResumo from '../../components/manutencao/ChamadoCardResumo';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';
const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);

type AbaLista = 'abertos' | 'fechados';

function primeiroNome(nome?: string) {
  return nome?.trim().split(/\s+/)[0] || 'Olá';
}

function subtituloMobile(abertos: number, urgentes: number) {
  if (urgentes > 0) {
    return urgentes === 1
      ? '1 chamado precisa de atenção prioritária'
      : `${urgentes} chamados precisam de atenção prioritária`;
  }
  if (abertos > 0) {
    return 'Toque em um chamado para acompanhar';
  }
  return 'Tudo em dia por aqui';
}

export default function ChamadosMobileHistoricoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessao = getUsuario();
  const { idLoja } = useChamadosMobileLoja();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<AbaLista>('abertos');
  const [assumindoId, setAssumindoId] = useState<number | null>(null);

  function recarregar() {
    return api
      .manutChamados({ mobile: true })
      .then(setLista)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
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
  const contextoAtuacao =
    modoCabecalho === 'regiao'
      ? rotuloRegiaoMobile(sessao)
      : modoCabecalho === 'loja'
        ? rotuloLojaMobile(sessao, idLoja)
        : null;

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
    <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}>
      {erro && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {erro}
        </Alert>
      )}

      {/* Cabeçalho da lista — saudação + contexto de atuação */}
      <Box
        sx={{
          mb: 2,
          ml: 'calc(-1 * max(16px, env(safe-area-inset-left, 0px)))',
          mr: 'calc(-1 * max(16px, env(safe-area-inset-right, 0px)))',
          width:
            'calc(100% + max(16px, env(safe-area-inset-left, 0px)) + max(16px, env(safe-area-inset-right, 0px)))',
          pl: 'calc(max(16px, env(safe-area-inset-left, 0px)) + 12px)',
          pr: 'max(16px, env(safe-area-inset-right, 0px))',
          pt: 2.5,
          pb: 1.35,
          borderRadius: 0,
          border: 'none',
          borderBottom: '1px solid rgba(27, 42, 107, 0.1)',
          bgcolor: '#fff',
          boxShadow: '0 2px 8px rgba(27, 42, 107, 0.04)',
        }}
      >
        <Typography
          component="h1"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.5rem', sm: '1.35rem' },
            lineHeight: 1.15,
            color: NAVY,
            letterSpacing: '-0.03em',
          }}
        >
          Olá, {primeiroNome(sessao?.nome)}
        </Typography>

        {contextoAtuacao && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5,
              minWidth: 0,
            }}
          >
            <LocationOnOutlinedIcon sx={{ fontSize: 16, color: ORANGE, flexShrink: 0 }} />
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                lineHeight: 1.35,
                color: NAVY,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {contextoAtuacao}
            </Typography>
          </Box>
        )}

        <Typography
          variant="body2"
          sx={{
            mt: contextoAtuacao ? 0.65 : 0.55,
            pt: contextoAtuacao ? 0.65 : 0,
            borderTop: contextoAtuacao ? '1px solid rgba(27, 42, 107, 0.07)' : 'none',
            fontSize: '0.84rem',
            lineHeight: 1.4,
            color: urgentes > 0 ? ORANGE : 'text.secondary',
            fontWeight: urgentes > 0 ? 600 : 400,
          }}
        >
          {subtituloMobile(emAberto.length, urgentes)}
        </Typography>
      </Box>

      {/* Abas */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.25,
          p: 0.3,
          mb: 1.75,
          borderRadius: 2.5,
          bgcolor: 'rgba(27, 42, 107, 0.08)',
        }}
      >
        {(
          [
            { id: 'abertos' as const, label: 'Abertos', icon: InboxOutlinedIcon, qtd: emAberto.length },
            { id: 'fechados' as const, label: 'Fechados', icon: ArchiveOutlinedIcon, qtd: fechados.length },
          ] as const
        ).map(({ id, label, icon: Icon, qtd }) => {
          const ativa = aba === id;
          return (
            <Button
              key={id}
              fullWidth
              onClick={() => setAba(id)}
              startIcon={<Icon sx={{ fontSize: '15px !important', mr: '-2px !important' }} />}
              sx={{
                minHeight: 0,
                py: 0.7,
                px: 0.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: ativa ? NAVY : 'text.secondary',
                bgcolor: ativa ? '#fff' : 'transparent',
                boxShadow: ativa ? '0 1px 6px rgba(27, 42, 107, 0.12)' : 'none',
                '&:hover': { bgcolor: ativa ? '#fff' : 'rgba(255,255,255,0.35)' },
                '& .MuiButton-startIcon': { mr: 0.5 },
              }}
            >
              {label}
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  minWidth: 18,
                  height: 18,
                  px: 0.5,
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  bgcolor: ativa ? (id === 'abertos' ? ORANGE : 'rgba(27,42,107,0.12)') : 'rgba(27,42,107,0.09)',
                  color: ativa && id === 'abertos' ? '#fff' : ativa ? NAVY : 'text.secondary',
                }}
              >
                {qtd}
              </Box>
            </Button>
          );
        })}
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
    </Box>
  );
}
