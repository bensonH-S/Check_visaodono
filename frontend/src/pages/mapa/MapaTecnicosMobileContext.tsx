import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type FrotaRegiaoLoja, type FrotaTecnicoPosicao } from '../../api/client';
import { getUsuario, podeVerMapaTecnicosMobile } from '../../lib/auth';
import { tecnicoMaisProximoLoja } from '../../utils/mapaGeo';

type MapaTecnicosMobileContextValue = {
  posicoes: FrotaTecnicoPosicao[];
  lojas: FrotaRegiaoLoja[];
  lojasComCoordenadas: FrotaRegiaoLoja[];
  lojaSelecionada: FrotaRegiaoLoja | null;
  tecnicoFoco: FrotaTecnicoPosicao | null;
  proximidade: ReturnType<typeof tecnicoMaisProximoLoja>;
  erro: string;
  selecionarLoja: (loja: FrotaRegiaoLoja) => void;
  limparLoja: () => void;
  focarTecnico: (tecnico: FrotaTecnicoPosicao) => void;
  limparTecnicoFoco: () => void;
};

const MapaTecnicosMobileContext = createContext<MapaTecnicosMobileContextValue | null>(null);

export function MapaTecnicosMobileProvider({ children }: { children: ReactNode }) {
  const user = getUsuario();
  const [posicoes, setPosicoes] = useState<FrotaTecnicoPosicao[]>([]);
  const [lojas, setLojas] = useState<FrotaRegiaoLoja[]>([]);
  const [erro, setErro] = useState('');
  const [lojaSelecionada, setLojaSelecionada] = useState<FrotaRegiaoLoja | null>(null);
  const [tecnicoFoco, setTecnicoFoco] = useState<FrotaTecnicoPosicao | null>(null);
  const carregouInicial = useRef(false);

  const lojasComCoordenadas = useMemo(
    () =>
      lojas.filter(
        (l) =>
          l.latitude != null &&
          l.longitude != null &&
          Number.isFinite(Number(l.latitude)) &&
          Number.isFinite(Number(l.longitude)),
      ),
    [lojas],
  );

  const proximidade = useMemo(() => {
    if (!lojaSelecionada) return null;
    return tecnicoMaisProximoLoja(lojaSelecionada, posicoes);
  }, [lojaSelecionada, posicoes]);

  const carregar = useCallback(async () => {
    try {
      const data = await api.frotaMapaPosicoes();
      setPosicoes(data.tecnicos);
      setLojas(data.lojas);
      setErro('');
      carregouInicial.current = true;
    } catch (e) {
      if (!carregouInicial.current) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar localizações');
      }
    }
  }, []);

  useEffect(() => {
    if (!podeVerMapaTecnicosMobile(user)) return;
    void carregar();
  }, [user, carregar]);

  function selecionarLoja(loja: FrotaRegiaoLoja) {
    setLojaSelecionada(loja);
    setTecnicoFoco(null);
  }

  function limparLoja() {
    setLojaSelecionada(null);
  }

  function focarTecnico(tecnico: FrotaTecnicoPosicao) {
    setTecnicoFoco(tecnico);
  }

  function limparTecnicoFoco() {
    setTecnicoFoco(null);
  }

  const value = useMemo(
    () => ({
      posicoes,
      lojas,
      lojasComCoordenadas,
      lojaSelecionada,
      tecnicoFoco,
      proximidade,
      erro,
      selecionarLoja,
      limparLoja,
      focarTecnico,
      limparTecnicoFoco,
    }),
    [posicoes, lojas, lojasComCoordenadas, lojaSelecionada, tecnicoFoco, proximidade, erro],
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
