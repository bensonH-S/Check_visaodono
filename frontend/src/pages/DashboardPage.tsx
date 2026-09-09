import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { api } from '../api/client';
import type { DashboardData, FrotaMapaPosicoes, RankingLoja } from '../api/client';
import { podeVerMapaTecnicosMobile } from '../lib/auth';
import { useCommandCenterFilters } from '../context/CommandCenterFiltersContext';
import CcKpiRow from '../components/dashboard/commandCenter/CcKpiRow';
import CcEsquerdo from '../components/dashboard/commandCenter/CcEsquerdo';
import CcFrota from '../components/dashboard/commandCenter/CcFrota';
import CcEstoque from '../components/dashboard/commandCenter/CcEstoque';
import CcFreecontrolGastos from '../components/dashboard/commandCenter/CcFreecontrolGastos';
import CcVisao from '../components/dashboard/commandCenter/CcVisao';
import { LIMITE_VELOCIDADE_KMH } from '../components/dashboard/commandCenter/ccFormat';
import { CC_BG, CC_GAP } from '../components/dashboard/commandCenter/ccTheme';

export default function DashboardPage() {
  const { data: dataFiltro, regiaoId } = useCommandCenterFilters();
  const [data, setData] = useState<DashboardData | null>(null);
  const [ranking, setRanking] = useState<RankingLoja[]>([]);
  const [frota, setFrota] = useState<FrotaMapaPosicoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFrota, setLoadingFrota] = useState(false);
  const [err, setErr] = useState('');
  const [errFrota, setErrFrota] = useState<string | null>(null);

  const podeFrota = podeVerMapaTecnicosMobile();
  const filtrosDash = useMemo(
    () => ({ data: dataFiltro, id_regiao: regiaoId }),
    [dataFiltro, regiaoId],
  );

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

  const carregar = useCallback(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      api.dashboard(filtrosDash),
      api.ranking({ id_regiao: regiaoId }).catch(() => [] as RankingLoja[]),
    ])
      .then(([dash, rank]) => {
        setData(dash);
        setRanking(rank.length ? rank : dash.ranking || []);
      })
      .catch((e) => setErr(e?.message || 'Falha ao carregar o Command Center.'))
      .finally(() => setLoading(false));
    carregarFrota();
  }, [carregarFrota, filtrosDash, regiaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!podeFrota) return;
    const id = window.setInterval(() => carregarFrota(), 60_000);
    return () => window.clearInterval(id);
  }, [podeFrota, carregarFrota]);

  const veiculosAlerta = useMemo(() => {
    if (!podeFrota) return null;
    if (!frota) return loadingFrota ? null : 0;
    return frota.veiculos.filter((v) => {
      const vel = Number(v.velocidade);
      return Number.isFinite(vel) && vel > LIMITE_VELOCIDADE_KMH;
    }).length;
  }, [frota, podeFrota, loadingFrota]);

  if (err && !data) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
        <Button variant="contained" onClick={carregar} sx={{ bgcolor: 'var(--ga-orange)' }}>
          Tentar novamente
        </Button>
      </Box>
    );
  }

  const m = data?.metricas;

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
      <CcKpiRow
        loading={loading && !data}
        mediaGeral={m?.media_geral ?? 0}
        variacaoMes={m?.variacao_mes}
        sparkline={m?.sparkline}
        visitasMes={m?.visitas_mes ?? 0}
        visitasPlanejadas={m?.visitas_planejadas}
        ncsAbertas={m?.total_ncs_abertas ?? 0}
        ncsCriticas={m?.ncs_criticas ?? 0}
        ncsModeradas={m?.ncs_moderadas ?? 0}
        lojasRisco={m?.lojas_abaixo_75 ?? 0}
        veiculosAlerta={veiculosAlerta}
      />

      <Box
        sx={{
          display: 'grid',
          gap: CC_GAP,
          minHeight: 0,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 0.68fr) minmax(0, 1.32fr)' },
          gridTemplateRows: { xs: 'auto', lg: 'minmax(0, 1fr) 200px' },
        }}
      >
        <CcEsquerdo loading={loading && !data} ranking={ranking} />
        <Box sx={{ minHeight: { xs: 440, lg: 0 }, height: '100%', minWidth: 0 }}>
          <CcFrota
            loading={loadingFrota && !frota}
            data={frota}
            erro={errFrota}
            onRefresh={carregarFrota}
            dataRef={dataFiltro}
          />
        </Box>
        <CcEstoque />
        <Box
          sx={{
            display: 'grid',
            gap: CC_GAP,
            minHeight: 0,
            minWidth: 0,
            height: '100%',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          }}
        >
          <CcFreecontrolGastos />
          <CcVisao />
        </Box>
      </Box>
    </Box>
  );
}
