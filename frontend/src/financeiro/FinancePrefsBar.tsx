import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import { usePrefs } from './prefs'

/** Idioma PT/EN do módulo financeiro — mesmo controle do Azimut. */
export default function FinancePrefsBar() {
  const { idioma, setIdioma } = usePrefs()

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, flexShrink: 0 }}>
      <ButtonGroup size="small" variant="outlined" aria-label="Idioma">
        <Button
          onClick={() => setIdioma('pt')}
          sx={{
            minWidth: 36,
            px: 1,
            fontWeight: idioma === 'pt' ? 700 : 500,
            bgcolor: idioma === 'pt' ? 'action.selected' : 'background.paper',
          }}
        >
          PT
        </Button>
        <Button
          onClick={() => setIdioma('en')}
          sx={{
            minWidth: 36,
            px: 1,
            fontWeight: idioma === 'en' ? 700 : 500,
            bgcolor: idioma === 'en' ? 'action.selected' : 'background.paper',
          }}
        >
          EN
        </Button>
      </ButtonGroup>
    </Box>
  )
}
