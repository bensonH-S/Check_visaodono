import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import SearchIcon from '@mui/icons-material/Search';
import { api, type FrotaVeiculo, type FrotaVeiculoPosicao, type FrotaVeiculoRotaDiaRelatorio, type Loja } from '../../api/client';
import FrotaRotaDiaMap from '../../components/frota/FrotaRotaDiaMap';
import FrotaVeiculoAutocomplete from '../../components/frota/FrotaVeiculoAutocomplete';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { tablePageLayoutSx } from '../../utils/tablePageLayout';
import { calcularTempoParadoMs, calcularTemposIgnicaoMs } from '../../utils/frotaTempoParado';
import { formatarDuracaoMs } from '../../utils/dateBr';

export default function FrotaRelatorioRotasPage() {
  const hoje = dayjs().format('YYYY-MM-DD');
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [relatorio, setRelatorio] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [veiculosMapa, setVeiculosMapa] = useState<FrotaVeiculoPosicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const periodoSoHoje = (dataInicio || hoje) === hoje && (dataFim || dataInicio || hoje) === hoje;

  useEffect(() => {
    api
      .frotaVeiculos()
      .then(setVeiculos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar veículos'));
    api
      .lojas()
      .then((lista) => setLojas(lista.filter((l) => l.latitude != null && l.longitude != null)))
      .catch(() => setLojas([]));
  }, []);

  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
    [veiculos],
  );

  const buscar = useCallback(() => {
    if (!veiculoSel) {
      setErro('Selecione um veículo');
      return;
    }
    const inicio = dataInicio || dataFim;
    const fim = dataFim || dataInicio;
    if (!inicio || !fim) {
      setErro('Selecione o período');
      return;
    }
    setLoading(true);
    setErro('');
    api
      .frotaVeiculoRotaDia(veiculoSel.id_veiculo, inicio, fim)
      .then(setRelatorio)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar rotas'))
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
  }, [periodoSoHoje, relatorio?.veiculo.id_veiculo]);

  const veiculoAoVivo = useMemo(() => {
    if (!periodoSoHoje || !veiculoSel) return null;
    return veiculosMapa.find((v) => v.id_veiculo === veiculoSel.id_veiculo) ?? null;
  }, [periodoSoHoje, veiculoSel, veiculosMapa]);

  const kmGps = relatorio?.km_gps ?? 0;
  const velocidadeMedia = useMemo(() => {
    if (relatorio?.velocidade_media != null) return relatorio.velocidade_media;
    const pts = relatorio?.pontos ?? [];
    let soma = 0;
    let count = 0;
    for (const p of pts) {
      const v = Number(p.velocidade) || 0;
      if (v > 0) {
        soma += v;
        count += 1;
      }
    }
    return count ? Math.round((soma / count) * 10) / 10 : 0;
  }, [relatorio]);
  const qtdParadas = relatorio?.qtd_paradas ?? 0;
  const qtdExcessos = relatorio?.qtd_excessos ?? 0;
  const tempoParadoMs = useMemo(() => {
    if (relatorio?.tempo_parado_ms != null) return relatorio.tempo_parado_ms;
    return calcularTempoParadoMs(relatorio?.pontos ?? []);
  }, [relatorio]);
  const temposIgnicao = useMemo(() => {
    if (relatorio?.tempo_ligado_ms != null && relatorio?.tempo_desligado_ms != null) {
      return {
        tempoLigadoMs: relatorio.tempo_ligado_ms,
        tempoDesligadoMs: relatorio.tempo_desligado_ms,
      };
    }
    return calcularTemposIgnicaoMs(relatorio?.pontos ?? []);
  }, [relatorio]);
  const kmExibicao = relatorio?.km_odometro ?? relatorio?.km_gps ?? 0;
  const mapKey = relatorio
    ? `${relatorio.veiculo.id_veiculo}-${relatorio.data_inicio}-${relatorio.data_fim}`
    : 'mapa-vazio';

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Relatório de rotas do veículo
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          flexShrink: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
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
        >
          Consultar
        </Button>
      </Paper>

      {erro && (
        <Alert severity="error" onClose={() => setErro('')} sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      {relatorio?.rastreamento_ativo === false && (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          Rastreamento Fulltrack desativado ou sem credenciais no servidor.
          Confira no .env: FULLTRACK_API_KEY (ou APIKEY) e FULLTRACK_SECRET_KEY (ou SECRETKEY),
          depois reinicie a API.
        </Alert>
      )}

      {loading && <LinearProgress sx={{ flexShrink: 0 }} />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))', xl: 'repeat(7, minmax(0, 1fr))' },
          gap: 0.75,
          flexShrink: 0,
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            KM no período (GPS)
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {kmGps.toLocaleString('pt-BR')} km
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Velocidade média rodada
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {velocidadeMedia.toLocaleString('pt-BR')} km/h
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Quantidade de paradas
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {qtdParadas}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tempo ligado / em movimento
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, color: 'success.main' }}>
            {formatarDuracaoMs(temposIgnicao.tempoLigadoMs)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tempo desligado
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, color: 'error.main' }}>
            {formatarDuracaoMs(temposIgnicao.tempoDesligadoMs)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tempo parado no período
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {formatarDuracaoMs(tempoParadoMs)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Excessos de velocidade
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              color: qtdExcessos > 0 ? 'error.main' : 'success.main',
            }}
          >
            {qtdExcessos}
          </Typography>
        </Paper>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          gap: 0.75,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <FrotaRotaDiaMap
            key={mapKey}
            rotas={relatorio?.rotas ?? []}
            pontos={relatorio?.pontos ?? []}
            excessosMapa={relatorio?.excessos_mapa ?? []}
            lojas={lojas}
            limiteKmh={relatorio?.limite_kmh ?? 80}
            altura="100%"
            diaAtual={periodoSoHoje}
            veiculoAoVivo={veiculoAoVivo}
            veiculoInfo={
              relatorio
                ? {
                    id_veiculo: relatorio.veiculo.id_veiculo,
                    placa: relatorio.veiculo.placa,
                    marca: relatorio.veiculo.marca,
                    modelo: relatorio.veiculo.modelo,
                  }
                : undefined
            }
          />
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            flexShrink: 0,
            lineHeight: 1.35,
            px: 0.25,
            pb: 0.25,
          }}
        >
          {relatorio ? (
            <>
              {relatorio.veiculo.placa} · {relatorio.data_inicio}
              {relatorio.data_fim !== relatorio.data_inicio ? ` a ${relatorio.data_fim}` : ''} · melhor estimativa:{' '}
              <strong>{kmExibicao.toLocaleString('pt-BR')} km</strong> ·{' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                vermelho = excesso · placas {relatorio.limite_kmh ?? 80} km/h · cinza = parada · clique na rota = detalhes
                {periodoSoHoje
                  ? ' · carro verde/vermelho = posição atual (ligado/desligado)'
                  : ' · carro verde = 1ª ligada · carro vermelho = parada com desligamento'}
              </Box>
            </>
          ) : (
            'Selecione veículo e período, depois clique em Consultar.'
          )}
        </Typography>
      </Box>
    </Box>
  );
}
