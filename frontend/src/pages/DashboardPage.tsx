import Box from '@mui/material/Box';
import IndicadoresPage from './IndicadoresPage';

/**
 * Command Center = painel de Indicadores (vendas, CMV por loja, canais, estimativa).
 * Preenche a altura do layout; o scroll fica dentro dos painéis quando a tela é baixa.
 */
export default function DashboardPage() {
  return (
    <Box
      className="cc-page-main"
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <IndicadoresPage embedded />
    </Box>
  );
}
