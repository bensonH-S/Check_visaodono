import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import MapaFiltroTrajetoCalendario from './MapaFiltroTrajetoCalendario';
import MapaFiltroTrajetoVeiculo from './MapaFiltroTrajetoVeiculo';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import { rotuloRegiaoMapa } from '../../utils/mapaGeo';
import { getUsuario, logout, modoAppTecnicoFrotaRestrito } from '../../lib/auth';
import './mapa-mobile.css';

export default function MapaTecnicosListaLojas() {
  const navigate = useNavigate();
  const user = getUsuario();
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
  const modoRestrito = modoAppTecnicoFrotaRestrito(user);

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

  const hint = podeFiltrarDataTrajeto
    ? selecionandoPeriodoTrajeto
      ? 'Escolha a data final do período no calendário.'
      : modoHistoricoTrajeto
        ? 'Escolha o veículo para ver o trajeto do período.'
        : 'Toque no veículo no mapa para ver o trajeto de hoje.'
    : podeFiltrarRegioes && regiaoAtiva
      ? `${rotuloRegiaoMapa(regiaoAtiva, {
          compacto: telefonePequeno,
          indiceLista: regioes.findIndex((r) => r.id_regiao === regiaoAtiva.id_regiao),
        })} · ${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'}`
      : podeFiltrarRegioes
        ? `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'} · toque no mapa`
        : 'Toque no mapa para escolher a unidade';

  return (
    <div className="ck-mapa__stage">
      <div className="ck-mapa__glow" aria-hidden />

      <div className="ck-mapa__top">
        <div>
          <p className="ck-mapa__mark">Grupo Alvim</p>
          <h1 className="ck-mapa__title">{modoRestrito ? 'Mapa ao vivo' : 'Mapa'}</h1>
          <p className="ck-mapa__sub">
            {modoRestrito
              ? [nomeRegiaoExibido, `${qtdUnidades} ${qtdUnidades === 1 ? 'unidade' : 'unidades'}`]
                  .filter(Boolean)
                  .join(' · ') || 'Rastreamento da frota'
              : podeFiltrarRegioes
                ? 'Escolha a região e acompanhe a frota'
                : nomeRegiaoExibido
                  ? `Sua região · ${nomeRegiaoExibido}`
                  : 'Acompanhe a frota na região'}
          </p>
        </div>
        <div className="ck-mapa__menu">
          <MobileUsuarioMenu
            user={user}
            onLogout={() => {
              logout();
              navigate('/login/mobile');
            }}
          />
        </div>
      </div>

      {!modoRestrito && (
        <>
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
                  {!ocultarRegioesIndividuaisTrajeto &&
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

            {podeFiltrarDataTrajeto && (
              <Box className="ck-mapa__tools">
                <MapaFiltroTrajetoCalendario
                  dataInicio={dataTrajetoInicio}
                  dataFim={dataTrajetoFim}
                  onPeriodoChange={selecionarPeriodoTrajeto}
                  tomEscuro
                />
                {modoHistoricoTrajeto && periodoTrajetoCompleto && (
                  <MapaFiltroTrajetoVeiculo
                    veiculoId={veiculoTrajetoId}
                    regiaoFiltro={regiaoFiltro}
                    onSelect={selecionarVeiculoTrajeto}
                    tomEscuro
                  />
                )}
                {filtroTrajetoAtivo && (
                  <Tooltip title="Limpar filtro de data e trajeto" arrow>
                    <IconButton
                      size="small"
                      onClick={limparFiltrosTrajeto}
                      aria-label="Limpar filtros de trajeto"
                      sx={{ width: 32, height: 32, bgcolor: 'rgba(220,38,38,0.25) !important' }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </div>
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
