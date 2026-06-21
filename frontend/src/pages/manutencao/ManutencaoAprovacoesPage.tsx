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
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
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
import { pageFillLayoutSx } from '../../utils/pageFillLayout';
import { colors, portalPanelSx } from '../../theme/tokens';

const MAX_HISTORICO_CARD = 4;

function FluxoAprovacaoInfo() {
  const passos = [
    {
      icon: <AccountBalanceOutlinedIcon sx={{ fontSize: 20, color: colors.navy }} />,
      titulo: 'Financeiro',
      opcoes: ['Aprova o orçamento', 'Encaminha ao Diretor'],
    },
    {
      icon: <GavelOutlinedIcon sx={{ fontSize: 20, color: colors.navy }} />,
      titulo: 'Diretor',
      opcoes: ['Aprovação definitiva', 'Devolve ao Financeiro'],
    },
  ];

  return (
    <Paper elevation={0} sx={{ ...portalPanelSx, p: 2, flexShrink: 0 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: colors.textPrimary, mb: 1.5 }}>
        Fluxo de aprovação
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'stretch' }, gap: 1.5 }}>
        {passos.map((p, i) => (
          <Box key={p.titulo} sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: colors.border,
                bgcolor: colors.canvas,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {p.icon}
                <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{p.titulo}</Typography>
              </Box>
              {p.opcoes.map((op) => (
                <Typography key={op} variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.5, pl: 0.5 }}>
                  · {op}
                </Typography>
              ))}
            </Box>
            {i < passos.length - 1 && (
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', color: colors.textMuted }}>
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function HistoricoAprovacaoCard({ chamado }: { chamado: ManutChamado }) {
  const itens = (chamado.historico_aprovacao || []).slice(-MAX_HISTORICO_CARD);
  if (!itens.length) return null;

  return (
    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: colors.border }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, display: 'block', mb: 0.5 }}>
        Histórico
      </Typography>
      {itens.map((h, idx) => (
        <Typography key={`${h.tipo}-${h.quando}-${idx}`} variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', lineHeight: 1.4 }}>
          {labelHistoricoAprovacao(h.tipo)}
          {h.autor ? ` · ${h.autor}` : ''} — {formatDataHoraBrasilia(h.quando)}
        </Typography>
      ))}
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, px: 0.25, flexShrink: 0 }}>
        {icon === 'done' ? (
          <CheckCircleIcon sx={{ fontSize: 16, color: accent }} />
        ) : (
          <ScheduleOutlinedIcon sx={{ fontSize: 16, color: accent }} />
        )}
        <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', flex: 1, minWidth: 0 }} noWrap>
          {titulo}
        </Typography>
        <Chip label={cards.length} size="small" sx={{ height: 20, fontWeight: 600, fontSize: '0.65rem' }} />
      </Box>
      <Box sx={kanbanColumnBodySx}>
        {cards.map((c) => (
          <Paper
            key={c.id_chamado}
            elevation={0}
            onClick={() => onCardClick(c.id_chamado)}
            sx={{ ...kanbanCardSx, borderLeft: `3px solid ${accent}` }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', mb: 0.5, lineHeight: 1.35 }}>
              {c.titulo}
            </Typography>
            <Box sx={{ ...kanbanChipRowSx, mb: 0.5 }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.68rem', width: '100%' }}>
                #{c.numero} · {c.categoria}
              </Typography>
              {destinoAprovacaoChip(c.aprovacao_destino, cargos)}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: 14, color: colors.orange, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.loja}
              </Typography>
            </Box>
            <HistoricoAprovacaoCard chamado={c} />
          </Paper>
        ))}
        {!cards.length && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: '0.75rem' }}>
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
    <Box sx={pageFillLayoutSx}>
      <FluxoAprovacaoInfo />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {erro && <Alert severity="error">{erro}</Alert>}

      {!loading && !erro && (
        <Box sx={{ ...kanbanBoardLayout(2), flex: 1, minHeight: 0 }}>
          <ColunaOrcamentos
            titulo="Pendentes"
            accent="#8B5CF6"
            icon="pending"
            cards={pendentes}
            vazio="Nenhum orçamento aguardando aprovação."
            onCardClick={(id) => navigate(`/chamados/aprovacoes/${id}`)}
            cargos={cargos}
          />
          <ColunaOrcamentos
            titulo="Aprovados"
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
