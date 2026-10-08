import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import MeridianMarca from '../brand/MeridianMarca';

/** Command Center — placeholder enquanto a versão financeira é finalizada. */
export default function DashboardPage() {
  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: 'auto', lg: '100%' },
        minHeight: { xs: 420, lg: 0 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1, md: 2 },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 440,
          bgcolor: '#051017',
          borderColor: 'rgba(255,255,255,0.12)',
          borderRadius: 2,
          px: { xs: 3, md: 4 },
          py: { xs: 3.5, md: 4.5 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
        }}
      >
        <MeridianMarca variant="lockup" sx={{ width: '100%', maxWidth: 280 }} />

        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#1B6EF3',
              mb: 0.75,
            }}
          >
            Em desenvolvimento
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(248,250,252,0.72)', lineHeight: 1.45 }}>
            O Command Center está sendo refeito. Por enquanto use Inbox DDA, Agenda banco, Estoque e Frota pelo menu.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
