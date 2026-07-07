import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type FrotaRegiaoLoja, type FrotaTecnicoPosicao, type FrotaVeiculoPosicao } from '../../api/client';
import {
  getUsuario,
  podeFiltrarRegioesMapaMobile,
  podeVerMapaTecnicosMobile,
} from '../../lib/auth';
import { tecnicoMaisProximoLoja } from '../../utils/mapaGeo';

type RegiaoMapa = { id_regiao: number; nome: string };

type MapaTecnicosMobileContextValue = {
  posicoes: FrotaTecnicoPosicao[];
  veiculos: FrotaVeiculoPosicao[];
  lojas: FrotaRegiaoLoja[];
  lojasComCoordenadas: FrotaRegiaoLoja[];
  regioes: RegiaoMapa[];
  regiaoFiltro: number | '';
  podeFiltrarRegioes: boolean;
  rastreamentoAtivo: boolean;
  lojaSelecionada: FrotaRegiaoLoja | null;
  tecnicoFoco: FrotaTecnicoPosicao | null;
  veiculoFoco: FrotaVeiculoPosicao | null;
  proximidade: ReturnType<typeof tecnicoMaisProximoLoja>;
  erro: string;
  selecionarRegiao: (idRegiao: number | '') => void;
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
  const [posicoes, setPosicoes] = useState<FrotaTecnicoPosicao[]>([]);
  const [veiculos, setVeiculos] = useState<FrotaVeiculoPosicao[]>([]);
  const [rastreamentoAtivo, setRastreamentoAtivo] = useState(true);
  const [lojas, setLojas] = useState<FrotaRegiaoLoja[]>([]);
  const [regioes, setRegioes] = useState<RegiaoMapa[]>([]);
  const [erro, setErro] = useState('');
  const [regiaoFiltro, setRegiaoFiltro] = useState<number | ''>('');
  const [lojaSelecionada, setLojaSelecionada] = useState<FrotaRegiaoLoja | null>(null);
  const [tecnicoFoco, setTecnicoFoco] = useState<FrotaTecnicoPosicao | null>(null);
  const [veiculoFoco, setVeiculoFoco] = useState<FrotaVeiculoPosicao | null>(null);
  const carregouInicial = useRef(false);
  const regiaoInicializada = useRef(false);

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

  const proximidade = useMemo(() => {
    if (!lojaSelecionada) return null;
    return tecnicoMaisProximoLoja(lojaSelecionada, posicoes);
  }, [lojaSelecionada, posicoes]);

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
    setLojaSelecionada(lojaComRegiao);
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
      posicoes: posicoesVisiveis,
      veiculos: veiculosVisiveis,
      lojas: lojasVisiveis,
      lojasComCoordenadas,
      regioes,
      regiaoFiltro,
      podeFiltrarRegioes,
      rastreamentoAtivo,
      lojaSelecionada,
      tecnicoFoco,
      veiculoFoco,
      proximidade,
      erro,
      selecionarRegiao,
      selecionarLoja,
      limparLoja,
      focarTecnico,
      limparTecnicoFoco,
      focarVeiculo,
      limparVeiculoFoco,
    }),
    [
      posicoesVisiveis,
      veiculosVisiveis,
      lojasVisiveis,
      lojasComCoordenadas,
      regioes,
      regiaoFiltro,
      podeFiltrarRegioes,
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
