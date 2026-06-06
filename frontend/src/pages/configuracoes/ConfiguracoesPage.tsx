import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BadgeIcon from '@mui/icons-material/Badge';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const NAVY = '#1B2A6B';

const cards = [
  {
    to: '/configuracoes/categorias',
    title: 'Categorias',
    description: 'Visualize as categorias de chamados de manutenção.',
    icon: <CategoryIcon sx={{ fontSize: 28, color: NAVY }} />,
  },
  {
    to: '/configuracoes/sla',
    title: 'SLA',
    description: 'Consulte os prazos de atendimento por categoria.',
    icon: <ScheduleIcon sx={{ fontSize: 28, color: NAVY }} />,
  },
  {
    to: '/configuracoes/cargos',
    title: 'Cargos',
    description: 'Cadastre perfis (Gerente, Financeiro, Diretor…) usados em Usuários e aprovações.',
    icon: <BadgeIcon sx={{ fontSize: 28, color: NAVY }} />,
  },
];

export default function ConfiguracoesPage() {
  return (
    <Box className="max-w-3xl mx-auto w-full">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Parâmetros do módulo de manutenção
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {cards.map((card) => (
          <Paper
            key={card.to}
            component={Link}
            to={card.to}
            elevation={0}
            sx={{
              p: 2.5,
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: NAVY,
                boxShadow: '0 2px 8px rgba(27,42,107,0.08)',
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: '#E8EBF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                shrink: 0,
              }}
            >
              {card.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: NAVY }}>
                {card.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {card.description}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
