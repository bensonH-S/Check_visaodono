import Box from '@mui/material/Box';
import type { RankingLoja } from '../../../api/client';
import CcEstoqueGrafico from './CcEstoqueGrafico';
import CcRanking from './CcRanking';
import { CC_BORDER, CC_RADIUS, CC_SURFACE } from './ccTheme';

export default function CcEsquerdo({
  loading,
  ranking,
}: {
  loading?: boolean;
  ranking: RankingLoja[];
}) {
  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.5,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <CcEstoqueGrafico />
      <Box sx={{ height: '1px', bgcolor: CC_BORDER, my: 1.5, flexShrink: 0 }} />
      <CcRanking loading={loading} ranking={ranking} embedded />
    </Box>
  );
}
