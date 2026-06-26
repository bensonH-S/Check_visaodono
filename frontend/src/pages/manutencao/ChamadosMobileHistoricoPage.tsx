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
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import { getUsuario, modoCabecalhoContextoMobile, filtraChamadosPorLojaMobile, rotuloRegiaoMobile, rotuloLojaMobile, tecnicoCampoSemRegiao, temPermissao } from '../../lib/auth';
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

function StatMini({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        textAlign: 'center',
        py: 1.25,
        px: 1,
        borderRadius: 1.5,
        bgcolor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1, color: '#fff' }}>
        {valor}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.68rem' }}>
        {rotulo}
      </Typography>
    </Box>
  );
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

  const modoCabecalho = modoCabecalhoContextoMobile(sessao);
  const semRegiaoVinculada = tecnicoCampoSemRegiao(sessao);

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

      {/* Resumo */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: NAVY,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(27, 42, 107, 0.22)',
        }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          {modoCabecalho === 'regiao' && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600, display: 'block' }}>
              {rotuloRegiaoMobile(sessao)}
            </Typography>
          )}
          {modoCabecalho === 'loja' && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600, display: 'block' }}>
              {rotuloLojaMobile(sessao, idLoja)}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 600,
              display: 'block',
              mt: modoCabecalho === 'regiao' || modoCabecalho === 'loja' ? 0.25 : 0,
            }}
          >
            {modoCabecalho === 'loja' ? 'Manutenção da loja' : 'Central de chamados'}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.25, mt: 0.25 }}>
            Olá, {primeiroNome(sessao?.nome)}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5, fontSize: '0.8rem' }}>
            Acompanhe chamados em aberto e consulte o histórico de encerrados.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, px: 2, pb: 2 }}>
          <StatMini valor={emAberto.length} rotulo="Em aberto" />
          <StatMini valor={fechados.length} rotulo="Fechados" />
        </Box>
      </Paper>

      {/* Abas */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          p: 0.5,
          mb: 2,
          borderRadius: 2.5,
          bgcolor: 'rgba(27, 42, 107, 0.07)',
          border: '1px solid rgba(27, 42, 107, 0.08)',
        }}
      >
        {(
          [
            { id: 'abertos' as const, label: 'Em aberto', icon: InboxOutlinedIcon, qtd: emAberto.length },
            { id: 'fechados' as const, label: 'Fechados', icon: ArchiveOutlinedIcon, qtd: fechados.length },
          ] as const
        ).map(({ id, label, icon: Icon, qtd }) => {
          const ativa = aba === id;
          return (
            <Button
              key={id}
              fullWidth
              onClick={() => setAba(id)}
              startIcon={<Icon sx={{ fontSize: '18px !important' }} />}
              sx={{
                py: 1.1,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: ativa ? NAVY : 'text.secondary',
                bgcolor: ativa ? '#fff' : 'transparent',
                boxShadow: ativa ? '0 2px 8px rgba(27, 42, 107, 0.12)' : 'none',
                '&:hover': { bgcolor: ativa ? '#fff' : 'rgba(255,255,255,0.5)' },
              }}
            >
              {label}
              <Box
                component="span"
                sx={{
                  ml: 0.75,
                  minWidth: 22,
                  height: 22,
                  px: 0.75,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  bgcolor: ativa ? (id === 'abertos' ? ORANGE : 'rgba(27,42,107,0.12)') : 'rgba(27,42,107,0.1)',
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
            {aba === 'abertos' ? 'Nenhum chamado em aberto' : 'Nenhum chamado fechado'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: aba === 'abertos' ? 2 : 0 }}>
            {semRegiaoVinculada
              ? 'Você não está vinculado a nenhuma região. Peça ao administrador para associar sua região de atuação.'
              : aba === 'abertos'
                ? 'Quando houver uma solicitação de manutenção, ela aparecerá aqui.'
                : 'Chamados concluídos ou cancelados ficam registrados nesta aba.'}
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
            compact={aba === 'fechados'}
            showLoja={multiplasLojas}
            showSla={aba === 'abertos'}
            showDataEncerramento={aba === 'fechados'}
            onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}
          />
        ))}
      </Box>
    </Box>
  );
}
