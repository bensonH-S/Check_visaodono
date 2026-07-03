import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import { colors } from '../../theme/tokens';

export default function MapaTecnicosListaLojas() {
  const {
    lojasComCoordenadas,
    regioes,
    regiaoFiltro,
    podeFiltrarRegioes,
    selecionarRegiao,
  } = useMapaTecnicosMobile();

  const regiaoAtiva = useMemo(
    () => regioes.find((r) => Number(r.id_regiao) === Number(regiaoFiltro)) ?? null,
    [regioes, regiaoFiltro],
  );

  const nomeRegiaoExibido = regiaoAtiva?.nome ?? regioes[0]?.nome ?? null;
  const qtdUnidades = lojasComCoordenadas.length;

  return (
    <Box
      sx={{
        mb: 1,
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: '#fff',
        boxShadow: '0 2px 14px rgba(27, 42, 107, 0.08)',
        border: '1px solid rgba(27, 42, 107, 0.07)',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: 'rgba(27, 42, 107, 0.04)',
          borderBottom: '1px solid rgba(27, 42, 107, 0.06)',
        }}
      >
        <MapOutlinedIcon sx={{ fontSize: 17, color: colors.navy, opacity: 0.85 }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: colors.navy, letterSpacing: 0.2 }}>
          {podeFiltrarRegioes ? 'Escolha a região' : 'Sua região'}
        </Typography>
      </Box>

      <Box sx={{ p: 1.25 }}>
        {podeFiltrarRegioes && regioes.length > 0 ? (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 0.25,
              mx: -0.25,
              px: 0.25,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Button
              onClick={() => selecionarRegiao('')}
              sx={{
                flexShrink: 0,
                minWidth: 0,
                px: 1.75,
                py: 0.85,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                lineHeight: 1.2,
                color: regiaoFiltro === '' ? '#fff' : 'rgba(27, 42, 107, 0.62)',
                bgcolor: regiaoFiltro === '' ? colors.orange : 'rgba(27, 42, 107, 0.06)',
                boxShadow: regiaoFiltro === '' ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
                '&:hover': {
                  bgcolor: regiaoFiltro === '' ? colors.orange : 'rgba(27, 42, 107, 0.1)',
                },
              }}
            >
              Todas
            </Button>
            {regioes.map((regiao) => {
              const ativa = Number(regiaoFiltro) === Number(regiao.id_regiao);
              return (
                <Button
                  key={regiao.id_regiao}
                  onClick={() => selecionarRegiao(regiao.id_regiao)}
                  startIcon={
                    <LocationOnOutlinedIcon
                      sx={{ fontSize: '15px !important', ml: ativa ? 0 : -0.25 }}
                    />
                  }
                  sx={{
                    flexShrink: 0,
                    minWidth: 0,
                    px: 1.5,
                    py: 0.85,
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    lineHeight: 1.2,
                    color: ativa ? '#fff' : 'rgba(27, 42, 107, 0.62)',
                    bgcolor: ativa ? colors.orange : 'rgba(27, 42, 107, 0.06)',
                    boxShadow: ativa ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
                    '& .MuiButton-startIcon': { mr: 0.5 },
                    '&:hover': {
                      bgcolor: ativa ? colors.orange : 'rgba(27, 42, 107, 0.1)',
                    },
                  }}
                >
                  {regiao.nome}
                </Button>
              );
            })}
          </Box>
        ) : (
          nomeRegiaoExibido && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 1.1,
                borderRadius: 2,
                bgcolor: 'rgba(27, 42, 107, 0.05)',
                borderLeft: `4px solid ${colors.orange}`,
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(232, 82, 10, 0.12)',
                  flexShrink: 0,
                }}
              >
                <LocationOnOutlinedIcon sx={{ fontSize: 19, color: colors.orange }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 800, color: colors.navy, lineHeight: 1.25, fontSize: '0.9rem' }}
                >
                  {nomeRegiaoExibido}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {qtdUnidades} {qtdUnidades === 1 ? 'unidade' : 'unidades'} no mapa
                </Typography>
              </Box>
            </Box>
          )
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: podeFiltrarRegioes ? 1 : 0.85,
            px: 0.25,
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {podeFiltrarRegioes && regiaoAtiva
            ? `${regiaoAtiva.nome} · ${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa para escolher`
            : podeFiltrarRegioes
              ? `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa para escolher`
              : 'Toque no mapa para escolher a unidade'}
        </Typography>
      </Box>
    </Box>
  );
}
