import Box from '@mui/material/Box';

type Props = {
  count?: number;
  size?: 'small' | 'medium';
};

export default function NotificacaoBadge({ count = 0, size = 'small' }: Props) {
  if (!count || count <= 0) return null;

  const dim = size === 'small' ? 18 : 22;
  const fontSize = size === 'small' ? '0.65rem' : '0.72rem';

  return (
    <Box
      component="span"
      sx={{
        minWidth: dim,
        height: dim,
        borderRadius: '50%',
        bgcolor: '#DC2626',
        color: '#fff',
        fontSize,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.5,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count > 99 ? '99+' : count}
    </Box>
  );
}
