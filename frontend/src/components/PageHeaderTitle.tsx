import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PageTitleConfig } from '../config/pageTitles';

export default function PageHeaderTitle({ title, icon }: PageTitleConfig) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: { xs: 28, sm: 30 },
          height: { xs: 28, sm: 30 },
          borderRadius: 1.25,
          bgcolor: '#E8EBF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: { xs: 18, sm: 20 } },
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          fontSize: { xs: '0.85rem', sm: '0.92rem', md: '0.95rem' },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}
