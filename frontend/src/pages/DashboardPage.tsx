import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { api } from '../api/client';
import type { FrotaMapaPosicoes } from '../api/client';
import { getUsuario, podeVerFinanceiro, podeVerMapaTecnicosMobile } from '../lib/auth';
import { useCommandCenterFilters } from '../context/CommandCenterFiltersContext';
import CcKpiRow from '../components/dashboard/commandCenter/CcKpiRow';
import CcEsquerdo from '../components/dashboard/commandCenter/CcEsquerdo';
import CcFrota from '../components/dashboard/commandCenter/CcFrota';
import CcEstoque from '../components/dashboard/commandCenter/CcEstoque';
import CcFinanceiro from '../components/dashboard/commandCenter/CcFinanceiro';
import CcFreecontrolGastos from '../components/dashboard/commandCenter/CcFreecontrolGastos';
import { CC_BG, CC_BOTTOM_H, CC_GAP } from '../components/dashboard/commandCenter/ccTheme';

export default function DashboardPage() {
  const { data: dataFiltro, regiaoId } = useCommandCenterFilters();
  const [frota, setFrota] = useState<FrotaMapaPosicoes | null>(null);
  const [loadingFrota, setLoadingFrota] = useState(false);
  const [errFrota, setErrFrota] = useState<string | null>(null);

  const user = getUsuario();
  const podeFrota = podeVerMapaTecnicosMobile();
  const podeFinanceiro = podeVerFinanceiro(user);

  const carregarFrota = useCallback(() => {
    if (!podeFrota) {
      setFrota(null);
      setErrFrota('Sem permissão para visualizar o mapa da frota.');
      return;
    }
    setLoadingFrota(true);
    setErrFrota(null);
    api
      .frotaMapaPosicoes({ id_regiao: regiaoId })
      .then(setFrota)
      .catch((e) => {
        setFrota(null);
        setErrFrota(e?.message || 'Não foi possível carregar a frota.');
      })
      .finally(() => setLoadingFrota(false));
  }, [podeFrota, regiaoId]);

  useEffect(() => {
    carregarFrota();
  }, [carregarFrota]);

  useEffect(() => {
    if (!podeFrota) return;
    const id = window.setInterval(() => carregarFrota(), 60_000);
    return () => window.clearInterval(id);
  }, [podeFrota, carregarFrota]);

  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: 'auto', lg: '100%' },
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: { xs: 'auto', lg: 'auto minmax(0, 1fr)' },
        gap: CC_GAP,
        bgcolor: CC_BG,
      }}
    >
      <CcKpiRow podeFinanceiro={podeFinanceiro} />

      <Box
        sx={{
          display: 'grid',
          gap: CC_GAP,
          minHeight: 0,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, 0.55fr) minmax(0, 1.45fr)' },
          gridTemplateRows: { xs: 'auto', lg: `minmax(0, 1fr) ${CC_BOTTOM_H}px` },
        }}
      >
        <CcEsquerdo />
        <Box sx={{ minHeight: { xs: 360, lg: 0 }, height: '100%', minWidth: 0 }}>
          <CcFrota
            loading={loadingFrota && !frota}
            data={frota}
            erro={errFrota}
            onRefresh={carregarFrota}
            dataRef={dataFiltro}
          />
        </Box>
        <CcEstoque />
        <Box sx={{ minHeight: 0, minWidth: 0, height: '100%' }}>
          {podeFinanceiro ? <CcFinanceiro /> : <CcFreecontrolGastos />}
        </Box>
      </Box>
    </Box>
  );
}
