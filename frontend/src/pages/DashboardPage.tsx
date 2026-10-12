import Box from '@mui/material/Box';
import { getUsuario, podeVerFinanceiro } from '../lib/auth';
import { useCommandCenterFilters } from '../context/CommandCenterFiltersContext';
import CcCanalVendas from '../components/dashboard/commandCenter/CcCanalVendas';
import CcContagem from '../components/dashboard/commandCenter/CcContagem';
import CcFilaPagamento from '../components/dashboard/commandCenter/CcFilaPagamento';
import CcHeroFinanceiro from '../components/dashboard/commandCenter/CcHeroFinanceiro';
import { useCcData } from '../components/dashboard/commandCenter/useCcData';
import { CC_BG } from '../components/dashboard/commandCenter/ccTheme';
import '../components/dashboard/commandCenter/commandCenter.css';

/** Command Center — KPIs, canais, fila por loja e contagem com responsável. */
export default function DashboardPage() {
  const { data: dataFiltro } = useCommandCenterFilters();
  const user = getUsuario();
  const podeFinanceiro = podeVerFinanceiro(user);
  const { despesas, contagem, loading, erroFin, erroContagem } = useCcData({
    podeFinanceiro,
    data: dataFiltro,
  });

  return (
    <Box
      className="cc-page-main"
      sx={{
        width: '100%',
        height: { xs: 'auto', lg: '100%' },
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        bgcolor: CC_BG,
        backgroundImage:
          'radial-gradient(1100px 380px at 10% -12%, rgba(27, 110, 243, 0.07), transparent 55%), radial-gradient(800px 320px at 90% 0%, rgba(232, 82, 10, 0.04), transparent 50%)',
        overflow: { xs: 'visible', lg: 'hidden' },
        pb: { xs: 1, lg: 0 },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <CcHeroFinanceiro despesas={despesas} loading={loading} podeFinanceiro={podeFinanceiro} />
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
        }}
      >
        <CcCanalVendas canal="cielo" />
        <CcCanalVendas canal="ifood" />
        <CcCanalVendas canal="noventaeneve" />
      </Box>

      <Box
        sx={{
          flex: { lg: '1 1 0' },
          minHeight: { xs: 480, lg: 280 },
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 1.2fr)' },
          overflow: 'hidden',
        }}
      >
        <Box sx={{ minWidth: 0, minHeight: { xs: 320, lg: 0 }, height: { lg: '100%' } }}>
          <CcFilaPagamento despesas={despesas} loading={loading} erro={erroFin} />
        </Box>
        <Box sx={{ minWidth: 0, minHeight: { xs: 380, lg: 0 }, height: { lg: '100%' } }}>
          <CcContagem lojas={contagem} loading={loading} erro={erroContagem} />
        </Box>
      </Box>
    </Box>
  );
}
