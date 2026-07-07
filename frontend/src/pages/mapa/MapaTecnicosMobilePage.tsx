import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import TecnicoProximoPainel from '../../components/mapa/TecnicoProximoPainel';
import TecnicoFocoPainel from '../../components/mapa/TecnicoFocoPainel';
import { useCallback, useEffect, useState } from 'react';
import { api, type FrotaVeiculoHistoricoPonto } from '../../api/client';
import { useMapaTecnicosMobile } from './MapaTecnicosMobileContext';
import { useAppConfig } from '../../hooks/useAppConfig';

export default function MapaTecnicosMobilePage() {
  const appConfig = useAppConfig();
  const {
    posicoes,
    veiculos,
    lojas,
    lojaSelecionada,
    tecnicoFoco,
    veiculoFoco,
    proximidade,
    rastreamentoAtivo,
    erro,
    selecionarLoja,
    limparLoja,
    focarTecnico,
    limparTecnicoFoco,
    focarVeiculo,
  } = useMapaTecnicosMobile();

  const [historicoVeiculo, setHistoricoVeiculo] = useState<FrotaVeiculoHistoricoPonto[]>([]);

  const carregarHistoricoVeiculo = useCallback(async (idVeiculo: number) => {
    try {
      const fim = Math.floor(Date.now() / 1000);
      const inicio = fim - 24 * 60 * 60;
      const data = await api.frotaVeiculoHistoricoRastreamento(idVeiculo, { inicio, fim });
      setHistoricoVeiculo(data.pontos);
    } catch {
      setHistoricoVeiculo([]);
    }
  }, []);

  useEffect(() => {
    if (!veiculoFoco) {
      setHistoricoVeiculo([]);
      return;
    }
    void carregarHistoricoVeiculo(veiculoFoco.id_veiculo);
  }, [veiculoFoco, carregarHistoricoVeiculo]);

  const tecnicoDestaqueId =
    lojaSelecionada && proximidade?.tecnico
      ? proximidade.tecnico.id_usuario
      : tecnicoFoco?.id_usuario ?? null;

  const veiculoDestaqueId = veiculoFoco?.id_veiculo ?? null;

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
          veiculos={veiculos}
          historicoVeiculo={historicoVeiculo}
          gpsAtivo={appConfig?.gpsTecnicosEnabled !== false}
          rastreamentoAtivo={rastreamentoAtivo}
          onAtualizar={() => {}}
          preencherAltura
          visivel
          modo="mobile"
          mostrarBotaoAtualizar={false}
          mostrarAlternarTipoMapa={false}
          tecnicoDestaqueId={tecnicoDestaqueId}
          veiculoDestaqueId={veiculoDestaqueId}
          lojaDestaqueId={lojaSelecionada?.id_loja ?? null}
          onLojaClick={selecionarLoja}
          onTecnicoClick={(tecnico) => {
            if (!lojaSelecionada) focarTecnico(tecnico);
          }}
          onVeiculoClick={(veiculo) => {
            if (!lojaSelecionada) focarVeiculo(veiculo);
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
