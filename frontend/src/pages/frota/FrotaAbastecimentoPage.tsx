import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import { api, fetchMediaAutenticada, type FrotaAbastecimentoMobile, type FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA } from '../../theme/safeArea';
import {
  filtrarKmAoDigitar,
  formatarKmInput,
  kmInputParaNumero,
  labelFixo,
  ph,
  campoAlturaFrotaSx,
} from '../../constants/frotaVeiculo';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

type Aba = 'novo' | 'historico';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function parseValorReais(texto: string): number | null {
  const limpo = String(texto || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '');
  if (!limpo) return null;
  let normalizado = limpo;
  if (limpo.includes(',') && limpo.includes('.')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    normalizado = limpo.replace(',', '.');
  }
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function PassoStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        py: 1,
        px: 0.5,
        borderRadius: 2,
        bgcolor: ok ? 'rgba(46, 125, 50, 0.08)' : 'rgba(27, 42, 107, 0.04)',
        border: `1px solid ${ok ? 'rgba(46, 125, 50, 0.25)' : 'rgba(27, 42, 107, 0.08)'}`,
      }}
    >
      {ok ? (
        <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
      ) : (
        <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
      )}
      <Typography
        variant="caption"
        sx={{
          fontWeight: ok ? 700 : 500,
          color: ok ? 'success.dark' : 'text.secondary',
          textAlign: 'center',
          lineHeight: 1.2,
          fontSize: '0.65rem',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function SegControl({
  aba,
  onChange,
  qtdHistorico,
}: {
  aba: Aba;
  onChange: (a: Aba) => void;
  qtdHistorico: number;
}) {
  const itens: { id: Aba; label: string; icon: ReactNode }[] = [
    { id: 'novo', label: 'Registrar', icon: <AddIcon sx={{ fontSize: 18 }} /> },
    {
      id: 'historico',
      label: qtdHistorico > 0 ? `Histórico (${qtdHistorico})` : 'Histórico',
      icon: <HistoryIcon sx={{ fontSize: 18 }} />,
    },
  ];
  return (
    <Box
      sx={{
        display: 'flex',
        p: 0.5,
        mb: 1.5,
        borderRadius: 2.5,
        bgcolor: 'rgba(27, 42, 107, 0.06)',
        border: '1px solid rgba(27, 42, 107, 0.08)',
      }}
    >
      {itens.map((item) => {
        const ativa = aba === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            startIcon={item.icon}
            sx={{
              flex: 1,
              minHeight: 40,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: ativa ? '#fff' : NAVY,
              bgcolor: ativa ? ORANGE : 'transparent',
              boxShadow: ativa ? '0 4px 12px rgba(232, 82, 10, 0.3)' : 'none',
              '&:hover': {
                bgcolor: ativa ? '#c94709' : 'rgba(27, 42, 107, 0.06)',
              },
              '& .MuiButton-startIcon': { mr: 0.75 },
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </Box>
  );
}

export default function FrotaAbastecimentoPage() {
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('novo');
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [historico, setHistorico] = useState<FrotaAbastecimentoMobile[]>([]);
  const [km, setKm] = useState('');
  const [valor, setValor] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [abrindoNota, setAbrindoNota] = useState<number | null>(null);

  const carregarHistorico = useCallback(async () => {
    const lista = await api.frotaAbastecimentosMobile();
    setHistorico(lista);
    return lista;
  }, []);

  const carregar = useCallback(async () => {
    const [resumo] = await Promise.all([api.frotaResumo(), carregarHistorico()]);
    setVeiculo(resumo.veiculo);
    if (resumo.veiculo?.km_atual != null) {
      setKm(formatarKmInput(String(resumo.veiculo.km_atual)));
    }
  }, [carregarHistorico]);

  useEffect(() => {
    carregar()
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [carregar]);

  const kmNum = kmInputParaNumero(km);
  const valorNum = parseValorReais(valor);
  const temNota = fotos.length > 0;
  const podeSalvar = Boolean(veiculo) && kmNum != null && valorNum != null && temNota && !salvando;

  const passos = useMemo(
    () => [
      { ok: kmNum != null, label: 'KM' },
      { ok: valorNum != null, label: 'Valor' },
      { ok: temNota, label: 'Nota' },
    ],
    [kmNum, valorNum, temNota],
  );

  const totalHistorico = useMemo(
    () => historico.reduce((s, a) => s + (Number(a.valor_abastecido) || 0), 0),
    [historico],
  );

  async function abrirComprovante(item: FrotaAbastecimentoMobile) {
    if (!item.comprovante_url) return;
    setAbrindoNota(item.id_abastecimento);
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
      setErro('Nenhum veículo atribuído. Peça ao responsável pelo portal.');
      return;
    }
    if (kmNum == null) {
      setErro('Informe o KM atual do odômetro');
      return;
    }
    if (valorNum == null) {
      setErro('Informe o valor abastecido (R$)');
      return;
    }
    if (!temNota) {
      setErro('Tire a foto da nota fiscal ou do comprovante');
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('km_atual', String(kmNum));
      fd.append('valor_abastecido', String(valorNum));
      const blob = dataUrlToBlob(fotos[0]);
      fd.append('comprovante', blob, `nota_fiscal${extensaoMidia(blob)}`);
      await api.frotaEnviarAbastecimento(fd);
      showToast('Abastecimento registrado!', 'success');
      setValor('');
      setFotos([]);
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
        <SegControl aba={aba} onChange={setAba} qtdHistorico={historico.length} />

        {aba === 'novo' && (
          <>
            {!veiculo ? (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  borderRadius: 3,
                  border: '1px dashed rgba(232, 82, 10, 0.45)',
                  bgcolor: 'rgba(232, 82, 10, 0.04)',
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'rgba(27, 42, 107, 0.08)',
                    color: ORANGE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5,
                  }}
                >
                  <DirectionsCarIcon sx={{ fontSize: 32 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, color: NAVY, mb: 0.75 }}>
                  Sem veículo atribuído
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Peça ao responsável para atribuir o veículo pelo portal. Você ainda pode ver o
                  histórico na outra aba.
                </Typography>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setAba('historico')}
                  startIcon={<HistoryIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700, borderColor: ORANGE, color: ORANGE }}
                >
                  Ver histórico
                </Button>
              </Paper>
            ) : (
              <>
                <FrotaVeiculoControleCard veiculo={veiculo} permitirDevolver={false} />

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid rgba(27, 42, 107, 0.1)',
                    boxShadow: '0 6px 20px rgba(27, 42, 107, 0.07)',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: 'rgba(232, 82, 10, 0.1)',
                        color: ORANGE,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LocalGasStationIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>
                        Novo abastecimento
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        KM, valor pago e foto da nota
                      </Typography>
                    </Box>
                  </Box>

                  {erro && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
                      {erro}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {passos.map((p) => (
                      <PassoStatus key={p.label} ok={p.ok} label={p.label} />
                    ))}
                  </Box>

                  <TextField
                    fullWidth
                    label="KM no odômetro"
                    value={km}
                    onChange={(e) => setKm(filtrarKmAoDigitar(e.target.value))}
                    inputMode="numeric"
                    required
                    placeholder={ph.km}
                    helperText="Quilometragem no momento do abastecimento"
                    sx={{ ...campoAlturaFrotaSx, mb: 0.5 }}
                    slotProps={{ inputLabel: labelFixo.inputLabel }}
                  />
                  <TextField
                    fullWidth
                    label="Valor pago (R$)"
                    value={valor}
                    onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
                    inputMode="decimal"
                    required
                    placeholder={ph.valor}
                    helperText="Total pago no posto"
                    sx={{ ...campoAlturaFrotaSx, mb: 1.5 }}
                    slotProps={{ inputLabel: labelFixo.inputLabel }}
                  />

                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px dashed ${temNota ? 'rgba(46, 125, 50, 0.4)' : 'rgba(232, 82, 10, 0.35)'}`,
                      bgcolor: temNota ? 'rgba(46, 125, 50, 0.04)' : 'rgba(232, 82, 10, 0.03)',
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PhotoCameraIcon sx={{ fontSize: 20, color: temNota ? 'success.main' : ORANGE }} />
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, color: NAVY, lineHeight: 1.2 }}
                        >
                          Nota fiscal *
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Tire a foto do cupom ou da nota
                        </Typography>
                      </Box>
                    </Box>
                    <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={1} inlineActions />
                  </Box>

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={!podeSalvar}
                    startIcon={<LocalGasStationIcon />}
                    sx={{
                      minHeight: 52,
                      borderRadius: 2.5,
                      bgcolor: ORANGE,
                      fontWeight: 800,
                      fontSize: '1rem',
                      textTransform: 'none',
                      boxShadow: '0 8px 20px rgba(232, 82, 10, 0.35)',
                      '&:hover': { bgcolor: '#c94709' },
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(27, 42, 107, 0.12)',
                        color: 'rgba(27, 42, 107, 0.4)',
                      },
                    }}
                  >
                    {salvando ? 'Registrando…' : 'Registrar abastecimento'}
                  </Button>
                </Paper>
              </>
            )}
          </>
        )}

        {aba === 'historico' && (
          <Box>
            {historico.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.75,
                  mb: 1.5,
                  borderRadius: 2.5,
                  border: '1px solid rgba(27, 42, 107, 0.1)',
                  bgcolor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Últimos registros
                  </Typography>
                  <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '1.05rem' }}>
                    {historico.length} abastecimento{historico.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Total listado
                  </Typography>
                  <Typography sx={{ fontWeight: 800, color: ORANGE, fontSize: '1.05rem' }}>
                    R$ {totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Paper>
            )}

            {historico.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  borderRadius: 3,
                  border: '1px dashed rgba(27, 42, 107, 0.2)',
                  bgcolor: 'rgba(27, 42, 107, 0.03)',
                }}
              >
                <HistoryIcon sx={{ fontSize: 40, color: 'rgba(27, 42, 107, 0.35)', mb: 1 }} />
                <Typography sx={{ fontWeight: 800, color: NAVY, mb: 0.5 }}>
                  Nenhum abastecimento ainda
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Quando você registrar um abastecimento, ele aparece aqui.
                </Typography>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => setAba('novo')}
                  startIcon={<AddIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: ORANGE,
                    '&:hover': { bgcolor: '#c94709' },
                  }}
                >
                  Registrar agora
                </Button>
              </Paper>
            ) : (
              historico.map((a) => (
                <Paper
                  key={a.id_abastecimento}
                  elevation={0}
                  sx={{
                    p: 1.75,
                    mb: 1.25,
                    borderRadius: 2.5,
                    border: '1px solid rgba(27, 42, 107, 0.1)',
                    borderLeft: `4px solid ${ORANGE}`,
                    bgcolor: '#fff',
                    boxShadow: '0 4px 14px rgba(27, 42, 107, 0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: 'rgba(232, 82, 10, 0.1)',
                        color: ORANGE,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <LocalGasStationIcon fontSize="small" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, color: NAVY, lineHeight: 1.25 }}>
                        {a.placa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {formatDataHoraBrasilia(a.data_abastecimento)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: NAVY,
                            bgcolor: 'rgba(27, 42, 107, 0.06)',
                            px: 1,
                            py: 0.35,
                            borderRadius: 1,
                          }}
                        >
                          {a.km_atual.toLocaleString('pt-BR')} km
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: ORANGE,
                            bgcolor: 'rgba(232, 82, 10, 0.08)',
                            px: 1,
                            py: 0.35,
                            borderRadius: 1,
                          }}
                        >
                          R${' '}
                          {a.valor_abastecido.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    </Box>
                    {a.comprovante_url && (
                      <IconButton
                        type="button"
                        size="small"
                        aria-label="Ver nota fiscal"
                        disabled={abrindoNota === a.id_abastecimento}
                        onClick={() => void abrirComprovante(a)}
                        sx={{
                          color: ORANGE,
                          bgcolor: 'rgba(232, 82, 10, 0.08)',
                          '&:hover': { bgcolor: 'rgba(232, 82, 10, 0.16)' },
                        }}
                      >
                        <ImageOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Paper>
              ))
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
