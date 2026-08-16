import { useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import SensorsIcon from '@mui/icons-material/Sensors';
import CloseIcon from '@mui/icons-material/Close';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import MapaFiltroTrajetoCalendario from './MapaFiltroTrajetoCalendario';
import MapaFiltroTrajetoVeiculo from './MapaFiltroTrajetoVeiculo';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import { rotuloRegiaoMapa } from '../../utils/mapaGeo';
import { dataHojeBrasilia } from '../../utils/dateBr';
import { getUsuario, modoAppTecnicoFrotaRestrito } from '../../lib/auth';
import './mapa-mobile.css';

export default function MapaTecnicosListaLojas() {
  const user = getUsuario();
  const {
    lojasComCoordenadas,
    regioes,
    regiaoFiltro,
    podeFiltrarRegioes,
    podeFiltrarDataTrajeto,
    dataTrajetoInicio,
    dataTrajetoFim,
    selecionandoPeriodoTrajeto,
    ocultarRegioesIndividuaisTrajeto,
    consultaHistorico,
    veiculoTrajetoId,
    veiculos,
    veiculoTrajetoMeta,
    carregandoTrajeto,
    erroConsulta,
    selecionarRegiao,
    selecionarPeriodoTrajeto,
    selecionarVeiculoTrajeto,
    abrirConsultaHistorico,
    fecharConsultaHistorico,
    consultarTrajeto,
    limparFiltrosTrajeto,
  } = useMapaTecnicosMobile();

  const hoje = dataHojeBrasilia();
  const telefonePequeno = useMediaQuery('(max-width:400px)');
  const modoRestrito = modoAppTecnicoFrotaRestrito(user);
  const esconderRegioes = consultaHistorico && ocultarRegioesIndividuaisTrajeto;

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
    consultaHistorico ||
    veiculoTrajetoId != null ||
    selecionandoPeriodoTrajeto ||
    dataTrajetoInicio !== hoje ||
    dataTrajetoFim !== hoje;

  const hint = !podeFiltrarDataTrajeto
    ? podeFiltrarRegioes && regiaoAtiva
      ? `${rotuloRegiaoMapa(regiaoAtiva, {
          compacto: telefonePequeno,
          indiceLista: regioes.findIndex((r) => r.id_regiao === regiaoAtiva.id_regiao),
        })} · ${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'}`
      : podeFiltrarRegioes
        ? `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa`
        : 'Toque no mapa para escolher a unidade'
    : consultaHistorico
      ? 'Escolha o veículo e o período, depois toque em Consultar.'
      : 'Escolha o veículo na lista — o mapa vai até ele.';

  return (
    <div className="ck-mapa__stage">
      <div className="ck-mapa__glow" aria-hidden />

      <div className="ck-mapa__top">
        <div>
          <p className="ck-mapa__mark">Grupo Alvim</p>
          <h1 className={`ck-mapa__title${!modoRestrito ? ' ck-mapa__title--compact' : ''}`}>
            {modoRestrito ? 'Mapa ao vivo' : consultaHistorico ? 'Histórico' : 'Mapa'}
          </h1>
          <p className="ck-mapa__sub">
            {modoRestrito
              ? [nomeRegiaoExibido, `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'}`]
                  .filter(Boolean)
                  .join(' · ') || 'Rastreamento da frota'
              : consultaHistorico
                ? 'Consulte o trajeto de um dia ou período'
                : podeFiltrarRegioes
                  ? 'Escolha o veículo para acompanhar ao vivo'
                  : nomeRegiaoExibido
                    ? `Sua região · ${nomeRegiaoExibido}`
                    : 'Acompanhe a frota na região'}
          </p>
        </div>
        <div className="ck-mapa__menu">
          <CkMarkLogoMenu size={72} className="ck-mapa__logo" />
        </div>
      </div>

      {!modoRestrito && (
        <>
          {podeFiltrarDataTrajeto && (
            <div className="ck-mapa__modos">
              <button
                type="button"
                className={`ck-mapa__chip${consultaHistorico ? '' : ' is-on'}`}
                onClick={fecharConsultaHistorico}
              >
                <SensorsIcon sx={{ fontSize: 16 }} />
                Ao vivo
              </button>
              <button
                type="button"
                className={`ck-mapa__chip${consultaHistorico ? ' is-on' : ''}`}
                onClick={abrirConsultaHistorico}
              >
                <HistoryIcon sx={{ fontSize: 16 }} />
                Histórico
              </button>
            </div>
          )}

          <div className="ck-mapa__chips">
            <div className="ck-mapa__chips-scroll">
              {podeFiltrarRegioes && regioes.length > 0 ? (
                <>
                  <button
                    type="button"
                    className={`ck-mapa__chip${regiaoFiltro === '' ? ' is-on' : ''}`}
                    onClick={() => selecionarRegiao('')}
                  >
                    Todas
                  </button>
                  {!esconderRegioes &&
                    regioes.map((regiao, indice) => {
                      const ativa = Number(regiaoFiltro) === Number(regiao.id_regiao);
                      const rotulo = rotuloRegiaoMapa(regiao, {
                        compacto: telefonePequeno,
                        indiceLista: indice,
                      });
                      return (
                        <button
                          key={regiao.id_regiao}
                          type="button"
                          title={telefonePequeno ? regiao.nome : undefined}
                          className={`ck-mapa__chip${ativa ? ' is-on' : ''}`}
                          onClick={() => selecionarRegiao(regiao.id_regiao)}
                        >
                          <LocationOnOutlinedIcon sx={{ fontSize: 15 }} />
                          {rotulo}
                        </button>
                      );
                    })}
                </>
              ) : (
                nomeRegiaoExibido && (
                  <span className="ck-mapa__chip ck-mapa__chip-static">
                    <LocationOnOutlinedIcon sx={{ fontSize: 15 }} />
                    {nomeRegiaoExibido}
                  </span>
                )
              )}
            </div>
            {filtroTrajetoAtivo && (
              <Tooltip title="Voltar ao mapa ao vivo" arrow>
                <IconButton
                  size="small"
                  onClick={limparFiltrosTrajeto}
                  aria-label="Voltar ao mapa ao vivo"
                  sx={{ width: 32, height: 32, bgcolor: 'rgba(220,38,38,0.25) !important', color: '#fff' }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </div>

          {!consultaHistorico && (
            <div className="ck-mapa__consulta">
              <MapaFiltroTrajetoVeiculo
                veiculoId={veiculoTrajetoId}
                regiaoFiltro={regiaoFiltro}
                onSelect={selecionarVeiculoTrajeto}
                variante="campo"
                veiculosMapa={veiculos}
                veiculoMeta={veiculoTrajetoMeta}
                preferirMapa
              />
            </div>
          )}

          {podeFiltrarDataTrajeto && consultaHistorico && (
            <div className="ck-mapa__consulta">
              <MapaFiltroTrajetoVeiculo
                veiculoId={veiculoTrajetoId}
                regiaoFiltro={regiaoFiltro}
                onSelect={selecionarVeiculoTrajeto}
                variante="campo"
                veiculosMapa={veiculos}
                veiculoMeta={veiculoTrajetoMeta}
              />
              <div className="ck-mapa__consulta-row">
                <MapaFiltroTrajetoCalendario
                  dataInicio={dataTrajetoInicio}
                  dataFim={dataTrajetoFim}
                  onPeriodoChange={selecionarPeriodoTrajeto}
                  variante="campo"
                />
                <button
                  type="button"
                  className="ck-mapa__consulta-btn"
                  onClick={consultarTrajeto}
                  disabled={carregandoTrajeto}
                >
                  {carregandoTrajeto ? (
                    <CircularProgress size={16} sx={{ color: '#fff' }} />
                  ) : (
                    <SearchIcon sx={{ fontSize: 18 }} />
                  )}
                  Consultar
                </button>
              </div>
              {erroConsulta && <p className="ck-mapa__consulta-erro">{erroConsulta}</p>}
            </div>
          )}
          <p className="ck-mapa__hint">{hint}</p>
        </>
      )}

      {modoRestrito && nomeRegiaoExibido && (
        <div className="ck-mapa__chips" style={{ marginTop: 10 }}>
          <span className="ck-mapa__chip ck-mapa__chip-static">
            <LocationOnOutlinedIcon sx={{ fontSize: 15 }} />
            {nomeRegiaoExibido}
          </span>
        </div>
      )}
    </div>
  );
}
