import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import TecnicoProximoPainel from '../../components/mapa/TecnicoProximoPainel';
import TecnicoFocoPainel from '../../components/mapa/TecnicoFocoPainel';
import { useMapaTecnicosMobile } from './MapaTecnicosMobileContext';
import { useAppConfig } from '../../hooks/useAppConfig';

export default function MapaTecnicosMobilePage() {
  const appConfig = useAppConfig();
  const {
    posicoes,
    lojas,
    lojaSelecionada,
    tecnicoFoco,
    proximidade,
    erro,
    selecionarLoja,
    limparLoja,
    focarTecnico,
    limparTecnicoFoco,
  } = useMapaTecnicosMobile();

  const tecnicoDestaqueId =
    lojaSelecionada && proximidade?.tecnico
      ? proximidade.tecnico.id_usuario
      : tecnicoFoco?.id_usuario ?? null;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        mx: { xs: -2, sm: -2.5 },
        mb: -1,
      }}
    >
      {erro && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, flexShrink: 0, py: 0.5, fontSize: '0.8rem' }}>
          {erro}
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <FrotaLocalizacaoMap
          posicoes={posicoes}
          lojas={lojas}
          gpsAtivo={appConfig?.gpsTecnicosEnabled !== false}
          onAtualizar={() => {}}
          preencherAltura
          visivel
          modo="mobile"
          mostrarBotaoAtualizar={false}
          mostrarAlternarTipoMapa={false}
          tecnicoDestaqueId={tecnicoDestaqueId}
          lojaDestaqueId={lojaSelecionada?.id_loja ?? null}
          onLojaClick={selecionarLoja}
          onTecnicoClick={(tecnico) => {
            if (!lojaSelecionada) focarTecnico(tecnico);
          }}
        />

        {(lojaSelecionada || tecnicoFoco) && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 12,
              zIndex: 1200,
              pointerEvents: 'auto',
            }}
          >
            {lojaSelecionada ? (
              <TecnicoProximoPainel
                loja={lojaSelecionada}
                tecnico={proximidade?.tecnico ?? null}
                distanciaKm={proximidade?.distanciaKm ?? null}
                onClose={limparLoja}
              />
            ) : tecnicoFoco ? (
              <TecnicoFocoPainel tecnico={tecnicoFoco} onClose={limparTecnicoFoco} />
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}
