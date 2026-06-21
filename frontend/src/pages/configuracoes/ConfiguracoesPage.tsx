import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BadgeIcon from '@mui/icons-material/Badge';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import StoreIcon from '@mui/icons-material/Store';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getUsuario, temPermissao } from '../../lib/auth';

const NAVY = '#1B2A6B';

type CardConfig = {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  show: boolean;
};

type SectionConfig = {
  title: string;
  cards: CardConfig[];
};

function ConfigCard({ card }: { card: CardConfig }) {
  return (
    <Paper
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
          flexShrink: 0,
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
  );
}

export default function ConfiguracoesPage() {
  const user = getUsuario();

  const sections: SectionConfig[] = [
    {
      title: 'Checklist',
      cards: [
        {
          to: '/configuracoes/perguntas',
          title: 'Checklist perguntas',
          description: 'Cadastre e edite as perguntas e seções do checklist em loja.',
          icon: <AssignmentIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('configuracoes.ver', user),
        },
      ],
    },
    {
      title: 'Cadastros',
      cards: [
        {
          to: '/configuracoes/usuarios',
          title: 'Usuários',
          description: 'Gerencie contas, permissões e lojas vinculadas.',
          icon: <PeopleIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('usuarios.gerenciar', user),
        },
        {
          to: '/configuracoes/lojas',
          title: 'Lojas',
          description: 'Consulte o cadastro de unidades e notas das lojas.',
          icon: <StoreIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('portal.lojas.ver', user),
        },
      ],
    },
    {
      title: 'Manutenção',
      cards: [
        {
          to: '/configuracoes/categorias',
          title: 'Categorias',
          description: 'Categorias de chamados de manutenção.',
          icon: <CategoryIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('configuracoes.ver', user),
        },
        {
          to: '/configuracoes/sla',
          title: 'SLA',
          description: 'Prazos de atendimento por categoria.',
          icon: <ScheduleIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('configuracoes.ver', user),
        },
        {
          to: '/configuracoes/cargos',
          title: 'Cargos',
          description: 'Perfis usados em usuários e aprovações.',
          icon: <BadgeIcon sx={{ fontSize: 28, color: NAVY }} />,
          show: temPermissao('configuracoes.ver', user),
        },
        {
          to: '/configuracoes/whatsapp',
          title: 'WhatsApp',
          description: 'Conectar sessão e enviar notificações de chamados.',
          icon: <WhatsAppIcon sx={{ fontSize: 28, color: '#25D366' }} />,
          show: temPermissao('configuracoes.ver', user),
        },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      cards: section.cards.filter((c) => c.show),
    }))
    .filter((section) => section.cards.length > 0);

  return (
    <Box className="max-w-3xl mx-auto w-full">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Parâmetros do sistema e cadastros administrativos
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sections.map((section) => (
          <Box key={section.title}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {section.title}
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {section.cards.map((card) => (
                <ConfigCard key={card.to} card={card} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
