import { useMemo, useRef, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import HistoryIcon from '@mui/icons-material/History';
import SensorsIcon from '@mui/icons-material/Sensors';
import LayersIcon from '@mui/icons-material/Layers';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import MapaFiltroTrajetoCalendario from './MapaFiltroTrajetoCalendario';
import MapaFiltroTrajetoVeiculo, { posicaoParaVeiculoCatalogo } from './MapaFiltroTrajetoVeiculo';
import AppHubDock from '../hub/AppHubDock';
import { getUsuario } from '../../lib/auth';
import { assetUrl, LOGO_GA_LOCKUP } from '../../config/paths';
import { dataHojeBrasilia } from '../../utils/dateBr';
import '../../components/estoque/estoque-hub.css';
import {
  nomeOcupanteVeiculo,
  primeiroNomeOcupante,
  rotuloMarcadorVeiculo,
  rotuloStatusVeiculoMapa,
  statusVeiculoMapa,
} from '../frota/frotaMapaVeiculo';
import type { FrotaVeiculoPosicao } from '../../api/client';
import './mapa-mobile.css';

function iniciais(texto: string) {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '•';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

function ordenarVeiculos(veiculos: FrotaVeiculoPosicao[], userId?: number) {
  return [...veiculos].sort((a, b) => {
    const aMeu = Number(a.id_usuario_responsavel) === Number(userId) ? 0 : 1;
    const bMeu = Number(b.id_usuario_responsavel) === Number(userId) ? 0 : 1;
    if (aMeu !== bMeu) return aMeu - bMeu;
    return rotuloMarcadorVeiculo(a).localeCompare(rotuloMarcadorVeiculo(b), 'pt-BR');
  });
}

export default function MapaTecnicosListaLojas() {
  const user = getUsuario();
  const {
    regioes,
    regiaoFiltro,
    podeFiltrarRegioes,
    podeFiltrarDataTrajeto,
    dataTrajetoInicio,
    dataTrajetoFim,
    horaTrajetoInicio,
    horaTrajetoFim,
    consultaHistorico,
    veiculoTrajetoId,
    veiculos,
    veiculoTrajetoMeta,
    carregandoTrajeto,
    erroConsulta,
    selecionarRegiao,
    selecionarPeriodoTrajeto,
    selecionarHorarioTrajeto,
    selecionarVeiculoTrajeto,
    abrirConsultaHistorico,
    fecharConsultaHistorico,
    consultarTrajeto,
    tipoMapa,
    selecionarTipoMapa,
  } = useMapaTecnicosMobile();

  const regiaoBtnRef = useRef<HTMLButtonElement>(null);
  const camadasBtnRef = useRef<HTMLButtonElement>(null);
  const [regioesAbertas, setRegioesAbertas] = useState(false);
  const [camadasAbertas, setCamadasAbertas] = useState(false);
  const hoje = dataHojeBrasilia();
  const lista = useMemo(
    () => ordenarVeiculos(veiculos, user?.id_usuario),
    [veiculos, user?.id_usuario],
  );
  const regiaoAtiva = regioes.find((r) => Number(r.id_regiao) === Number(regiaoFiltro));

  return (
    <div className={`ck-mapa__life${consultaHistorico ? ' is-historico' : ''}${tipoMapa === 'satelite' ? ' is-satelite' : ''}${tipoMapa === 'escuro' ? ' is-escuro' : ''}`}>
      <div className="ck-mapa__life-top">
        <div className="ck-mapa__life-brand">
          <img src={assetUrl(LOGO_GA_LOCKUP)} alt="Grupo Alvim" />
        </div>
        <div className="ck-mapa__life-top-right">
          {podeFiltrarDataTrajeto ? (
            <button
              type="button"
              className={`ck-mapa__life-icon${consultaHistorico ? ' is-on' : ''}`}
              onClick={() => (consultaHistorico ? fecharConsultaHistorico() : abrirConsultaHistorico())}
              aria-label={consultaHistorico ? 'Voltar ao vivo' : 'Histórico'}
            >
              {consultaHistorico ? <SensorsIcon sx={{ fontSize: 20 }} /> : <HistoryIcon sx={{ fontSize: 20 }} />}
            </button>
          ) : null}
          {podeFiltrarRegioes && regioes.length > 1 && !consultaHistorico && (
            <button
              type="button"
              ref={regiaoBtnRef}
              className="ck-mapa__life-regiao"
              aria-haspopup="listbox"
              aria-expanded={regioesAbertas}
              onClick={() => setRegioesAbertas((v) => !v)}
            >
              <span>
                {regiaoFiltro === '' ? 'Todas' : regiaoAtiva?.nome.replace(/^Região\s+/i, '') || 'Região'}
              </span>
              <KeyboardArrowUpIcon sx={{ fontSize: 18, ml: 0.25, opacity: 0.75, flexShrink: 0 }} />
            </button>
          )}
          <button
            type="button"
            ref={camadasBtnRef}
            className={`ck-mapa__life-icon${tipoMapa !== 'rua' ? ' is-on' : ''}`}
            onClick={() => setCamadasAbertas((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={camadasAbertas}
            aria-label="Tipo do mapa"
            title="Tipo do mapa"
          >
            <LayersIcon sx={{ fontSize: 20 }} />
          </button>
        </div>
      </div>

      {consultaHistorico && (
        <>
          <div className="ck-mapa__life-hist">
            <div className="ck-mapa__life-hist-head">
              <strong>Histórico</strong>
              <button type="button" className="ck-mapa__life-icon" onClick={fecharConsultaHistorico} aria-label="Fechar">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <MapaFiltroTrajetoVeiculo
              veiculoId={veiculoTrajetoId}
              regiaoFiltro={regiaoFiltro}
              onSelect={selecionarVeiculoTrajeto}
              variante="campo"
              tomEscuro
              veiculosMapa={veiculos}
              veiculoMeta={veiculoTrajetoMeta}
            />
            <div className="ck-mapa__consulta-row ck-mapa__consulta-row--periodo">
              <MapaFiltroTrajetoCalendario
                dataInicio={dataTrajetoInicio}
                dataFim={dataTrajetoFim}
                onPeriodoChange={selecionarPeriodoTrajeto}
                variante="campo"
                tomEscuro
              />
              <label className="ck-mapa__consulta-field ck-mapa__consulta-time">
                <span className="ck-mapa__consulta-label">De</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="08:00"
                  maxLength={5}
                  value={horaTrajetoInicio}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                    selecionarHorarioTrajeto(
                      raw.length <= 2 ? raw : `${raw.slice(0, 2)}:${raw.slice(2)}`,
                      horaTrajetoFim,
                    );
                  }}
                  aria-label="Horário inicial"
                />
              </label>
              <label className="ck-mapa__consulta-field ck-mapa__consulta-time">
                <span className="ck-mapa__consulta-label">Até</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="18:00"
                  maxLength={5}
                  value={horaTrajetoFim}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                    selecionarHorarioTrajeto(
                      horaTrajetoInicio,
                      raw.length <= 2 ? raw : `${raw.slice(0, 2)}:${raw.slice(2)}`,
                    );
                  }}
                  aria-label="Horário final"
                />
              </label>
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
                Ver
              </button>
            </div>
            {erroConsulta && <p className="ck-mapa__consulta-erro">{erroConsulta}</p>}
            {(dataTrajetoInicio !== hoje || dataTrajetoFim !== hoje) && (
              <button
                type="button"
                className="ck-mapa__life-hoje"
                onClick={() => selecionarPeriodoTrajeto(hoje, hoje)}
              >
                Hoje
              </button>
            )}
          </div>
          <div className="ck-mapa__life-hist-results" data-mapa-hist-results />
        </>
      )}

      {!consultaHistorico && (
        <div className="ck-mapa__life-members" role="list">
          {lista
            .filter((v) => Boolean(nomeOcupanteVeiculo(v)))
            .map((v) => {
              const meu = Number(v.id_usuario_responsavel) === Number(user?.id_usuario);
              const ocupante = nomeOcupanteVeiculo(v)!;
              const nome = primeiroNomeOcupante(ocupante);
              const status = statusVeiculoMapa(v);
              const ativo = veiculoTrajetoId === v.id_veiculo;
              return (
                <button
                  key={v.id_veiculo}
                  type="button"
                  role="listitem"
                  className={`ck-mapa__life-person${ativo ? ' is-on' : ''}`}
                  aria-label={`${meu ? 'Você' : nome} · ${rotuloStatusVeiculoMapa(status)}`}
                  onClick={() => selecionarVeiculoTrajeto(posicaoParaVeiculoCatalogo(v))}
                >
                  <span className={`ck-mapa__life-avatar is-${status}`} aria-hidden>
                    {iniciais(ocupante)}
                  </span>
                  <span className="ck-mapa__life-name">{meu ? 'Você' : nome}</span>
                </button>
              );
            })}
          {!lista.some((v) => Boolean(nomeOcupanteVeiculo(v))) && (
            <p className="ck-mapa__life-empty">Nenhum carro associado no mapa agora.</p>
          )}
        </div>
      )}

      <Popover
        open={regioesAbertas}
        anchorEl={regiaoBtnRef.current}
        onClose={() => setRegioesAbertas(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          root: { sx: { zIndex: 2000 } },
          paper: {
            className: 'ck-mapa__life-regiao-menu',
            sx: { mt: -0.75, minWidth: 200, maxWidth: 280, borderRadius: 2, py: 0.5, zIndex: 2001 },
          },
        }}
      >
        <p className="ck-mapa__life-drawer-title">Região</p>
        <button
          type="button"
          className={`ck-mapa__life-drawer-item${regiaoFiltro === '' ? ' is-on' : ''}`}
          onClick={() => {
            selecionarRegiao('');
            setRegioesAbertas(false);
          }}
        >
          Todas
        </button>
        {regioes.map((r) => (
          <button
            key={r.id_regiao}
            type="button"
            className={`ck-mapa__life-drawer-item${Number(regiaoFiltro) === Number(r.id_regiao) ? ' is-on' : ''}`}
            onClick={() => {
              selecionarRegiao(r.id_regiao);
              setRegioesAbertas(false);
            }}
          >
            {r.nome}
          </button>
        ))}
      </Popover>

      <Popover
        open={camadasAbertas}
        anchorEl={camadasBtnRef.current}
        onClose={() => setCamadasAbertas(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          root: { sx: { zIndex: 2000 } },
          paper: {
            className: 'ck-mapa__life-regiao-menu',
            sx: { mt: 0.75, minWidth: 180, borderRadius: 2, py: 0.5, zIndex: 2001 },
          },
        }}
      >
        <p className="ck-mapa__life-drawer-title">Mapa</p>
        <button
          type="button"
          className={`ck-mapa__life-drawer-item ck-mapa__life-drawer-item--row${tipoMapa === 'rua' ? ' is-on' : ''}`}
          onClick={() => {
            selecionarTipoMapa('rua');
            setCamadasAbertas(false);
          }}
        >
          <MapOutlinedIcon sx={{ fontSize: 18 }} />
          Ruas
        </button>
        <button
          type="button"
          className={`ck-mapa__life-drawer-item ck-mapa__life-drawer-item--row${tipoMapa === 'satelite' ? ' is-on' : ''}`}
          onClick={() => {
            selecionarTipoMapa('satelite');
            setCamadasAbertas(false);
          }}
        >
          <SatelliteAltOutlinedIcon sx={{ fontSize: 18 }} />
          Satélite
        </button>
        <button
          type="button"
          className={`ck-mapa__life-drawer-item ck-mapa__life-drawer-item--row${tipoMapa === 'escuro' ? ' is-on' : ''}`}
          onClick={() => {
            selecionarTipoMapa('escuro');
            setCamadasAbertas(false);
          }}
        >
          <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
          Escuro
        </button>
      </Popover>

      <AppHubDock
        ativo={null}
        plusLabel="Sem ação nesta tela"
        plusDisabled
        onPlus={() => {}}
      />
    </div>
  );
}
