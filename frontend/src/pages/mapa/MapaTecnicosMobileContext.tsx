import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import { api, type FrotaRegiaoLoja, type FrotaTecnicoPosicao, type FrotaVeiculo, type FrotaVeiculoPosicao } from '../../api/client';
import {
  getUsuario,
  podeFiltrarDataTrajetoMapaMobile,
  podeFiltrarRegioesMapaMobile,
  podeVerMapaTecnicosMobile,
} from '../../lib/auth';
import { lojaTemGpsTecnicosHabilitados, tecnicoGpsHabilitado, tecnicoMaisProximoLoja } from '../../utils/mapaGeo';
import {
  modoHistoricoTrajeto,
  ocultarRegioesIndividuaisTrajeto,
  periodoTrajetoCompleto,
  selecionandoPeriodoTrajeto,
  trajetoReferenteHoje,
} from '../../utils/mapaTrajetoPeriodo';

type RegiaoMapa = { id_regiao: number; nome: string };

type MapaTecnicosMobileContextValue = {
  posicoes: FrotaTecnicoPosicao[];
  veiculos: FrotaVeiculoPosicao[];
  lojas: FrotaRegiaoLoja[];
  lojasComCoordenadas: FrotaRegiaoLoja[];
  regioes: RegiaoMapa[];
  regiaoFiltro: number | '';
  podeFiltrarRegioes: boolean;
  podeFiltrarDataTrajeto: boolean;
  dataTrajetoInicio: string;
  dataTrajetoFim: string;
  periodoTrajetoCompleto: boolean;
  selecionandoPeriodoTrajeto: boolean;
  ocultarRegioesIndividuaisTrajeto: boolean;
  trajetoReferenteHoje: boolean;
  modoHistoricoTrajeto: boolean;
  veiculoTrajetoId: number | null;
  veiculoTrajetoMeta: FrotaVeiculo | null;
  rastreamentoAtivo: boolean;
  lojaSelecionada: FrotaRegiaoLoja | null;
  tecnicoFoco: FrotaTecnicoPosicao | null;
  veiculoFoco: FrotaVeiculoPosicao | null;
  proximidade: ReturnType<typeof tecnicoMaisProximoLoja>;
  lojaTemGpsTecnicosHabilitados: (loja: FrotaRegiaoLoja) => boolean;
  erro: string;
  selecionarRegiao: (idRegiao: number | '') => void;
  selecionarPeriodoTrajeto: (inicio: string, fim: string) => void;
  selecionarVeiculoTrajeto: (veiculo: FrotaVeiculo | null) => void;
  limparFiltrosTrajeto: () => void;
  registrarLimparTrajetoAoVivo: (fn: () => void) => void;
  selecionarLoja: (loja: FrotaRegiaoLoja) => void;
  limparLoja: () => void;
  focarTecnico: (tecnico: FrotaTecnicoPosicao) => void;
  limparTecnicoFoco: () => void;
  focarVeiculo: (veiculo: FrotaVeiculoPosicao) => void;
  limparVeiculoFoco: () => void;
};

const MapaTecnicosMobileContext = createContext<MapaTecnicosMobileContextValue | null>(null);

function deduplicarLojas(lojas: FrotaRegiaoLoja[]): FrotaRegiaoLoja[] {
  const vistos = new Set<number>();
  return lojas.filter((l) => {
    if (vistos.has(l.id_loja)) return false;
    vistos.add(l.id_loja);
    return true;
  });
}

function filtrarLojasPorRegiao(lojas: FrotaRegiaoLoja[], regiaoFiltro: number | ''): FrotaRegiaoLoja[] {
  if (regiaoFiltro === '') return deduplicarLojas(lojas);
  const id = Number(regiaoFiltro);
  return lojas.filter((l) => l.id_regiao != null && Number(l.id_regiao) === id);
}

function filtrarPosicoesPorRegiao(posicoes: FrotaTecnicoPosicao[], regiaoFiltro: number | ''): FrotaTecnicoPosicao[] {
  if (regiaoFiltro === '') return posicoes;
  const id = Number(regiaoFiltro);
  return posicoes.filter((p) => p.id_regiao != null && Number(p.id_regiao) === id);
}

function filtrarVeiculosPorRegiao(veiculos: FrotaVeiculoPosicao[], regiaoFiltro: number | ''): FrotaVeiculoPosicao[] {
  if (regiaoFiltro === '') return veiculos;
  const id = Number(regiaoFiltro);
  return veiculos.filter((v) => v.id_regiao != null && Number(v.id_regiao) === id);
}

export function MapaTecnicosMobileProvider({ children }: { children: ReactNode }) {
  const user = getUsuario();
  const userId = user?.id_usuario;
  const podeFiltrarRegioes = podeFiltrarRegioesMapaMobile(user);
  const podeFiltrarDataTrajeto = podeFiltrarDataTrajetoMapaMobile(user);
  const hoje = dayjs().format('YYYY-MM-DD');
  const [posicoes, setPosicoes] = useState<FrotaTecnicoPosicao[]>([]);
  const [veiculos, setVeiculos] = useState<FrotaVeiculoPosicao[]>([]);
  const [rastreamentoAtivo, setRastreamentoAtivo] = useState(true);
  const [lojas, setLojas] = useState<FrotaRegiaoLoja[]>([]);
  const [regioes, setRegioes] = useState<RegiaoMapa[]>([]);
  const [erro, setErro] = useState('');
  const [regiaoFiltro, setRegiaoFiltro] = useState<number | ''>('');
  const [dataTrajetoInicio, setDataTrajetoInicio] = useState(hoje);
  const [dataTrajetoFim, setDataTrajetoFim] = useState(hoje);
  const [veiculoTrajetoId, setVeiculoTrajetoId] = useState<number | null>(null);
  const [veiculoTrajetoMeta, setVeiculoTrajetoMeta] = useState<FrotaVeiculo | null>(null);
  const [lojaSelecionada, setLojaSelecionada] = useState<FrotaRegiaoLoja | null>(null);
  const [tecnicoFoco, setTecnicoFoco] = useState<FrotaTecnicoPosicao | null>(null);
  const [veiculoFoco, setVeiculoFoco] = useState<FrotaVeiculoPosicao | null>(null);
  const carregouInicial = useRef(false);
  const regiaoInicializada = useRef(false);
  const limparTrajetoAoVivoRef = useRef<() => void>(() => {});

  const lojasVisiveis = useMemo(
    () => filtrarLojasPorRegiao(lojas, regiaoFiltro),
    [lojas, regiaoFiltro],
  );

  const posicoesVisiveis = useMemo(
    () => filtrarPosicoesPorRegiao(posicoes, regiaoFiltro),
    [posicoes, regiaoFiltro],
  );

  const veiculosVisiveis = useMemo(
    () => filtrarVeiculosPorRegiao(veiculos, regiaoFiltro),
    [veiculos, regiaoFiltro],
  );

  const lojasComCoordenadas = useMemo(
    () =>
      lojasVisiveis.filter(
        (l) =>
          l.latitude != null &&
          l.longitude != null &&
          Number.isFinite(Number(l.latitude)) &&
          Number.isFinite(Number(l.longitude)),
      ),
    [lojasVisiveis],
  );

  const posicoesGpsHabilitados = useMemo(
    () => posicoesVisiveis.filter(tecnicoGpsHabilitado),
    [posicoesVisiveis],
  );

  const proximidade = useMemo(() => {
    if (!lojaSelecionada) return null;
    if (!lojaTemGpsTecnicosHabilitados(lojaSelecionada, posicoesVisiveis)) return null;
    return tecnicoMaisProximoLoja(lojaSelecionada, posicoesGpsHabilitados);
  }, [lojaSelecionada, posicoesVisiveis, posicoesGpsHabilitados]);

  const trajetoCompleto = periodoTrajetoCompleto(dataTrajetoInicio, dataTrajetoFim);
  const selecionandoTrajeto = selecionandoPeriodoTrajeto(dataTrajetoInicio, dataTrajetoFim);
  const ocultarRegioesTrajeto = ocultarRegioesIndividuaisTrajeto(dataTrajetoInicio, dataTrajetoFim);
  const trajetoHoje = trajetoReferenteHoje(dataTrajetoInicio, dataTrajetoFim);
  const historicoTrajeto = modoHistoricoTrajeto(dataTrajetoInicio, dataTrajetoFim);

  const carregar = useCallback(async () => {
    try {
      const data = await api.frotaMapaPosicoes();
      setPosicoes(data.tecnicos);
      setVeiculos(data.veiculos ?? []);
      setRastreamentoAtivo(data.rastreamento_ativo !== false);
      setLojas(data.lojas);
      setRegioes(data.regioes);
      setErro('');
      carregouInicial.current = true;
    } catch (e) {
      if (!carregouInicial.current) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar localizações');
      }
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!podeVerMapaTecnicosMobile(getUsuario())) return;
    void carregar();
  }, [userId, carregar]);

  useEffect(() => {
    if (!regioes.length || regiaoInicializada.current) return;
    regiaoInicializada.current = true;
    if (podeFiltrarRegioes) {
      setRegiaoFiltro('');
      return;
    }
    if (regioes.length === 1) {
      setRegiaoFiltro(Number(regioes[0].id_regiao));
    }
  }, [regioes, podeFiltrarRegioes]);

  useEffect(() => {
    if (!selecionandoTrajeto && !historicoTrajeto) return;
    setRegiaoFiltro('');
    setLojaSelecionada(null);
  }, [selecionandoTrajeto, historicoTrajeto]);

  useEffect(() => {
    if (!lojaSelecionada) return;
    const aindaVisivel = lojasVisiveis.some((l) => l.id_loja === lojaSelecionada.id_loja);
    if (!aindaVisivel) setLojaSelecionada(null);
  }, [lojasVisiveis, lojaSelecionada]);

  function selecionarRegiao(idRegiao: number | '') {
    setRegiaoFiltro(idRegiao === '' ? '' : Number(idRegiao));
    setLojaSelecionada(null);
    setTecnicoFoco(null);
    setVeiculoFoco(null);
  }

  function selecionarPeriodoTrajeto(inicio: string, fim: string) {
    setDataTrajetoInicio(inicio || hoje);
    setDataTrajetoFim(fim);
    if (inicio && !fim) {
      setRegiaoFiltro('');
      setLojaSelecionada(null);
    }
    setVeiculoTrajetoId(null);
    setVeiculoTrajetoMeta(null);
  }

  function selecionarVeiculoTrajeto(veiculo: FrotaVeiculo | null) {
    setVeiculoTrajetoId(veiculo?.id_veiculo ?? null);
    setVeiculoTrajetoMeta(veiculo);
  }

  function registrarLimparTrajetoAoVivo(fn: () => void) {
    limparTrajetoAoVivoRef.current = fn;
  }

  function limparFiltrosTrajeto() {
    setDataTrajetoInicio(hoje);
    setDataTrajetoFim(hoje);
    setVeiculoTrajetoId(null);
    setVeiculoTrajetoMeta(null);
    limparTrajetoAoVivoRef.current();
  }

  function selecionarLoja(loja: FrotaRegiaoLoja) {
    const idRegiao =
      regiaoFiltro !== ''
        ? Number(regiaoFiltro)
        : loja.id_regiao != null
          ? Number(loja.id_regiao)
          : null;
    const lojaComRegiao =
      idRegiao != null
        ? lojas.find((l) => l.id_loja === loja.id_loja && Number(l.id_regiao) === idRegiao) ?? {
            ...loja,
            id_regiao: idRegiao,
          }
        : loja;
    setLojaSelecionada((prev) => (prev?.id_loja === lojaComRegiao.id_loja ? null : lojaComRegiao));
    setTecnicoFoco(null);
    setVeiculoFoco(null);
  }

  function limparLoja() {
    setLojaSelecionada(null);
  }

  function focarTecnico(tecnico: FrotaTecnicoPosicao) {
    setTecnicoFoco(tecnico);
    setVeiculoFoco(null);
  }

  function limparTecnicoFoco() {
    setTecnicoFoco(null);
  }

  function focarVeiculo(veiculo: FrotaVeiculoPosicao) {
    setVeiculoFoco(veiculo);
    setTecnicoFoco(null);
    setLojaSelecionada(null);
  }

  function limparVeiculoFoco() {
    setVeiculoFoco(null);
  }

  const value = useMemo(
    () => ({
      posicoes: posicoesGpsHabilitados,
      veiculos: veiculosVisiveis,
      lojas: lojasVisiveis,
      lojasComCoordenadas,
      regioes,
      regiaoFiltro,
      podeFiltrarRegioes,
      podeFiltrarDataTrajeto,
      dataTrajetoInicio,
      dataTrajetoFim,
      periodoTrajetoCompleto: trajetoCompleto,
      selecionandoPeriodoTrajeto: selecionandoTrajeto,
      ocultarRegioesIndividuaisTrajeto: ocultarRegioesTrajeto,
      trajetoReferenteHoje: trajetoHoje,
      modoHistoricoTrajeto: historicoTrajeto,
      veiculoTrajetoId,
      veiculoTrajetoMeta,
      rastreamentoAtivo,
      lojaSelecionada,
      tecnicoFoco,
      veiculoFoco,
      proximidade,
      lojaTemGpsTecnicosHabilitados: (loja: FrotaRegiaoLoja) =>
        lojaTemGpsTecnicosHabilitados(loja, posicoesVisiveis),
      erro,
      selecionarRegiao,
      selecionarPeriodoTrajeto,
      selecionarVeiculoTrajeto,
      limparFiltrosTrajeto,
      registrarLimparTrajetoAoVivo,
      selecionarLoja,
      limparLoja,
      focarTecnico,
      limparTecnicoFoco,
      focarVeiculo,
      limparVeiculoFoco,
    }),
    [
      posicoesGpsHabilitados,
      posicoesVisiveis,
      veiculosVisiveis,
      lojasVisiveis,
      lojasComCoordenadas,
      regioes,
      regiaoFiltro,
      podeFiltrarRegioes,
      podeFiltrarDataTrajeto,
      dataTrajetoInicio,
      dataTrajetoFim,
      trajetoCompleto,
      selecionandoTrajeto,
      ocultarRegioesTrajeto,
      trajetoHoje,
      historicoTrajeto,
      veiculoTrajetoId,
      veiculoTrajetoMeta,
      rastreamentoAtivo,
      lojaSelecionada,
      tecnicoFoco,
      veiculoFoco,
      proximidade,
      erro,
    ],
  );

  return <MapaTecnicosMobileContext.Provider value={value}>{children}</MapaTecnicosMobileContext.Provider>;
}

export function useMapaTecnicosMobile() {
  const ctx = useContext(MapaTecnicosMobileContext);
  if (!ctx) {
    throw new Error('useMapaTecnicosMobile deve ser usado dentro de MapaTecnicosMobileProvider');
  }
  return ctx;
}
