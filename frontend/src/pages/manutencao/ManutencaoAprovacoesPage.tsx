import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client';
import type { ManutChamado, Cargo } from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { destinoAprovacaoChip, labelHistoricoAprovacao } from '../../utils/manutencaoUi';
import {
  kanbanBoardLayout,
  kanbanCardSx,
  kanbanChipRowSx,
  kanbanColumnBodySx,
  kanbanColumnLayout,
} from '../../components/manutencao/kanbanLayout';

const NAVY = '#1B2A6B';
const MAX_HISTORICO_CARD = 4;

function HistoricoAprovacaoCard({ chamado }: { chamado: ManutChamado }) {
  const itens = (chamado.historico_aprovacao || []).slice(-MAX_HISTORICO_CARD);
  if (!itens.length) return null;

  return (
    <Box
      sx={{
        mt: 1.25,
        pt: 1,
        borderTop: '1px solid rgba(27, 42, 107, 0.1)',
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: NAVY, display: 'block', mb: 0.5, fontSize: '0.68rem' }}
      >
        Histórico
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        {itens.map((h, idx) => (
          <Box
            key={`${h.tipo}-${h.quando}-${idx}`}
            sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', lineHeight: 1.3 }}
          >
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: h.tipo === 'recusa_aprovacao' ? '#DC2626' : '#8B5CF6',
                mt: '0.35rem',
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', flex: 1 }}>
              <Box component="span" sx={{ fontWeight: 600, color: NAVY }}>
                {labelHistoricoAprovacao(h.tipo)}
              </Box>
              {h.autor ? ` · ${h.autor}` : ''}
              <Box component="span" sx={{ display: 'block', opacity: 0.85 }}>
                {formatDataHoraBrasilia(h.quando)}
              </Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ColunaOrcamentos({
  titulo,
  accent,
  icon,
  cards,
  vazio,
  onCardClick,
  cargos,
}: {
  titulo: string;
  accent: string;
  icon: 'pending' | 'done';
  cards: ManutChamado[];
  vazio: string;
  onCardClick: (id: number) => void;
  cargos: Cargo[];
}) {
  return (
    <Box sx={kanbanColumnLayout()}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, px: 0.25, minWidth: 0 }}>
        {icon === 'done' ? (
          <CheckCircleIcon sx={{ fontSize: 16, color: accent, flexShrink: 0 }} />
        ) : (
          <ScheduleOutlinedIcon sx={{ fontSize: 16, color: accent, flexShrink: 0 }} />
        )}
        <Typography
          sx={{
            fontWeight: 700,
            color: NAVY,
            fontSize: { xs: '0.82rem', sm: '0.85rem', lg: '0.9rem' },
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titulo}
        </Typography>
        <Chip
          label={cards.length}
          size="small"
          sx={{
            height: 18,
            minWidth: 22,
            fontWeight: 700,
            fontSize: '0.65rem',
            bgcolor: 'rgba(27, 42, 107, 0.08)',
            color: NAVY,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Box>
      <Box sx={kanbanColumnBodySx}>
        {cards.map((c) => (
          <Paper
            key={c.id_chamado}
            elevation={0}
            onClick={() => onCardClick(c.id_chamado)}
            sx={{
              ...kanbanCardSx,
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                color: NAVY,
                fontSize: { xs: '0.82rem', sm: '0.85rem' },
                mb: 0.5,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {c.titulo}
            </Typography>
            <Box sx={{ ...kanbanChipRowSx, mb: 0.75 }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.68rem', width: '100%' }}>
                #{c.numero} · {c.categoria}
              </Typography>
              {destinoAprovacaoChip(c.aprovacao_destino, cargos)}
              {c.aprovacao_diretor_ok && c.status === 'em_aprovacao' && (
                <Chip
                  label="Aprovado pelo Diretor"
                  size="small"
                  sx={{ height: 20, fontWeight: 600, fontSize: '0.62rem', bgcolor: '#DBEAFE', color: '#1E40AF' }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: 14, color: '#E8520A', flexShrink: 0 }} />
              <Typography
                sx={{
                  color: NAVY,
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.loja}
              </Typography>
            </Box>
            {c.total_fotos != null && c.total_fotos > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {c.total_fotos} anexo(s)
              </Typography>
            )}
            <HistoricoAprovacaoCard chamado={c} />
          </Paper>
        ))}
        {!cards.length && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3, px: 1, fontSize: '0.75rem' }}>
            {vazio}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function ManutencaoAprovacoesPage() {
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState<ManutChamado[]>([]);
  const [aprovados, setAprovados] = useState<ManutChamado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  usePageTitle('Aprovações');

  function carregar() {
    return Promise.all([api.manutChamadosAprovacoes(), api.cargos()])
      .then(([r, cargosLista]) => {
        setPendentes(r.pendentes);
        setAprovados(r.aprovados);
        setCargos(cargosLista);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography
        sx={{
          fontWeight: 800,
          color: NAVY,
          mb: 0.5,
          fontSize: { xs: '1rem', sm: '1.1rem' },
        }}
      >
        Aprovações de orçamento
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.45 }}
      >
        O Financeiro pode aprovar direto ou encaminhar ao Diretor. O Diretor pode aprovar definitivamente ou
        devolver ao Financeiro.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      {!loading && !erro && (
        <Box sx={kanbanBoardLayout(2)}>
          <ColunaOrcamentos
            titulo="Orçamentos pendentes"
            accent="#8B5CF6"
            icon="pending"
            cards={pendentes}
            vazio="Nenhum orçamento aguardando aprovação."
            onCardClick={(id) => navigate(`/chamados/aprovacoes/${id}`)}
            cargos={cargos}
          />
          <ColunaOrcamentos
            titulo="Orçamentos aprovados"
            accent="#14B8A6"
            icon="done"
            cards={aprovados}
            vazio="Nenhum orçamento aprovado recentemente."
            onCardClick={(id) => navigate(`/chamados/aprovacoes/${id}`)}
            cargos={cargos}
          />
        </Box>
      )}
    </Box>
  );
}
