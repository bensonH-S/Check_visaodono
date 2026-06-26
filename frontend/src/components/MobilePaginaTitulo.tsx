import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

type Props = {
  titulo: string;
  nomeUsuario?: string | null;
  /** Tag de região/loja à direita do “Olá” */
  tagRegiao?: string | null;
  tagRegiaoTitulo?: string | null;
  /** Gerente/coordenador: mostra o nome completo da loja */
  tagExpandida?: boolean;
};

function nomeSaudacao(nome?: string | null) {
  return nome?.trim() || 'utilizador';
}

export default function MobilePaginaTitulo({
  titulo,
  nomeUsuario,
  tagRegiao,
  tagRegiaoTitulo,
  tagExpandida = false,
}: Props) {
  return (
    <Box sx={{ mb: 2, pt: 0, pl: 0.5 }}>
      <Typography
        component="h1"
        sx={{
          fontWeight: 900,
          fontSize: '1.95rem',
          lineHeight: 1.1,
          color: NAVY,
          letterSpacing: '-0.03em',
          mb: 1.25,
        }}
      >
        {titulo}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            fontWeight: 400,
            fontSize: '0.95rem',
            lineHeight: 1.3,
            color: NAVY,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Olá,{' '}
          <Box component="span" sx={{ fontWeight: 700 }}>
            {nomeSaudacao(nomeUsuario)}
          </Box>
        </Typography>
        {tagRegiao && (
          <Box
            component="span"
            sx={{
              flex: '0 0 auto',
              flexShrink: tagExpandida ? 1 : 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.35,
              px: 1,
              py: 0.35,
              borderRadius: 999,
              bgcolor: 'rgba(27, 42, 107, 0.07)',
              border: '1px solid rgba(27, 42, 107, 0.1)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: NAVY,
              letterSpacing: '0.02em',
              width: tagExpandida ? 'max-content' : undefined,
              maxWidth: tagExpandida ? 'calc(100% - 7.5rem)' : 140,
              minWidth: 0,
              overflow: 'hidden',
            }}
            title={tagRegiaoTitulo ?? tagRegiao}
          >
            <LocationOnOutlinedIcon sx={{ fontSize: 14, color: ORANGE, flexShrink: 0 }} />
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.25,
              }}
            >
              {tagRegiao}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
