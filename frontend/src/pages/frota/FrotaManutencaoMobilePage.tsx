import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import BuildIcon from '@mui/icons-material/Build';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import {
  FrotaEmptyHistorico,
  FrotaEmptyVeiculo,
  FrotaFormHeader,
  FrotaHistoricoItem,
  FrotaPassos,
  FrotaResumoHistorico,
  FrotaSecaoFoto,
  FrotaSegControl,
  FrotaVeiculoFaixa,
  frotaCardSx,
  frotaCtaSx,
} from '../../components/frota/FrotaMobileUi';
import {
  api,
  fetchMediaAutenticada,
  type FrotaManutencaoMobile,
  type FrotaVeiculo,
} from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA } from '../../theme/safeArea';
import {
  filtrarKmAoDigitar,
  formatarKmInput,
  kmInputParaNumero,
  filtrarMoedaAoDigitar,
  moedaInputParaNumero,
  labelFixo,
  ph,
  campoAlturaFrotaSx,
} from '../../constants/frotaVeiculo';

type Aba = 'novo' | 'historico';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaManutencaoMobilePage() {
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('novo');
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [historico, setHistorico] = useState<FrotaManutencaoMobile[]>([]);
  const [descricao, setDescricao] = useState('');
  const [km, setKm] = useState('');
  const [proximaKm, setProximaKm] = useState('');
  const [valor, setValor] = useState('');
  const [dataManutencao, setDataManutencao] = useState(dataHojeIso);
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [abrindoNota, setAbrindoNota] = useState<number | null>(null);

  const carregarHistorico = useCallback(async () => {
    const lista = await api.frotaManutencoesMobile();
    setHistorico(lista);
    return lista;
  }, []);

  const carregar = useCallback(async () => {
    const [resumo] = await Promise.all([api.frotaResumo(), carregarHistorico()]);
    setVeiculo(resumo.veiculo);
    if (resumo.veiculo?.km_atual != null) {
      const kmFmt = formatarKmInput(String(resumo.veiculo.km_atual));
      setKm(kmFmt);
      setProximaKm(filtrarKmAoDigitar(String(resumo.veiculo.km_atual + 10000)));
    }
  }, [carregarHistorico]);

  useEffect(() => {
    carregar()
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [carregar]);

  const kmNum = kmInputParaNumero(km);
  const proxNum = kmInputParaNumero(proximaKm);
  const temDescricao = descricao.trim().length > 0;
  const temFoto = fotos.length > 0;
  const podeSalvar = Boolean(veiculo) && temDescricao && !salvando;

  const passos = useMemo(
    () => [
      { ok: temDescricao, label: 'Serviço' },
      { ok: kmNum != null, label: 'KM' },
      { ok: temFoto, label: 'Nota' },
    ],
    [temDescricao, kmNum, temFoto],
  );

  const totalHistorico = useMemo(
    () => historico.reduce((s, m) => s + (Number(m.valor) || 0), 0),
    [historico],
  );

  async function abrirComprovante(item: FrotaManutencaoMobile) {
    if (!item.comprovante_url) return;
    setAbrindoNota(item.id_manutencao);
    try {
      const path = item.comprovante_url.startsWith('http')
        ? item.comprovante_url
        : `${window.location.origin}${item.comprovante_url}`;
      const blobUrl = await fetchMediaAutenticada(path);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Não foi possível abrir a nota', 'error');
    } finally {
      setAbrindoNota(null);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!veiculo) {
      setErro('Aguarde a atribuição do veículo no portal');
      return;
    }
    if (!temDescricao) {
      setErro('Descreva o que foi feito na manutenção');
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('descricao', descricao.trim());
      if (kmNum != null) fd.append('km', String(kmNum));
      if (proxNum != null) fd.append('proxima_manutencao_km', String(proxNum));
      else if (kmNum != null) fd.append('proxima_manutencao_km', String(kmNum + 10000));
      const valorNum = moedaInputParaNumero(valor);
      if (valorNum != null) fd.append('valor', String(valorNum));
      if (dataManutencao) fd.append('data_manutencao', dataManutencao);
      if (fotos[0]) {
        const blob = dataUrlToBlob(fotos[0]);
        fd.append('comprovante', blob, `fatura${extensaoMidia(blob)}`);
      }
      await api.frotaEnviarManutencaoVeiculo(veiculo.id_veiculo, fd);
      showToast('Manutenção registrada!', 'success');
      setDescricao('');
      setProximaKm('');
      setValor('');
      setDataManutencao(dataHojeIso());
      setFotos([]);
      if (veiculo.km_atual != null) {
        setKm(formatarKmInput(String(veiculo.km_atual)));
      } else {
        setKm('');
      }
      await carregarHistorico();
      setAba('historico');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box
      component="form"
      onSubmit={salvar}
      sx={{ ...MOBILE_PAGE_COLUMN, maxWidth: 480, mx: 'auto', width: '100%' }}
    >
      <Box sx={{ ...MOBILE_SCROLL_AREA, py: 0.5, pb: 2 }}>
        <FrotaSegControl
          valor={aba}
          onChange={setAba}
          itens={[
            { id: 'novo', label: 'Registrar', icon: <AddIcon sx={{ fontSize: 18 }} /> },
            {
              id: 'historico',
              label: historico.length > 0 ? `Histórico (${historico.length})` : 'Histórico',
              icon: <HistoryIcon sx={{ fontSize: 18 }} />,
            },
          ]}
        />

        {aba === 'novo' && (
          <>
            {!veiculo ? (
              <FrotaEmptyVeiculo onVerHistorico={() => setAba('historico')} />
            ) : (
              <>
                <FrotaVeiculoFaixa veiculo={veiculo} />
                <Paper elevation={0} sx={frotaCardSx}>
                  <FrotaFormHeader
                    icon={<BuildIcon />}
                    titulo="Nova manutenção"
                    subtitulo="O que foi feito, KM e fatura"
                  />
                  {erro && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
                      {erro}
                    </Alert>
                  )}
                  <FrotaPassos passos={passos} />

                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="O que foi feito *"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                    placeholder="Ex.: Troca de óleo e filtros"
                    sx={{ mb: 1.5 }}
                    slotProps={{ inputLabel: labelFixo.inputLabel }}
                  />

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <TextField
                      fullWidth
                      label="KM atual"
                      value={km || '—'}
                      helperText="Do sistema"
                      sx={{
                        ...campoAlturaFrotaSx,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(27, 42, 107, 0.04)',
                        },
                      }}
                      slotProps={{
                        inputLabel: labelFixo.inputLabel,
                        input: { readOnly: true },
                        htmlInput: { tabIndex: -1 },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Próxima (KM)"
                      value={proximaKm}
                      onChange={(e) => setProximaKm(filtrarKmAoDigitar(e.target.value))}
                      inputMode="numeric"
                      placeholder="+10.000"
                      helperText="Sugestão +10 mil"
                      sx={campoAlturaFrotaSx}
                      slotProps={{ inputLabel: labelFixo.inputLabel }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      mb: 1.5,
                    }}
                  >
                    <TextField
                      fullWidth
                      label="Valor (R$)"
                      value={valor}
                      onChange={(e) => setValor(filtrarMoedaAoDigitar(e.target.value))}
                      inputMode="numeric"
                      placeholder={ph.valor}
                      sx={campoAlturaFrotaSx}
                      slotProps={{
                        inputLabel: labelFixo.inputLabel,
                        input: {
                          startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                        },
                      }}
                    />
                    <CampoDataFrota
                      label="Data"
                      value={dataManutencao}
                      onChange={setDataManutencao}
                      sx={campoAlturaFrotaSx}
                    />
                  </Box>

                  <FrotaSecaoFoto
                    ok={temFoto}
                    titulo="Fatura / nota"
                    dica="Opcional, mas ajuda na conferência"
                    icon={<PhotoCameraIcon sx={{ fontSize: 20 }} />}
                  >
                    <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={1} inlineActions />
                  </FrotaSecaoFoto>

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={!podeSalvar}
                    startIcon={<BuildIcon />}
                    sx={frotaCtaSx}
                  >
                    {salvando ? 'Registrando…' : 'Registrar manutenção'}
                  </Button>
                </Paper>
              </>
            )}
          </>
        )}

        {aba === 'historico' && (
          <Box>
            {historico.length > 0 && (
              <FrotaResumoHistorico
                titulo="Últimos serviços"
                quantidade={historico.length}
                totalLabel="Total listado"
                totalValor={
                  totalHistorico > 0
                    ? `R$ ${totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : '—'
                }
              />
            )}
            {historico.length === 0 ? (
              <FrotaEmptyHistorico
                mensagem="Quando você registrar uma manutenção, ela aparece aqui."
                onRegistrar={() => setAba('novo')}
              />
            ) : (
              historico.map((m) => {
                const chips: { label: string; destaque?: boolean }[] = [];
                if (m.km != null) chips.push({ label: `${m.km.toLocaleString('pt-BR')} km` });
                if (m.valor != null) {
                  chips.push({
                    label: `R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    destaque: true,
                  });
                }
                if (m.proxima_manutencao_km != null) {
                  chips.push({
                    label: `Próx. ${m.proxima_manutencao_km.toLocaleString('pt-BR')} km`,
                  });
                }
                return (
                  <FrotaHistoricoItem
                    key={m.id_manutencao}
                    titulo={m.placa}
                    subtitulo={`${formatDataHoraBrasilia(m.data_manutencao)} · ${m.descricao}`}
                    chips={chips}
                    temAnexo={Boolean(m.comprovante_url)}
                    abrindo={abrindoNota === m.id_manutencao}
                    onAbrirAnexo={() => void abrirComprovante(m)}
                  />
                );
              })
            )}
          </Box>
        )}

        {erro && !veiculo && aba === 'novo' && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErro('')}>
            {erro}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
