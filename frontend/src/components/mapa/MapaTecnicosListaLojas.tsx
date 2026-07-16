import { useMemo } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import MapaFiltroTrajetoCalendario from './MapaFiltroTrajetoCalendario';
import MapaFiltroTrajetoVeiculo from './MapaFiltroTrajetoVeiculo';
import { colors } from '../../theme/tokens';
import { rotuloRegiaoMapa } from '../../utils/mapaGeo';
import { getUsuario, modoAppTecnicoFrotaRestrito } from '../../lib/auth';

export default function MapaTecnicosListaLojas() {
  const {
    lojasComCoordenadas,
    regioes,
    regiaoFiltro,
    podeFiltrarRegioes,
    podeFiltrarDataTrajeto,
    dataTrajetoInicio,
    dataTrajetoFim,
    periodoTrajetoCompleto,
    selecionandoPeriodoTrajeto,
    ocultarRegioesIndividuaisTrajeto,
    modoHistoricoTrajeto,
    veiculoTrajetoId,
    selecionarRegiao,
    selecionarPeriodoTrajeto,
    selecionarVeiculoTrajeto,
    limparFiltrosTrajeto,
  } = useMapaTecnicosMobile();

  const hoje = dayjs().format('YYYY-MM-DD');
  const telefonePequeno = useMediaQuery('(max-width:400px)');
  const modoRestrito = modoAppTecnicoFrotaRestrito(getUsuario());

  const regiaoAtiva = useMemo(
    () => regioes.find((r) => Number(r.id_regiao) === Number(regiaoFiltro)) ?? null,
    [regioes, regiaoFiltro],
  );

  const nomeRegiaoExibido = useMemo(() => {
    const regiao = regiaoAtiva ?? regioes[0];
    if (!regiao) return null;
    return rotuloRegiaoMapa(regiao, {
      compacto: telefonePequeno,
      indiceLista: regioes.findIndex((r) => r.id_regiao === regiao.id_regiao),
    });
  }, [regiaoAtiva, regioes, telefonePequeno]);
  const qtdUnidades = lojasComCoordenadas.length;
  const filtroTrajetoAtivo =
    veiculoTrajetoId != null ||
    selecionandoPeriodoTrajeto ||
    dataTrajetoInicio !== hoje ||
    dataTrajetoFim !== hoje;

  if (modoRestrito) {
    return (
      <Box
        sx={{
          mb: 1,
          px: 1.5,
          py: 1.1,
          borderRadius: 2.5,
          bgcolor: '#fff',
          boxShadow: '0 2px 14px rgba(27, 42, 107, 0.08)',
          border: '1px solid rgba(27, 42, 107, 0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(232, 82, 10, 0.1)',
            color: colors.orange,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MapOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: colors.navy, fontSize: '0.9rem', lineHeight: 1.2 }}>
            Mapa ao vivo
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
            {[nomeRegiaoExibido, `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'}`]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        {nomeRegiaoExibido && (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 999,
              bgcolor: 'rgba(27, 42, 107, 0.06)',
            }}
          >
            <LocationOnOutlinedIcon sx={{ fontSize: 14, color: colors.orange }} />
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: colors.navy, whiteSpace: 'nowrap', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {nomeRegiaoExibido}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 0.25,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
          {podeFiltrarRegioes && regioes.length > 0 ? (
            <>
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
              {!ocultarRegioesIndividuaisTrajeto &&
                regioes.map((regiao, indice) => {
                const ativa = Number(regiaoFiltro) === Number(regiao.id_regiao);
                const rotulo = rotuloRegiaoMapa(regiao, { compacto: telefonePequeno, indiceLista: indice });
                return (
                  <Button
                    key={regiao.id_regiao}
                    onClick={() => selecionarRegiao(regiao.id_regiao)}
                    title={telefonePequeno ? regiao.nome : undefined}
                    startIcon={
                      <LocationOnOutlinedIcon
                        sx={{
                          fontSize: telefonePequeno ? '14px !important' : '15px !important',
                          ml: ativa ? 0 : telefonePequeno ? -0.15 : -0.25,
                        }}
                      />
                    }
                    sx={{
                      flexShrink: 0,
                      minWidth: 0,
                      px: telefonePequeno ? 1 : 1.5,
                      py: 0.85,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: telefonePequeno ? '0.72rem' : '0.8rem',
                      lineHeight: 1.2,
                      color: ativa ? '#fff' : 'rgba(27, 42, 107, 0.62)',
                      bgcolor: ativa ? colors.orange : 'rgba(27, 42, 107, 0.06)',
                      boxShadow: ativa ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
                      '& .MuiButton-startIcon': { mr: telefonePequeno ? 0.35 : 0.5 },
                      '&:hover': {
                        bgcolor: ativa ? colors.orange : 'rgba(27, 42, 107, 0.1)',
                      },
                    }}
                  >
                    {rotulo}
                  </Button>
                );
              })}
            </>
          ) : (
            nomeRegiaoExibido && (
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.65,
                  borderRadius: 999,
                  bgcolor: 'rgba(27, 42, 107, 0.06)',
                  borderLeft: `3px solid ${colors.orange}`,
                }}
              >
                <LocationOnOutlinedIcon sx={{ fontSize: 16, color: colors.orange, flexShrink: 0 }} />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: colors.navy, lineHeight: 1.2, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  {nomeRegiaoExibido}
                </Typography>
              </Box>
            )
          )}
          </Box>

          {podeFiltrarDataTrajeto && (
            <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 0.5 }}>
              <MapaFiltroTrajetoCalendario
                dataInicio={dataTrajetoInicio}
                dataFim={dataTrajetoFim}
                onPeriodoChange={selecionarPeriodoTrajeto}
              />
              {modoHistoricoTrajeto && periodoTrajetoCompleto && (
                <MapaFiltroTrajetoVeiculo
                  veiculoId={veiculoTrajetoId}
                  regiaoFiltro={regiaoFiltro}
                  onSelect={selecionarVeiculoTrajeto}
                />
              )}
              {filtroTrajetoAtivo && (
                <Tooltip title="Limpar filtro de data e trajeto" arrow>
                  <IconButton
                    size="small"
                    onClick={limparFiltrosTrajeto}
                    aria-label="Limpar filtros de trajeto"
                    sx={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      bgcolor: 'rgba(220, 38, 38, 0.1)',
                      color: '#dc2626',
                      '&:hover': { bgcolor: 'rgba(220, 38, 38, 0.18)' },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.85,
            px: 0.25,
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {podeFiltrarDataTrajeto
            ? selecionandoPeriodoTrajeto
              ? 'Escolha a data final do período no calendário.'
              : modoHistoricoTrajeto
                ? 'Escolha o veículo para ver o trajeto do período.'
                : 'Toque no veículo no mapa para ver o trajeto de hoje.'
            : podeFiltrarRegioes && regiaoAtiva
              ? `${rotuloRegiaoMapa(regiaoAtiva, {
                  compacto: telefonePequeno,
                  indiceLista: regioes.findIndex((r) => r.id_regiao === regiaoAtiva.id_regiao),
                })} · ${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa para escolher`
              : podeFiltrarRegioes
                ? `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa para escolher`
                : 'Toque no mapa para escolher a unidade'}
        </Typography>
      </Box>
    </Box>
  );
}
