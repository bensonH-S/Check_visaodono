import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AzimutMarca } from '../brand/AzimutMarca'
import { usePrefs } from '../prefs'

export function ModuloPage({ titulo }: { titulo: string }) {
  const { t } = usePrefs()
  return (
    <Box sx={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <AzimutMarca sx={{ width: 'min(280px, 86%)', mb: 1.5 }} />
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em', fontWeight: 500 }}>
        {t('Em desenvolvimento', 'In progress')}
      </Typography>
      <Typography variant="h5">{titulo}</Typography>
    </Box>
  )
}
