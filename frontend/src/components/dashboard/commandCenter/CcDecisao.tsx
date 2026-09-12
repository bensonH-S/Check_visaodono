import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api, type DashboardAtencao, type DashboardAtividades } from '../../../api/client';
import { useCommandCenterFilters } from '../../../context/CommandCenterFiltersContext';
import { fmtInt } from './ccFormat';
import { CC_MUTED, CC_ORANGE } from './ccTheme';
import { CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

type Item = {
  key: string;
  label: string;
  count: number;
  to: string;
  urgente: boolean;
};

export default function CcDecisao({
  loading,
  atencao,
  atividades,
}: {
  loading?: boolean;
  atencao?: DashboardAtencao | null;
  atividades?: DashboardAtividades | null;
}) {
  const { data: dataFiltro } = useCommandCenterFilters();
  const [semContagem, setSemContagem] = useState(0);
  const [itensZerados, setItensZerados] = useState(0);
  const [pendencias, setPendencias] = useState(0);
  const [estoqueOk, setEstoqueOk] = useState(false);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.estoqueContagensRede({ tipo: 'diaria', data: dataFiltro }).catch(() => null),
      api.estoqueSaldosRedeBaixo().catch(() => null),
      api.estoqueSaudeBaixa({ escopo: 'rede' }).catch(() => null),
    ]).then(([rede, baixo, saude]) => {
      if (cancel) return;
      setEstoqueOk(Boolean(rede));
      setSemContagem((rede?.lojas || []).filter((l) => l.status === 'faltou').length);
      setItensZerados(baixo?.itens?.length ?? 0);
      setPendencias(saude?.problemas?.length ?? 0);
    });
    return () => {
      cancel = true;
    };
  }, [dataFiltro]);

  const itens = useMemo(() => {
    const raw: Item[] = [
      {
        key: 'contagem',
        label: 'Lojas sem contagem diária',
        count: semContagem,
        to: '/estoque',
        urgente: true,
      },
      {
        key: 'zerados',
        label: 'Itens da diária zerados',
        count: itensZerados,
        to: '/estoque',
        urgente: true,
      },
      {
        key: 'pendencias',
        label: 'Pendências na baixa automática',
        count: pendencias,
        to: '/estoque',
        urgente: true,
      },
      {
        key: 'verificacao',
        label: 'NCs aguardando verificação',
        count: atencao?.aguardando_verificacao ?? 0,
        to: '/nao-conformidades?status=Em+andamento',
        urgente: false,
      },
      {
        key: 'auditorias',
        label: 'Auditorias para hoje',
        count: atividades?.auditorias_hoje ?? 0,
        to: '/escalas/visitas',
        urgente: false,
      },
    ];
    return raw.filter((i) => i.count > 0).slice(0, 5);
  }, [atencao, atividades, itensZerados, pendencias, semContagem]);

  return (
    <CcPanel title="Agir agora" action="Ver estoque" actionTo="/estoque" minHeight={0}>
      {loading ? (
        <CcSkeleton height={140} />
      ) : !itens.length ? (
        <CcEmpty>{estoqueOk ? 'Nada urgente na operação agora.' : 'Sem dados extras para a fila.'}</CcEmpty>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, flex: 1, minHeight: 0 }}>
          {itens.map((item) => (
            <Box
              key={item.key}
              component={RouterLink}
              to={item.to}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 0.25,
                py: 0.55,
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              <Typography
                sx={{
                  minWidth: 28,
                  fontSize: '0.9375rem',
                  fontWeight: 750,
                  color: item.urgente ? CC_ORANGE : CC_MUTED,
                  lineHeight: 1,
                  textAlign: 'right',
                }}
              >
                {fmtInt(item.count)}
              </Typography>
              <Typography
                sx={{
                  flex: 1,
                  fontSize: '0.75rem',
                  color: 'var(--ga-text-secondary)',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </CcPanel>
  );
}
