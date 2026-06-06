import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PageTitleConfig } from '../config/pageTitles';

export default function PageHeaderTitle({ title, icon }: PageTitleConfig) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          bgcolor: '#E8EBF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          fontSize: { xs: '0.9rem', sm: '1rem' },
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
