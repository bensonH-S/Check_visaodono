import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import marca from './azimut-logo.svg?raw'

export function AzimutMarca({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[{
        width: '100%',
        lineHeight: 0,
        '& svg': { width: '100%', height: 'auto', display: 'block' },
      }, ...(Array.isArray(sx) ? sx : [sx])]}
      dangerouslySetInnerHTML={{ __html: marca }}
    />
  )
}
