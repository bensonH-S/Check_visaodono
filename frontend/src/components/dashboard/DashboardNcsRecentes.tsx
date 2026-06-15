import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import HistoryIcon from '@mui/icons-material/History';
import { fmtData } from '../../api/client';
import { GRAVIDADE_CORES, dashboardPanelSx, dashboardPanelTitleSx, NAVY } from './dashboardCharts';

type NcRecente = {
  descricao: string;
  name: string;
  data_cadastro: string;
  gravidade: string;
};

export default function DashboardNcsRecentes({ ncs }: { ncs: NcRecente[] }) {
  return (
    <Paper elevation={0} sx={dashboardPanelSx}>
      <Typography sx={dashboardPanelTitleSx}>
        <HistoryIcon sx={{ fontSize: 22, color: NAVY }} />
        NCs recentes em aberto
      </Typography>

      {!ncs.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          Nenhuma não conformidade recente.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {ncs.map((nc, i) => (
            <Box
              key={`${nc.name}-${nc.data_cadastro}-${i}`}
              sx={{
                display: 'flex',
                gap: 1.25,
                alignItems: 'flex-start',
                p: 1.25,
                borderRadius: 1.5,
                bgcolor: 'rgba(27, 42, 107, 0.03)',
                border: '1px solid rgba(27, 42, 107, 0.08)',
              }}
            >
              <Chip
                label={nc.gravidade}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: GRAVIDADE_CORES[nc.gravidade] ?? '#9CA3AF',
                  color: '#fff',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.35, fontWeight: 500 }}>
                  {nc.descricao}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                  {nc.name} · {fmtData(nc.data_cadastro)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
