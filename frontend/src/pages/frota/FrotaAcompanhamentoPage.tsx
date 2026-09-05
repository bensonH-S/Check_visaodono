import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  api,
  type FrotaRegistroVelocidade,
  type FrotaVeiculo,
  type FrotaVeiculoPosicao,
  type FrotaVeiculoRotaDiaRelatorio,
  type FrotaVeiculoVelocidadeRelatorio,
  type Loja,
} from '../../api/client';
import FrotaRotaDiaMap from '../../components/frota/FrotaRotaDiaMap';
import {
  COR_EXCESSO_FROTA,
  COR_STATUS_DISPONIVEL,
  COR_STATUS_EM_ROTA,
  COR_STATUS_PARADO,
  COR_TRAJETO,
} from '../../components/frota/frotaMapaBasemap';
import FrotaVeiculoAutocomplete from '../../components/frota/FrotaVeiculoAutocomplete';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import FrotaVeiculosKmSemanaPanel from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import PageLoading from '../../components/PageLoading';
import { tablePageLayoutSx } from '../../utils/tablePageLayout';
import { calcularTempoParadoMs } from '../../utils/frotaTempoParado';
import { dataHojeBrasilia, formatDataHoraBrasilia, formatarDuracaoMs } from '../../utils/dateBr';
import { geocodificarReversa } from '../../utils/geocodificarReversa';
import { colors, radius, shadows } from '../../theme/tokens';
import { iconeMarcaLojaPorNome, iconeMarcaLojaUrl } from '../../utils/marcaLojaMapa';
import { contarPassagensPorLoja } from '../../utils/frotaPassagensLoja';

function resumirEndereco(endereco: string): string {
  if (!endereco || endereco === 'Carregando…' || endereco === 'Endereço indisponível') return endereco;
  const partes = endereco.split(',').map((p) => p.trim()).filter(Boolean);
  return partes.slice(0, 3).join(', ') || endereco;
}

function listarExcessosVelocidade(relatorio: FrotaVeiculoVelocidadeRelatorio): FrotaRegistroVelocidade[] {
  const limite = relatorio.limite_kmh ?? 80;
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

function formatHoraEvento(iso: string | null | undefined, multiDia: boolean) {
  if (!iso) return '—';
  const full = formatDataHoraBrasilia(iso);
  if (multiDia) return full;
  const partes = full.split(',').map((p) => p.trim());
  return partes[1] || full;
}

function KpiItem({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: 'alerta' | 'neutro';
}) {
  return (
    <Box sx={{ minWidth: 0, px: { xs: 1, md: 1.5 }, py: 1 }}>
      <Typography
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          mb: 0.35,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: { xs: '1.15rem', md: '1.35rem' },
          lineHeight: 1.15,
          color: destaque === 'alerta' ? colors.orange : colors.textPrimary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </Typography>
    </Box>
  );
}

function LinhaExcesso({
  item,
  multiDia,
}: {
  item: FrotaRegistroVelocidade;
  multiDia: boolean;
}) {
  const [endereco, setEndereco] = useState('…');

  useEffect(() => {
    let ativo = true;
    setEndereco('…');
    void geocodificarReversa(Number(item.latitude), Number(item.longitude)).then((txt) => {
      if (ativo) setEndereco(resumirEndereco(txt));
    });
    return () => {
      ativo = false;
    };
  }, [item.latitude, item.longitude]);

  const delta = item.velocidade - item.limite;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '88px 120px 1fr',
        gap: 1.5,
        alignItems: 'center',
        px: 1.75,
        py: 1.1,
        borderBottom: '1px solid',
        borderColor: colors.border,
        '&:hover': { bgcolor: colors.canvasAlt },
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}
      >
        {formatHoraEvento(item.atualizado_em, multiDia)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary }}
        >
          {item.velocidade}
          <Box component="span" sx={{ fontWeight: 500, color: colors.textMuted, ml: 0.35, fontSize: '0.75rem' }}>
            km/h
          </Box>
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: colors.orange, fontVariantNumeric: 'tabular-nums' }}
        >
          +{delta}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        title={endereco}
        sx={{ minWidth: 0 }}
      >
        {endereco}
      </Typography>
    </Box>
  );
}

/** Visão profissional de acompanhamento: mapa limpo + KPIs + eventos de excesso. */
export default function FrotaAcompanhamentoPage() {
  const hoje = dataHojeBrasilia();
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [rota, setRota] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [velocidade, setVelocidade] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [veiculosMapa, setVeiculosMapa] = useState<FrotaVeiculoPosicao[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [kmAberto, setKmAberto] = useState(false);

  const periodoSoHoje = (dataInicio || hoje) === hoje && (dataFim || dataInicio || hoje) === hoje;
  const multiDia = Boolean(dataInicio && dataFim && dataInicio !== dataFim);
  const consultou = rota != null || velocidade != null;

  useEffect(() => {
    api
      .frotaVeiculos()
      .then(setVeiculos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar veículos'));
    api
      .lojas({ ativas: true, operacionais: true })
      .then(setLojas)
      .catch(() => {
        /* mapa segue sem lojas */
      });
  }, []);

  const lojasComCoordenada = useMemo(
    () =>
      lojas.filter((l) => {
        const lat = Number(l.latitude);
        const lng = Number(l.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng);
      }),
    [lojas],
  );
  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
    [veiculos],
  );

  const buscar = useCallback(() => {
    if (!veiculoSel) {
      setErro('Selecione um veículo');
      return;
    }
    let inicio = dataInicio || dataFim;
    let fim = dataFim || dataInicio;
    if (!inicio || !fim) {
      setErro('Selecione o período');
      return;
    }
    if (inicio > fim) {
      const tmp = inicio;
      inicio = fim;
      fim = tmp;
    }
    setLoading(true);
    setErro('');
    Promise.all([
      api.frotaVeiculoRotaDia(veiculoSel.id_veiculo, inicio, fim),
      api.frotaVeiculoVelocidade(veiculoSel.id_veiculo, inicio, fim),
    ])
      .then(([r, v]) => {
        setRota(r);
        setVelocidade(v);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar acompanhamento'))
      .finally(() => setLoading(false));
  }, [veiculoSel, dataInicio, dataFim]);

  useEffect(() => {
    if (!periodoSoHoje) {
      setVeiculosMapa([]);
      return;
    }
    api
      .frotaMapaPosicoes()
      .then((d) => setVeiculosMapa(d.veiculos ?? []))
      .catch(() => setVeiculosMapa([]));
  }, [periodoSoHoje, rota?.veiculo.id_veiculo]);

  const veiculoAoVivo = useMemo(() => {
    if (!periodoSoHoje || !veiculoSel) return null;
    return veiculosMapa.find((v) => v.id_veiculo === veiculoSel.id_veiculo) ?? null;
  }, [periodoSoHoje, veiculoSel, veiculosMapa]);

  const excessos = useMemo(
    () => (velocidade ? listarExcessosVelocidade(velocidade) : []),
    [velocidade],
  );

  const kmGps = rota?.km_gps ?? 0;
  const kmExibicao = rota?.km_odometro ?? rota?.km_gps ?? 0;
  const velocidadeMaxima = velocidade?.velocidade_maxima ?? 0;
  const limiteKmh = rota?.limite_kmh ?? velocidade?.limite_kmh ?? 80;
  const qtdExcessos = rota?.qtd_excessos ?? excessos.length;
  const tempoParadoMs = useMemo(() => {
    if (rota?.tempo_parado_ms != null) return rota.tempo_parado_ms;
    if (velocidade?.tempo_parado_ms != null) return velocidade.tempo_parado_ms;
    return calcularTempoParadoMs(rota?.pontos ?? []);
  }, [rota, velocidade]);

  const rastreamentoAtivo = rota?.rastreamento_ativo !== false && velocidade?.rastreamento_ativo !== false;
  const mapKey = rota
    ? `${rota.veiculo.id_veiculo}-${rota.data_inicio}-${rota.data_fim}`
    : 'mapa-vazio';

  const passagensLoja = useMemo(() => {
    if (!rota?.pontos?.length || !lojasComCoordenada.length) return [];
    return contarPassagensPorLoja(rota.pontos, lojasComCoordenada);
  }, [rota?.pontos, lojasComCoordenada]);

  const passagensPorLoja = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of passagensLoja) map[p.id_loja] = p.passagens;
    return map;
  }, [passagensLoja]);

  const totalPassagensLoja = useMemo(
    () => passagensLoja.reduce((acc, p) => acc + p.passagens, 0),
    [passagensLoja],
  );

  const kpiKm = consultou ? `${kmGps.toLocaleString('pt-BR')} km` : '0 km';
  const kpiExcessos = consultou ? String(qtdExcessos) : '0';
  const kpiMax = consultou ? `${velocidadeMaxima.toLocaleString('pt-BR')} km/h` : '0 km/h';
  const kpiParado = consultou ? formatarDuracaoMs(tempoParadoMs) : formatarDuracaoMs(0);
  const kpiLojas = consultou ? String(passagensLoja.length) : '0';

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1.25 }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          flexShrink: 0,
          border: '1px solid',
          borderColor: colors.border,
          borderRadius: `${radius.lg}px`,
          bgcolor: colors.surface,
          boxShadow: shadows.sm,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
        }}
      >
        <FrotaVeiculoAutocomplete
          options={veiculosOrdenados}
          value={veiculoSel}
          onChange={setVeiculoSel}
          sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}
        />
        <FiltroIntervaloDatasFrota
          dataInicio={dataInicio}
          dataFim={dataFim}
          onChangeInicio={setDataInicio}
          onChangeFim={setDataFim}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => void buscar()}
          disabled={!veiculoSel || loading}
          sx={{
            bgcolor: colors.orange,
            '&:hover': { bgcolor: colors.orangeHover },
            px: 2.5,
            fontWeight: 600,
          }}
        >
          Consultar
        </Button>
      </Paper>

      {erro && (
        <Alert severity="error" onClose={() => setErro('')} sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      {consultou && !rastreamentoAtivo && (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          Rastreamento Fulltrack desativado ou sem credenciais no servidor.
        </Alert>
      )}

      {loading && <PageLoading />}

      <Paper
        elevation={0}
        sx={{
          flexShrink: 0,
          border: '1px solid',
          borderColor: colors.border,
          borderRadius: `${radius.lg}px`,
          bgcolor: colors.surface,
          boxShadow: shadows.sm,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr))' },
          '& > *:not(:last-child)': {
            borderRight: { md: `1px solid ${colors.border}` },
          },
          '& > *:nth-of-type(odd)': {
            borderBottom: { xs: `1px solid ${colors.border}`, md: 'none' },
          },
        }}
      >
        <KpiItem label={periodoSoHoje ? 'KM rodado hoje' : 'KM no período'} valor={kpiKm} />
        <KpiItem
          label="Excessos"
          valor={kpiExcessos}
          destaque={consultou && qtdExcessos > 0 ? 'alerta' : 'neutro'}
        />
        <KpiItem
          label="Vel. máxima"
          valor={kpiMax}
          destaque={consultou && velocidadeMaxima > limiteKmh ? 'alerta' : 'neutro'}
        />
        <KpiItem label="Tempo parado" valor={kpiParado} />
        <KpiItem label="Lojas visitadas" valor={kpiLojas} />
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            flex: '1 1 auto',
            minHeight: { xs: 300, md: 420 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: colors.border,
            borderRadius: `${radius.lg}px`,
            bgcolor: colors.surface,
            boxShadow: shadows.sm,
            p: 1.25,
            gap: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, px: 0.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colors.textPrimary }}>
              Trajeto
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
              {rota ? (
                <>
                  {rota.veiculo.placa}
                  {' · '}
                  {rota.data_inicio}
                  {rota.data_fim !== rota.data_inicio ? ` a ${rota.data_fim}` : ''}
                  {' · '}
                  {kmExibicao.toLocaleString('pt-BR')} km
                  {qtdExcessos > 0 ? ' · excessos em laranja' : ''}
                  {' · limite '}
                  {limiteKmh} km/h
                </>
              ) : (
                'Selecione veículo e período, depois clique em Consultar'
              )}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <FrotaRotaDiaMap
              key={mapKey}
              rotas={rota?.rotas ?? []}
              pontos={rota?.pontos ?? []}
              excessosMapa={rota?.excessos_mapa ?? []}
              lojas={lojasComCoordenada}
              passagensPorLoja={passagensPorLoja}
              limiteKmh={limiteKmh}
              altura="100%"
              diaAtual={periodoSoHoje}
              veiculoAoVivo={veiculoAoVivo}
              mostrarLegenda={false}
              mostrarParadas={false}
              mostrarPlacasExcesso={false}
              veiculoInfo={
                rota
                  ? {
                      id_veiculo: rota.veiculo.id_veiculo,
                      placa: rota.veiculo.placa,
                      marca: rota.veiculo.marca,
                      modelo: rota.veiculo.modelo,
                    }
                  : undefined
              }
            />
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                left: 10,
                zIndex: 1000,
                bgcolor: colors.surface,
                border: '1px solid',
                borderColor: colors.borderStrong,
                borderRadius: 1.5,
                px: 1.25,
                py: 0.85,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.55,
                boxShadow: shadows.sm,
                pointerEvents: 'none',
              }}
            >
              {(
                [
                  { cor: COR_STATUS_EM_ROTA, rotulo: 'Em rota' },
                  { cor: COR_STATUS_DISPONIVEL, rotulo: 'Disponível' },
                  { cor: COR_STATUS_PARADO, rotulo: 'Parado' },
                  { cor: COR_TRAJETO, rotulo: 'Trajeto', linha: true },
                  ...(qtdExcessos > 0
                    ? [{ cor: COR_EXCESSO_FROTA, rotulo: 'Excesso', linha: true as const }]
                    : []),
                ] as { cor: string; rotulo: string; linha?: boolean }[]
              ).map((item) => (
                <Box key={item.rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                  {item.linha ? (
                    <Box sx={{ width: 18, height: 3, borderRadius: 1, bgcolor: item.cor, flexShrink: 0 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: item.cor,
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 1px rgba(0,0,0,.12)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textPrimary, lineHeight: 1.2 }}>
                    {item.rotulo}
                  </Typography>
                </Box>
              ))}
              {lojasComCoordenada.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                  <Box
                    component="img"
                    src={iconeMarcaLojaUrl('burger-king')}
                    alt=""
                    sx={{
                      width: 14,
                      height: 14,
                      objectFit: 'contain',
                      flexShrink: 0,
                      bgcolor: '#fff',
                      borderRadius: 0.5,
                      boxShadow: '0 0 0 1px rgba(0,0,0,.08)',
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textPrimary, lineHeight: 1.2 }}>
                    Loja
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>

        <Box
          sx={{
            flex: '0 0 auto',
            height: { xs: 210, md: 240 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 1,
            minHeight: 0,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: colors.border,
              borderRadius: `${radius.lg}px`,
              bgcolor: colors.surface,
              boxShadow: shadows.sm,
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                px: 1.75,
                py: 1.1,
                borderBottom: '1px solid',
                borderColor: colors.border,
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colors.textPrimary }}>
                Excessos
                {consultou ? ` · ${excessos.length}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                acima de {limiteKmh} km/h
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {excessos.length > 0 ? (
                excessos.map((r, idx) => (
                  <LinhaExcesso
                    key={`${r.atualizado_em ?? idx}-${r.velocidade}-${r.latitude}`}
                    item={r}
                    multiDia={multiDia}
                  />
                ))
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 1.75, py: 3, textAlign: 'center' }}
                >
                  {consultou
                    ? 'Nenhum excesso no período.'
                    : 'Os excessos do veículo aparecem aqui após consultar.'}
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: colors.border,
              borderRadius: `${radius.lg}px`,
              bgcolor: colors.surface,
              boxShadow: shadows.sm,
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                px: 1.75,
                py: 1.1,
                borderBottom: '1px solid',
                borderColor: colors.border,
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colors.textPrimary }}>
                Passagens nas lojas
                {consultou ? ` · ${passagensLoja.length}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {consultou
                  ? `${totalPassagensLoja} ${totalPassagensLoja === 1 ? 'entrada' : 'entradas'} · raio 80 m`
                  : 'quantas vezes o veículo entrou na loja'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {passagensLoja.length > 0 ? (
                passagensLoja.map((item) => (
                  <Box
                    key={item.id_loja}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr auto',
                      gap: 1.25,
                      alignItems: 'center',
                      px: 1.75,
                      py: 1.05,
                      borderBottom: '1px solid',
                      borderColor: colors.border,
                      '&:hover': { bgcolor: colors.canvasAlt },
                      '&:last-of-type': { borderBottom: 'none' },
                    }}
                  >
                    <Box
                      component="img"
                      src={iconeMarcaLojaPorNome({ name: item.nome })}
                      alt=""
                      sx={{
                        width: 28,
                        height: 28,
                        objectFit: 'contain',
                        bgcolor: '#fff',
                        borderRadius: 0.75,
                        boxShadow: '0 0 0 1px rgba(0,0,0,.08)',
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        title={item.nome}
                        sx={{ fontWeight: 600, color: colors.textPrimary }}
                      >
                        {item.nome}
                      </Typography>
                      {item.bk_number ? (
                        <Typography variant="caption" color="text.secondary">
                          BKN {item.bk_number}
                        </Typography>
                      ) : null}
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        color: colors.textPrimary,
                        fontSize: '1.05rem',
                        lineHeight: 1,
                      }}
                    >
                      {item.passagens}
                      <Box
                        component="span"
                        sx={{ ml: 0.4, fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted }}
                      >
                        {item.passagens === 1 ? 'vez' : 'vezes'}
                      </Box>
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 1.75, py: 3, textAlign: 'center' }}
                >
                  {consultou
                    ? 'Nenhuma passagem detectada perto de lojas no período.'
                    : 'Após consultar, aparece aqui quantas vezes o veículo passou em cada loja.'}
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        expanded={kmAberto}
        onChange={(_, open) => setKmAberto(open)}
        sx={{
          flexShrink: 0,
          border: '1px solid',
          borderColor: colors.border,
          borderRadius: `${radius.lg}px !important`,
          bgcolor: colors.surface,
          boxShadow: shadows.sm,
          '&:before': { display: 'none' },
          maxHeight: kmAberto ? { xs: 240, md: 280 } : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, px: 1.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colors.textPrimary }}>
            KM apontado
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, alignSelf: 'center' }}>
            Opcional · atribuições e abastecimentos
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}>
          {veiculoSel ? (
            <FrotaVeiculosKmSemanaPanel
              ativo={kmAberto}
              ocultarFiltro
              somenteApontado
              idVeiculoFiltro={veiculoSel.id_veiculo}
              dataInicio={dataInicio}
              dataFim={dataFim}
              onChangeInicio={setDataInicio}
              onChangeFim={setDataFim}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Selecione um veículo no filtro acima.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
