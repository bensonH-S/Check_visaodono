import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import TecnicoProximoPainel from '../../components/mapa/TecnicoProximoPainel';
import TecnicoFocoPainel from '../../components/mapa/TecnicoFocoPainel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  api,
  type FrotaVeiculoHistoricoPonto,
  type FrotaVeiculoPosicao,
  type FrotaVeiculoRotaDiaRelatorio,
} from '../../api/client';
import { useMapaTecnicosMobile } from './MapaTecnicosMobileContext';
import { useAppConfig } from '../../hooks/useAppConfig';

function temDadosRota(relatorio: FrotaVeiculoRotaDiaRelatorio) {
  return (
    (relatorio.rotas?.some((r) => (r.pontos?.length ?? 0) >= 2 || (r.coords_rua?.length ?? 0) >= 2) ?? false) ||
    (relatorio.pontos?.length ?? 0) >= 2
  );
}

export default function MapaTecnicosMobilePage() {
  const appConfig = useAppConfig();
  const {
    posicoes,
    veiculos,
    lojas,
    lojaSelecionada,
    tecnicoFoco,
    proximidade,
    rastreamentoAtivo,
    erro,
    dataTrajetoInicio,
    dataTrajetoFim,
    modoHistoricoTrajeto,
    trajetoReferenteHoje,
    veiculoTrajetoId,
    regiaoFiltro,
    registrarLimparTrajetoAoVivo,
    selecionarLoja,
    limparLoja,
    focarTecnico,
    limparTecnicoFoco,
    lojaTemGpsTecnicosHabilitados,
  } = useMapaTecnicosMobile();

  const [veiculoDestaqueId, setVeiculoDestaqueId] = useState<number | null>(null);
  const [historicoVeiculo, setHistoricoVeiculo] = useState<FrotaVeiculoHistoricoPonto[]>([]);
  const [rotaDiaVeiculo, setRotaDiaVeiculo] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);

  const veiculoTrajetoAtivo = modoHistoricoTrajeto ? veiculoTrajetoId : veiculoDestaqueId;
  const veiculosNoMapa = modoHistoricoTrajeto ? [] : veiculos;
  const trajetoDiaAtual = trajetoReferenteHoje || !modoHistoricoTrajeto;

  const veiculoAoVivoTrajeto = useMemo(() => {
    if (!veiculoTrajetoAtivo || modoHistoricoTrajeto) return null;
    return veiculos.find((v) => v.id_veiculo === veiculoTrajetoAtivo) ?? null;
  }, [veiculoTrajetoAtivo, modoHistoricoTrajeto, veiculos]);

  useEffect(() => {
    if (!modoHistoricoTrajeto) return;
    setVeiculoDestaqueId(null);
    setHistoricoVeiculo([]);
    setRotaDiaVeiculo(null);
  }, [modoHistoricoTrajeto, dataTrajetoInicio, dataTrajetoFim]);

  const carregarTrajetoVeiculo = useCallback(
    async (idVeiculo: number) => {
      setHistoricoVeiculo([]);
      setRotaDiaVeiculo(null);
      try {
        const inicio = modoHistoricoTrajeto ? dataTrajetoInicio : dayjs().format('YYYY-MM-DD');
        const fim = modoHistoricoTrajeto ? dataTrajetoFim || inicio : inicio;

        try {
          const rota = await api.frotaVeiculoRotaDia(idVeiculo, inicio, fim);
          if (temDadosRota(rota)) {
            setRotaDiaVeiculo(rota);
            return;
          }
        } catch {
          // fallback GPS abaixo
        }

        const inicioTs = Math.floor(dayjs(inicio).startOf('day').valueOf() / 1000);
        const fimTs = Math.floor(
          (modoHistoricoTrajeto ? dayjs(fim).endOf('day') : dayjs()).valueOf() / 1000,
        );
        const historico = await api.frotaVeiculoHistoricoRastreamento(idVeiculo, {
          inicio: inicioTs,
          fim: fimTs,
        });
        setHistoricoVeiculo(historico.pontos);
      } catch {
        setHistoricoVeiculo([]);
        setRotaDiaVeiculo(null);
      }
    },
    [modoHistoricoTrajeto, dataTrajetoInicio, dataTrajetoFim],
  );

  const selecionarVeiculoMapa = useCallback((veiculo: FrotaVeiculoPosicao) => {
    setVeiculoDestaqueId(veiculo.id_veiculo);
  }, []);

  const limparTrajetoAoVivo = useCallback(() => {
    setVeiculoDestaqueId(null);
    setHistoricoVeiculo([]);
    setRotaDiaVeiculo(null);
  }, []);

  useEffect(() => {
    registrarLimparTrajetoAoVivo(limparTrajetoAoVivo);
  }, [registrarLimparTrajetoAoVivo, limparTrajetoAoVivo]);

  useEffect(() => {
    if (veiculoTrajetoAtivo == null) {
      setHistoricoVeiculo([]);
      setRotaDiaVeiculo(null);
      return;
    }
    void carregarTrajetoVeiculo(veiculoTrajetoAtivo);
  }, [veiculoTrajetoAtivo, carregarTrajetoVeiculo]);

  const gpsTecnicosAtivo = appConfig?.gpsTecnicosEnabled !== false;
  const mostrarPainelTecnico =
    gpsTecnicosAtivo &&
    lojaSelecionada != null &&
    lojaTemGpsTecnicosHabilitados(lojaSelecionada);

  const tecnicoDestaqueId =
    mostrarPainelTecnico && proximidade?.tecnico
      ? proximidade.tecnico.id_usuario
      : tecnicoFoco?.id_usuario ?? null;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {erro && (
        <Alert severity="error" sx={{ mx: 1.5, my: 1, flexShrink: 0, py: 0.5, fontSize: '0.8rem' }}>
          {erro}
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <FrotaLocalizacaoMap
          posicoes={gpsTecnicosAtivo ? posicoes : []}
          lojas={lojas}
          veiculos={veiculosNoMapa}
          historicoVeiculo={historicoVeiculo}
          rotaDiaVeiculo={rotaDiaVeiculo}
          gpsAtivo={gpsTecnicosAtivo}
          rastreamentoAtivo={rastreamentoAtivo}
          onAtualizar={() => {}}
          preencherAltura
          visivel
          modo="mobile"
          mostrarBotaoAtualizar={false}
          mostrarAlternarTipoMapa={false}
          mostrarPopupVeiculo={!modoHistoricoTrajeto}
          regiaoFiltro={regiaoFiltro}
          trajetoDiaAtual={trajetoDiaAtual}
          veiculoAoVivoTrajeto={veiculoAoVivoTrajeto}
          tecnicoDestaqueId={tecnicoDestaqueId}
          veiculoDestaqueId={veiculoTrajetoAtivo}
          lojaDestaqueId={lojaSelecionada?.id_loja ?? null}
          onLojaClick={selecionarLoja}
          onMapaClick={limparLoja}
          onTecnicoClick={(tecnico) => {
            if (!lojaSelecionada) focarTecnico(tecnico);
          }}
          onVeiculoClick={modoHistoricoTrajeto ? undefined : selecionarVeiculoMapa}
        />

        {(tecnicoFoco || (lojaSelecionada && mostrarPainelTecnico && proximidade?.tecnico)) && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 12,
              zIndex: 1200,
              pointerEvents: 'auto',
              px: 2,
            }}
          >
            {lojaSelecionada && proximidade?.tecnico ? (
              <TecnicoProximoPainel
                loja={lojaSelecionada}
                tecnico={proximidade.tecnico}
                distanciaKm={proximidade.distanciaKm}
                onClose={limparLoja}
              />
            ) : (
              <TecnicoFocoPainel tecnico={tecnicoFoco!} onClose={limparTecnicoFoco} />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
