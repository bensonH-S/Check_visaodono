import { useMemo, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import HistoryIcon from '@mui/icons-material/History';
import SensorsIcon from '@mui/icons-material/Sensors';
import LayersIcon from '@mui/icons-material/Layers';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import MapaFiltroTrajetoCalendario from './MapaFiltroTrajetoCalendario';
import MapaFiltroTrajetoVeiculo, { posicaoParaVeiculoCatalogo } from './MapaFiltroTrajetoVeiculo';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import { getUsuario, logout } from '../../lib/auth';
import { dataHojeBrasilia } from '../../utils/dateBr';
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
  const navigate = useNavigate();
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
    alternarTipoMapa,
  } = useMapaTecnicosMobile();

  const [regioesAbertas, setRegioesAbertas] = useState(false);
  const hoje = dataHojeBrasilia();
  const lista = useMemo(
    () => ordenarVeiculos(veiculos, user?.id_usuario),
    [veiculos, user?.id_usuario],
  );
  const regiaoAtiva = regioes.find((r) => Number(r.id_regiao) === Number(regiaoFiltro));

  return (
    <div className={`ck-mapa__life${consultaHistorico ? ' is-historico' : ''}${tipoMapa === 'satelite' ? ' is-satelite' : ''}`}>
      <div className="ck-mapa__life-top">
        {podeFiltrarDataTrajeto ? (
          <button
            type="button"
            className={`ck-mapa__life-icon${consultaHistorico ? ' is-on' : ''}`}
            onClick={() => (consultaHistorico ? fecharConsultaHistorico() : abrirConsultaHistorico())}
            aria-label={consultaHistorico ? 'Voltar ao vivo' : 'Histórico'}
          >
            {consultaHistorico ? <SensorsIcon sx={{ fontSize: 20 }} /> : <HistoryIcon sx={{ fontSize: 20 }} />}
          </button>
        ) : (
          <span />
        )}
        <div className="ck-mapa__life-top-right">
          {podeFiltrarRegioes && regioes.length > 1 && !consultaHistorico && (
            <button
              type="button"
              className="ck-mapa__life-regiao"
              onClick={() => setRegioesAbertas(true)}
            >
              {regiaoFiltro === '' ? 'Todas' : regiaoAtiva?.nome.replace(/^Região\s+/i, '') || 'Região'}
            </button>
          )}
          <button
            type="button"
            className={`ck-mapa__life-icon${tipoMapa === 'satelite' ? ' is-on' : ''}`}
            onClick={alternarTipoMapa}
            aria-label={tipoMapa === 'satelite' ? 'Mapa de ruas' : 'Satélite'}
          >
            <LayersIcon sx={{ fontSize: 20 }} />
          </button>
          <MobileUsuarioMenu
            user={user}
            onLogout={() => {
              logout();
              navigate('/login/mobile');
            }}
          />
        </div>
      </div>

      {consultaHistorico && (
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
            veiculosMapa={veiculos}
            veiculoMeta={veiculoTrajetoMeta}
          />
          <MapaFiltroTrajetoCalendario
            dataInicio={dataTrajetoInicio}
            dataFim={dataTrajetoFim}
            onPeriodoChange={selecionarPeriodoTrajeto}
            variante="campo"
          />
          <div className="ck-mapa__consulta-row">
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
      )}

      {!consultaHistorico && (
        <div className="ck-mapa__life-members" role="list">
          {lista.map((v) => {
            const meu = Number(v.id_usuario_responsavel) === Number(user?.id_usuario);
            const ocupante = nomeOcupanteVeiculo(v);
            const nome = ocupante ? primeiroNomeOcupante(ocupante) : rotuloMarcadorVeiculo(v);
            const status = statusVeiculoMapa(v);
            const ativo = veiculoTrajetoId === v.id_veiculo;
            return (
              <button
                key={v.id_veiculo}
                type="button"
                role="listitem"
                className={`ck-mapa__life-person${ativo ? ' is-on' : ''}`}
                onClick={() => selecionarVeiculoTrajeto(posicaoParaVeiculoCatalogo(v))}
              >
                <span className={`ck-mapa__life-avatar is-${status}`} aria-hidden>
                  {iniciais(ocupante || v.placa || nome)}
                </span>
                <span className="ck-mapa__life-name">{meu ? 'Você' : nome}</span>
                <span className="ck-mapa__life-meta">{rotuloStatusVeiculoMapa(status)}</span>
              </button>
            );
          })}
          {!lista.length && (
            <p className="ck-mapa__life-empty">Nenhum carro da sua região no mapa agora.</p>
          )}
        </div>
      )}

      <Drawer
        anchor="bottom"
        open={regioesAbertas}
        onClose={() => setRegioesAbertas(false)}
        slotProps={{ paper: { className: 'ck-mapa__life-drawer' } }}
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
      </Drawer>
    </div>
  );
}
