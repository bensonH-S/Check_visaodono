import { useEffect, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import Box from '@mui/material/Box';

import Paper from '@mui/material/Paper';

import Typography from '@mui/material/Typography';

import Button from '@mui/material/Button';

import Chip from '@mui/material/Chip';

import CircularProgress from '@mui/material/CircularProgress';

import Alert from '@mui/material/Alert';

import Snackbar from '@mui/material/Snackbar';

import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';

import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

import { api } from '../../api/client';

import type { ManutChamado } from '../../api/client';

import { getUsuario, temPermissao } from '../../lib/auth';
import NotificacaoBadge from '../../components/NotificacaoBadge';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';

import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';

import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { SlaBarraProgresso } from '../../utils/manutencaoUi';



const NAVY = '#1B2A6B';



const STATUS: Record<string, { label: string; bg: string; color: string; accent: string }> = {
  aberto: { label: 'Solicitado', bg: '#FEF3C7', color: '#92400E', accent: '#F59E0B' },
  em_atendimento: { label: 'Em andamento', bg: '#DBEAFE', color: '#1E40AF', accent: '#3B82F6' },
  em_aprovacao: { label: 'Em aprovação', bg: '#EDE9FE', color: '#7C3AED', accent: '#8B5CF6' },
  aprovado: { label: 'Aprovado', bg: '#CCFBF1', color: '#0F766E', accent: '#14B8A6' },
  concluido: { label: 'Concluído', bg: '#DCFCE7', color: '#166534', accent: '#22C55E' },
  cancelado: { label: 'Cancelado', bg: '#FEE2E2', color: '#991B1B', accent: '#EF4444' },
};



const URGENCIA: Record<string, { label: string; bg: string; color: string }> = {

  baixa: { label: 'Baixa', bg: '#F3F4F6', color: '#4B5563' },

  media: { label: 'Média', bg: '#E0E7FF', color: '#3730A3' },

  alta: { label: 'Alta', bg: '#FFEDD5', color: '#C2410C' },

  critica: { label: 'Crítica', bg: '#FEE2E2', color: '#B91C1C' },

};



const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);



function statusInfo(status: string) {

  return STATUS[status] || { label: status, bg: '#F3F4F6', color: '#4B5563', accent: '#9CA3AF' };

}



function urgenciaInfo(urgencia: string) {

  return URGENCIA[urgencia] || { label: urgencia, bg: '#F3F4F6', color: '#4B5563' };

}



function ChamadoCard({

  chamado,

  compact,

  onClick,

}: {

  chamado: ManutChamado;

  compact?: boolean;

  onClick?: () => void;

}) {

  const st = statusInfo(chamado.status);

  const urg = urgenciaInfo(chamado.urgencia);



  return (

    <Paper

      elevation={0}

      onClick={onClick}

      sx={{

        borderRadius: 2,

        border: '1px solid rgba(27, 42, 107, 0.12)',

        borderLeft: `4px solid ${st.accent}`,

        overflow: 'hidden',

        bgcolor: '#fff',

        boxShadow: compact

          ? '0 2px 6px rgba(27, 42, 107, 0.08)'

          : '0 4px 14px rgba(27, 42, 107, 0.12)',

        opacity: compact ? 0.95 : 1,

        cursor: onClick ? 'pointer' : 'default',

        transition: 'transform 0.15s ease',

        '&:active': onClick ? { transform: 'scale(0.99)' } : undefined,

      }}

    >

      <Box sx={{ px: 1.5, py: 1.25 }}>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

            <Box

              sx={{

                bgcolor: 'rgba(27, 42, 107, 0.08)',

                color: NAVY,

                fontWeight: 800,

                fontSize: '0.8125rem',

                px: 1,

                py: 0.35,

                borderRadius: 1,

                lineHeight: 1.2,

              }}

            >

              #{chamado.numero}

            </Box>

            <NotificacaoBadge count={chamado.notificacoes_nao_lidas} />

          </Box>

          <Chip

            label={urg.label}

            size="small"

            sx={{

              height: 24,

              fontWeight: 700,

              fontSize: '0.7rem',

              bgcolor: urg.bg,

              color: urg.color,

              border: 'none',

            }}

          />

        </Box>



        <Typography

          variant="body1"

          sx={{

            fontWeight: 700,

            lineHeight: 1.35,

            color: compact ? 'text.secondary' : 'text.primary',

            fontSize: compact ? '0.85rem' : '0.9rem',

            mb: 0.5,

          }}

        >

          {chamado.titulo}

        </Typography>



        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>

          {chamado.categoria}

        </Typography>



        {!compact && (

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>

            {chamado.total_fotos > 0 && (

              <>

                <PhotoCameraOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />

                <Typography variant="caption" color="text.secondary">

                  {chamado.total_fotos} anexo{chamado.total_fotos > 1 ? 's' : ''}

                </Typography>

              </>

            )}

          </Box>

        )}



        <Box

          sx={{

            display: 'flex',

            gap: 0.75,

            mt: 1,

            flexWrap: 'wrap',

            alignItems: 'center',

            pt: 1,

            borderTop: `1px solid rgba(27, 42, 107, 0.15)`,

          }}

        >

          <Chip

            label={st.label}

            size="small"

            sx={{

              height: 26,

              fontWeight: 700,

              fontSize: '0.72rem',

              bgcolor: st.bg,

              color: st.color,

              border: `1px solid ${st.accent}40`,

            }}

          />

          {!compact && (

            <Chip

              icon={<ScheduleOutlinedIcon sx={{ fontSize: '14px !important', color: `${NAVY} !important` }} />}

              label={formatDataHoraBrasilia(chamado.aberto_em || chamado.prazo_sla)}

              size="small"

              variant="outlined"

              sx={{

                height: 26,

                fontSize: '0.72rem',

                fontWeight: 600,

                color: NAVY,

                borderColor: 'rgba(27, 42, 107, 0.2)',

                '& .MuiChip-icon': { ml: 0.75 },

              }}

            />

          )}

        </Box>

        {!compact && chamado.status !== 'cancelado' && (
          <Box sx={{ mt: 1 }}>
            <SlaBarraProgresso
              abertoEm={chamado.aberto_em}
              prazoSla={chamado.prazo_sla}
              status={chamado.status}
              fechadoEm={chamado.fechado_em ?? undefined}
              larguraTotal
              compact
            />
          </Box>
        )}

      </Box>

    </Paper>

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

  const [toast, setToast] = useState('');



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

    setToast(`Chamado #${numero} aberto com sucesso!`);

    if (fromState) {

      navigate(location.pathname, { replace: true, state: {} });

    }

    recarregar();

  }, [location.state, location.pathname, navigate]);



  const multiplasLojas = (sessao?.lojas?.length ?? 0) > 1;

  const listaFiltrada =

    multiplasLojas && idLoja != null

      ? lista.filter((c) => c.id_loja === idLoja)

      : lista;



  const emAberto = listaFiltrada.filter((c) => ABERTOS.has(c.status));

  const encerrados = listaFiltrada.filter((c) => !ABERTOS.has(c.status));



  if (loading) {

    return (

      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>

        <CircularProgress />

      </Box>

    );

  }



  return (

    <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}>

      {erro && (

        <Alert severity="error" sx={{ mb: 2 }}>

          {erro}

        </Alert>

      )}



      <Box

        sx={{

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'space-between',

          mb: 1.5,

        }}

      >

        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: NAVY }}>

          Em aberto

        </Typography>

        <Box

          sx={{

            bgcolor: 'rgba(27, 42, 107, 0.1)',

            color: NAVY,

            fontWeight: 700,

            fontSize: '0.75rem',

            px: 1,

            py: 0.25,

            borderRadius: 10,

          }}

        >

          {emAberto.length}

        </Box>

      </Box>



      {!emAberto.length && !erro && (

        <Paper

          elevation={0}

          sx={{

            p: 3,

            textAlign: 'center',

            mb: 3,

            borderRadius: 2,

            border: `1.5px dashed ${NAVY}`,

            bgcolor: 'rgba(27, 42, 107, 0.03)',

          }}

        >

          <Typography color="text.secondary" gutterBottom>

            Nenhum chamado em aberto nesta unidade.

          </Typography>

          {sessao && temPermissao('chamados.abrir', sessao) && (

            <Button

              variant="contained"

              sx={{ mt: 1.5 }}

              onClick={() => navigate('/chamados/mobile/novo')}

            >

              Abrir chamado

            </Button>

          )}

        </Paper>

      )}



      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>

        {emAberto.map((c) => (

          <ChamadoCard

            key={c.id_chamado}

            chamado={c}

            onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}

          />

        ))}

      </Box>



      {encerrados.length > 0 && (

        <>

          <Box

            sx={{

              display: 'flex',

              alignItems: 'center',

              justifyContent: 'space-between',

              mb: 1.5,

            }}

          >

            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.secondary' }}>

              Fechado

            </Typography>

            <Box

              sx={{

                bgcolor: 'rgba(0,0,0,0.06)',

                color: 'text.secondary',

                fontWeight: 700,

                fontSize: '0.75rem',

                px: 1,

                py: 0.25,

                borderRadius: 10,

              }}

            >

              {encerrados.length}

            </Box>

          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {encerrados.map((c) => (

              <ChamadoCard

                key={c.id_chamado}

                chamado={c}

                compact

                onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}

              />

            ))}

          </Box>

        </>

      )}



      <Snackbar

        open={!!toast}

        autoHideDuration={3000}

        onClose={() => setToast('')}

        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}

      >

        <Alert severity="success" variant="filled" onClose={() => setToast('')} sx={{ width: '100%' }}>

          {toast}

        </Alert>

      </Snackbar>

    </Box>

  );

}


