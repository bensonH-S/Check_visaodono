import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import TecnicoProximoPainel from '../../components/mapa/TecnicoProximoPainel';
import TecnicoFocoPainel from '../../components/mapa/TecnicoFocoPainel';
import MapaVeiculoConsultasPainel from '../../components/mapa/MapaVeiculoConsultasPainel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  api,
  type FrotaRegistroVelocidade,
  type FrotaVeiculoHistoricoPonto,
  type FrotaVeiculoPosicao,
  type FrotaVeiculoRotaDiaRelatorio,
  type FrotaVeiculoVelocidadeRelatorio,
} from '../../api/client';
import { useMapaTecnicosMobile } from './MapaTecnicosMobileContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import { dataHojeBrasilia, formatarDuracaoMs, formatDataCampoData } from '../../utils/dateBr';
import { calcularTempoParadoMs } from '../../utils/frotaTempoParado';
import { contarPassagensPorLoja } from '../../utils/frotaPassagensLoja';
import { posicaoParaVeiculoCatalogo } from '../../components/mapa/MapaFiltroTrajetoVeiculo';
import {
  COR_EXCESSO_FROTA,
  COR_STATUS_DISPONIVEL,
  COR_STATUS_EM_ROTA,
  COR_STATUS_PARADO,
  COR_TRAJETO,
} from '../../components/frota/frotaMapaBasemap';
import { iconeMarcaLojaUrl } from '../../utils/marcaLojaMapa';

function temDadosRota(relatorio: FrotaVeiculoRotaDiaRelatorio) {
  return (
    (relatorio.rotas?.some((r) => (r.pontos?.length ?? 0) >= 2 || (r.coords_rua?.length ?? 0) >= 2) ?? false) ||
    (relatorio.pontos?.length ?? 0) >= 2
  );
}

function listarExcessosVelocidade(
  relatorio: FrotaVeiculoVelocidadeRelatorio | null,
  rota: FrotaVeiculoRotaDiaRelatorio | null,
): FrotaRegistroVelocidade[] {
  const limite = relatorio?.limite_kmh ?? rota?.limite_kmh ?? 80;
  if (relatorio) {
    const daApi = relatorio.excessos ?? [];
    const lista = daApi.length
      ? daApi.map((e) => ({
          ...e,
          limite: e.limite ?? limite,
          status: 'excesso' as const,
        }))
      : (relatorio.registros ?? [])
          .filter((r) => r.status === 'excesso' || Number(r.velocidade) > limite)
          .map((r) => ({
            ...r,
            limite: r.limite ?? limite,
            status: 'excesso' as const,
          }));
    return [...lista].sort((a, b) => Number(b.velocidade) - Number(a.velocidade));
  }
  return (rota?.pontos ?? [])
    .filter((p) => Number(p.velocidade) > limite)
    .map((p) => ({
      velocidade: Number(p.velocidade) || 0,
      limite,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      atualizado_em: p.atualizado_em,
      status: 'excesso' as const,
    }))
    .sort((a, b) => b.velocidade - a.velocidade);
}

export default function MapaTecnicosMobilePage() {
  const appConfig = useAppConfig();
  const {
    posicoes,
    veiculos,
    lojas,
    lojasComCoordenadas,
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
    veiculoTrajetoMeta,
    podeFiltrarDataTrajeto,
    consultaHistorico,
    carregandoTrajeto,
    regiaoFiltro,
    registrarLimparTrajetoAoVivo,
    registrarConsultarTrajeto,
    selecionarVeiculoTrajeto,
    setCarregandoTrajeto,
    setErroConsulta,
    abrirConsultaHistorico,
    selecionarLoja,
    limparLoja,
    focarTecnico,
    limparTecnicoFoco,
    lojaTemGpsTecnicosHabilitados,
  } = useMapaTecnicosMobile();

  const [historicoVeiculo, setHistoricoVeiculo] = useState<FrotaVeiculoHistoricoPonto[]>([]);
  const [rotaDiaVeiculo, setRotaDiaVeiculo] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [velocidade, setVelocidade] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [consultaTick, setConsultaTick] = useState(0);

  const veiculoTrajetoAtivo = veiculoTrajetoId;
  const veiculosNoMapa = modoHistoricoTrajeto ? [] : veiculos;
  const trajetoDiaAtual = trajetoReferenteHoje || !modoHistoricoTrajeto;

  const veiculoAoVivoTrajeto = useMemo(() => {
    if (!veiculoTrajetoAtivo || modoHistoricoTrajeto) return null;
    return veiculos.find((v) => v.id_veiculo === veiculoTrajetoAtivo) ?? null;
  }, [veiculoTrajetoAtivo, modoHistoricoTrajeto, veiculos]);

  const carregarTrajetoVeiculo = useCallback(
    async (idVeiculo: number) => {
      setHistoricoVeiculo([]);
      setRotaDiaVeiculo(null);
      setVelocidade(null);
      setCarregandoTrajeto(true);
      setErroConsulta('');
      try {
        const inicio = modoHistoricoTrajeto ? dataTrajetoInicio : dataHojeBrasilia();
        const fim = modoHistoricoTrajeto ? dataTrajetoFim || inicio : inicio;

        const [rotaResult, velResult] = await Promise.allSettled([
          api.frotaVeiculoRotaDia(idVeiculo, inicio, fim),
          api.frotaVeiculoVelocidade(idVeiculo, inicio, fim),
        ]);

        const rota = rotaResult.status === 'fulfilled' ? rotaResult.value : null;
        const vel = velResult.status === 'fulfilled' ? velResult.value : null;
        if (vel) setVelocidade(vel);

        if (rota && temDadosRota(rota)) {
          setRotaDiaVeiculo(rota);
          return;
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
        if (!rota && !historico.pontos.length) {
          setErroConsulta('Sem trajeto neste período para o veículo.');
        }
      } catch {
        setHistoricoVeiculo([]);
        setRotaDiaVeiculo(null);
        setVelocidade(null);
        setErroConsulta('Não foi possível carregar o trajeto.');
      } finally {
        setCarregandoTrajeto(false);
      }
    },
    [modoHistoricoTrajeto, dataTrajetoInicio, dataTrajetoFim, setCarregandoTrajeto, setErroConsulta],
  );

  const selecionarVeiculoMapa = useCallback(
    (veiculo: FrotaVeiculoPosicao) => {
      selecionarVeiculoTrajeto(posicaoParaVeiculoCatalogo(veiculo));
    },
    [selecionarVeiculoTrajeto],
  );

  const limparTrajetoAoVivo = useCallback(() => {
    setHistoricoVeiculo([]);
    setRotaDiaVeiculo(null);
    setVelocidade(null);
  }, []);

  useEffect(() => {
    registrarLimparTrajetoAoVivo(limparTrajetoAoVivo);
  }, [registrarLimparTrajetoAoVivo, limparTrajetoAoVivo]);

  useEffect(() => {
    if (!consultaHistorico) return;
    setHistoricoVeiculo([]);
    setRotaDiaVeiculo(null);
    setVelocidade(null);
  }, [consultaHistorico]);

  useEffect(() => {
    registrarConsultarTrajeto(() => {
      if (veiculoTrajetoAtivo == null) return;
      setConsultaTick((n) => n + 1);
    });
  }, [registrarConsultarTrajeto, veiculoTrajetoAtivo]);

  useEffect(() => {
    if (veiculoTrajetoAtivo == null) {
      setHistoricoVeiculo([]);
      setRotaDiaVeiculo(null);
      setVelocidade(null);
      return;
    }
    if (consultaHistorico) return;
    void carregarTrajetoVeiculo(veiculoTrajetoAtivo);
  }, [veiculoTrajetoAtivo, consultaHistorico, carregarTrajetoVeiculo]);

  useEffect(() => {
    if (!consultaHistorico || consultaTick === 0 || veiculoTrajetoAtivo == null) return;
    void carregarTrajetoVeiculo(veiculoTrajetoAtivo);
  }, [consultaTick, consultaHistorico, veiculoTrajetoAtivo, carregarTrajetoVeiculo]);

  const gpsTecnicosAtivo = appConfig?.gpsTecnicosEnabled !== false;
  const mostrarPainelTecnico =
    gpsTecnicosAtivo &&
    lojaSelecionada != null &&
    lojaTemGpsTecnicosHabilitados(lojaSelecionada);

  const tecnicoDestaqueId =
    mostrarPainelTecnico && proximidade?.tecnico
      ? proximidade.tecnico.id_usuario
      : tecnicoFoco?.id_usuario ?? null;

  const consultou = rotaDiaVeiculo != null || velocidade != null || historicoVeiculo.length > 0;
  const excessos = useMemo(
    () => listarExcessosVelocidade(velocidade, rotaDiaVeiculo),
    [velocidade, rotaDiaVeiculo],
  );
  const limiteKmh = rotaDiaVeiculo?.limite_kmh ?? velocidade?.limite_kmh ?? 80;
  const kmGps = rotaDiaVeiculo?.km_gps ?? 0;
  const velocidadeMaxima = useMemo(() => {
    if (velocidade?.velocidade_maxima != null) return velocidade.velocidade_maxima;
    const dosPontos = (rotaDiaVeiculo?.pontos ?? historicoVeiculo).map((p) => Number(p.velocidade) || 0);
    return dosPontos.length ? Math.max(0, ...dosPontos) : 0;
  }, [velocidade, rotaDiaVeiculo, historicoVeiculo]);
  const qtdExcessos = rotaDiaVeiculo?.qtd_excessos ?? excessos.length;
  const tempoParadoMs = useMemo(() => {
    if (rotaDiaVeiculo?.tempo_parado_ms != null) return rotaDiaVeiculo.tempo_parado_ms;
    if (velocidade?.tempo_parado_ms != null) return velocidade.tempo_parado_ms;
    return calcularTempoParadoMs(rotaDiaVeiculo?.pontos ?? historicoVeiculo);
  }, [rotaDiaVeiculo, velocidade, historicoVeiculo]);
  const passagensLoja = useMemo(() => {
    const pontos = rotaDiaVeiculo?.pontos ?? historicoVeiculo;
    if (!pontos.length || !lojasComCoordenadas.length) return [];
    return contarPassagensPorLoja(pontos, lojasComCoordenadas);
  }, [rotaDiaVeiculo?.pontos, historicoVeiculo, lojasComCoordenadas]);

  const tituloVeiculo = useMemo(() => {
    const placa = veiculoTrajetoMeta?.placa ?? rotaDiaVeiculo?.veiculo.placa ?? '';
    const modelo = [veiculoTrajetoMeta?.marca ?? rotaDiaVeiculo?.veiculo.marca, veiculoTrajetoMeta?.modelo ?? rotaDiaVeiculo?.veiculo.modelo]
      .filter(Boolean)
      .join(' ');
    return modelo ? `${placa} · ${modelo}` : placa || 'Trajeto';
  }, [veiculoTrajetoMeta, rotaDiaVeiculo]);

  const periodoLabel = useMemo(() => {
    const ini = formatDataCampoData(dataTrajetoInicio);
    if (!consultaHistorico) return `Hoje · ${ini}`;
    return ini;
  }, [consultaHistorico, dataTrajetoInicio]);

  const mostrarFicha =
    veiculoTrajetoAtivo != null &&
    !tecnicoFoco &&
    !(lojaSelecionada && mostrarPainelTecnico) &&
    (!consultaHistorico || consultou || carregandoTrajeto);

  const kpis = [
    {
      label: 'KM',
      valor: consultou ? `${kmGps.toLocaleString('pt-BR')} km` : '—',
    },
    {
      label: 'Excessos',
      valor: consultou ? String(qtdExcessos) : '—',
      alerta: consultou && qtdExcessos > 0,
    },
    {
      label: 'Máx.',
      valor: consultou ? `${velocidadeMaxima.toLocaleString('pt-BR')} km/h` : '—',
      alerta: consultou && velocidadeMaxima > limiteKmh,
    },
    {
      label: 'Parado',
      valor: consultou ? formatarDuracaoMs(tempoParadoMs) : '—',
    },
  ];

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

      {carregandoTrajeto && <LinearProgress sx={{ flexShrink: 0 }} />}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <FrotaLocalizacaoMap
          posicoes={consultaHistorico ? [] : gpsTecnicosAtivo ? posicoes : []}
          lojas={consultaHistorico ? [] : lojas}
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
          mostrarPopupVeiculo={false}
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

        {podeFiltrarDataTrajeto && !consultaHistorico && (
          <div className="ck-mapa__legenda">
            {(
              [
                { cor: COR_STATUS_EM_ROTA, rotulo: 'Em rota' },
                { cor: COR_STATUS_DISPONIVEL, rotulo: 'Disponível' },
                { cor: COR_STATUS_PARADO, rotulo: 'Parado' },
                { cor: COR_TRAJETO, rotulo: 'Trajeto', linha: true },
              ] as { cor: string; rotulo: string; linha?: boolean }[]
            ).map((item) => (
              <div key={item.rotulo} className="ck-mapa__legenda-item">
                {item.linha ? (
                  <span className="ck-mapa__legenda-line" style={{ background: item.cor }} />
                ) : (
                  <span className="ck-mapa__legenda-dot" style={{ background: item.cor }} />
                )}
                {item.rotulo}
              </div>
            ))}
            {lojasComCoordenadas.length > 0 && (
              <div className="ck-mapa__legenda-item">
                <img className="ck-mapa__legenda-loja" src={iconeMarcaLojaUrl('burger-king')} alt="" />
                Loja
              </div>
            )}
          </div>
        )}
        {consultaHistorico && consultou && (
          <div className="ck-mapa__legenda ck-mapa__legenda--mini">
            <div className="ck-mapa__legenda-item">
              <span className="ck-mapa__legenda-line" style={{ background: COR_TRAJETO }} />
              Trajeto
            </div>
            {qtdExcessos > 0 && (
              <div className="ck-mapa__legenda-item">
                <span className="ck-mapa__legenda-line" style={{ background: COR_EXCESSO_FROTA }} />
                Excesso
              </div>
            )}
          </div>
        )}

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

        {mostrarFicha && veiculoTrajetoAtivo != null && (
          <MapaVeiculoConsultasPainel
            titulo={tituloVeiculo}
            subtitulo={
              carregandoTrajeto
                ? 'Carregando trajeto…'
                : consultou
                  ? `Limite ${limiteKmh} km/h`
                  : 'Escolha o que consultar neste veículo'
            }
            veiculoAoVivo={veiculoAoVivoTrajeto}
            idVeiculo={veiculoTrajetoAtivo}
            excessos={excessos}
            passagensLoja={passagensLoja}
            limiteKmh={limiteKmh}
            consultouTrajeto={consultou}
            periodoLabel={periodoLabel}
            kpis={kpis}
            onAbrirHistorico={podeFiltrarDataTrajeto && !consultaHistorico ? abrirConsultaHistorico : undefined}
            onClose={() => selecionarVeiculoTrajeto(null)}
          />
        )}
      </Box>
    </Box>
  );
}
