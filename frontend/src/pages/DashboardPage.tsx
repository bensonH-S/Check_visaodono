import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { api } from '../api/client';
import type { DashboardData, FrotaMapaPosicoes, RankingLoja } from '../api/client';
import { podeVerMapaTecnicosMobile } from '../lib/auth';
import { useCommandCenterFilters } from '../context/CommandCenterFiltersContext';
import CcKpiRow from '../components/dashboard/commandCenter/CcKpiRow';
import CcAtencao from '../components/dashboard/commandCenter/CcAtencao';
import CcRanking from '../components/dashboard/commandCenter/CcRanking';
import CcFrota from '../components/dashboard/commandCenter/CcFrota';
import CcNcsDonut from '../components/dashboard/commandCenter/CcNcsDonut';
import CcEvolucao from '../components/dashboard/commandCenter/CcEvolucao';
import CcAtividades from '../components/dashboard/commandCenter/CcAtividades';
import { LIMITE_VELOCIDADE_KMH } from '../components/dashboard/commandCenter/ccFormat';

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

  const ncsPorGravidade = useMemo(() => {
    if (!data) return [];
    if (data.ncs_por_gravidade?.length) return data.ncs_por_gravidade;
    const m = data.metricas;
    if (m.total_ncs_abertas <= 0) return [];
    return [
      { gravidade: 'Crítica', total: m.ncs_criticas },
      { gravidade: 'Moderada', total: m.ncs_moderadas ?? Math.max(0, m.total_ncs_abertas - m.ncs_criticas) },
      { gravidade: 'Baixa', total: m.ncs_leves ?? 0 },
    ].filter((n) => n.total > 0);
  }, [data]);

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
  const atencao = data?.atencao;
  const atividades = data?.atividades;

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.95fr) minmax(420px, 1.35fr)' },
          gridTemplateRows: { lg: 'auto 1fr' },
          gridTemplateAreas: {
            xs: `
              "atencao"
              "ranking"
              "frota"
              "ncs"
              "evolucao"
              "atividades"
            `,
            lg: `
              "atencao frota"
              "ranking frota"
            `,
          },
        }}
      >
        <Box sx={{ gridArea: 'atencao' }}>
          <CcAtencao loading={loading && !data} data={atencao} />
        </Box>
        <Box sx={{ gridArea: 'ranking' }}>
          <CcRanking loading={loading && !ranking.length} ranking={ranking} />
        </Box>
        <Box sx={{ gridArea: 'frota', minHeight: { lg: 520 } }}>
          <CcFrota
            loading={loadingFrota && !frota}
            data={frota}
            erro={errFrota}
            onRefresh={carregarFrota}
            dataRef={dataFiltro}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.25, md: 2 },
          gridTemplateColumns: {
            xs: 'minmax(0, 0.9fr) minmax(0, 1.05fr) minmax(0, 1fr)',
            lg: 'minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 0.95fr)',
          },
          alignItems: 'stretch',
          minWidth: 0,
        }}
      >
        <CcNcsDonut
          loading={loading && !data}
          ncsPorGravidade={ncsPorGravidade}
          totalAbertas={m?.total_ncs_abertas ?? 0}
        />
        <CcEvolucao
          loading={loading && !data}
          serie={data?.evolucao_performance ?? []}
          mediaAtual={m?.media_geral ?? 0}
          variacaoMes={m?.variacao_mes}
        />
        <CcAtividades
          loading={loading && !data}
          auditoriasHoje={atividades?.auditorias_hoje ?? 0}
          ncsCriticas={atividades?.ncs_criticas ?? m?.ncs_criticas ?? 0}
          lojasAbaixoMeta={atividades?.lojas_abaixo_meta ?? m?.lojas_abaixo_75 ?? 0}
          veiculosAlerta={veiculosAlerta}
        />
      </Box>
    </Box>
  );
}
