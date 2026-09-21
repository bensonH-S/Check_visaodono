import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme/tokens';

type Props = {
  titulo: string;
  nomeUsuario?: string | null;
  /** Tag de região/loja à direita do "Olá" */
  tagRegiao?: string | null;
  tagRegiaoTitulo?: string | null;
  /** Gerente/coordenador: mostra o nome completo da loja */
  tagExpandida?: boolean;
  /** Oculta só a tag de loja/região ao lado do "Olá" */
  ocultarTagLoja?: boolean;
  /** Layout enxuto — páginas com muito conteúdo rolável (ex.: escala) */
  compacto?: boolean;
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
  ocultarTagLoja = false,
  compacto = false,
}: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : '#1B2A6B';

  return (
    <Box sx={{ mb: compacto ? 0.75 : 1.75, pt: 0.25, pl: 0.25 }}>
      {!compacto && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minWidth: 0,
          mb: 0.75,
        }}
      >
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: '0.84rem',
            lineHeight: 1.3,
            color: colors.textSecondary,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Olá,{' '}
          <Box component="span" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            {nomeSaudacao(nomeUsuario)}
          </Box>
        </Typography>
        {!ocultarTagLoja && tagRegiao && (
          <Box
            component="span"
            title={tagRegiaoTitulo ?? tagRegiao}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.35,
              px: tagExpandida ? 1 : 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: escuro ? 'rgba(232, 82, 10, 0.16)' : 'rgba(27, 42, 107, 0.07)',
              border: `1px solid ${escuro ? 'rgba(232, 82, 10, 0.28)' : 'rgba(27, 42, 107, 0.14)'}`,
              flexShrink: 0,
              maxWidth: tagExpandida ? '100%' : 120,
              overflow: 'hidden',
            }}
          >
            <LocationOnOutlinedIcon
              sx={{ fontSize: 11, color: acento, flexShrink: 0 }}
            />
            <Typography
              component="span"
              sx={{
                fontSize: tagExpandida ? '0.72rem' : '0.68rem',
                fontWeight: 700,
                color: acento,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tagRegiao}
            </Typography>
          </Box>
        )}
      </Box>
      )}
      <Typography
        component="h1"
        sx={{
          fontWeight: 800,
          fontSize: compacto ? '1.28rem' : '1.42rem',
          lineHeight: 1.15,
          color: colors.textPrimary,
          letterSpacing: '-0.03em',
        }}
      >
        {titulo}
      </Typography>
    </Box>
  );
}
