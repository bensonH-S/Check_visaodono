import Box from '@mui/material/Box';
import IndicadoresPage from './IndicadoresPage';

/**
 * Command Center = painel de Indicadores.
 * Ocupa a área útil e não rola a página: a lista longa rola dentro do card.
 */
export default function DashboardPage() {
  return (
    <Box
      className="cc-page-main"
      sx={{
        width: '100%',
        flex: { xs: '0 0 auto', md: 1 },
        minHeight: { md: 0 },
        display: 'flex',
        flexDirection: 'column',
        overflow: { xs: 'visible', md: 'hidden' },
      }}
    >
      <IndicadoresPage embedded />
    </Box>
  );
}
