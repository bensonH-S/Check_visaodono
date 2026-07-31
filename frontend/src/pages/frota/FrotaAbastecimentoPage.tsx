import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import FrotaMobileShell from '../../components/frota/FrotaMobileShell';
import {
  FrotaEmptyHistorico,
  FrotaEmptyVeiculo,
  FrotaFormHeader,
  FrotaHistoricoItem,
  FrotaPassos,
  FrotaResumoHistorico,
  FrotaSecaoFoto,
  FrotaVeiculoFaixa,
  frotaCardSx,
} from '../../components/frota/FrotaMobileUi';
import {
  api,
  fetchMediaAutenticada,
  type FrotaAbastecimentoMobile,
  type FrotaVeiculo,
} from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { getUsuario, modoAppTecnicoFrotaRestrito } from '../../lib/auth';
import {
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

export default function FrotaAbastecimentoPage() {
  const navigate = useNavigate();
  const modoRestrito = modoAppTecnicoFrotaRestrito(getUsuario());
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
  const valorNum = moedaInputParaNumero(valor);
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

  const shellProps = {
    titleLine1: 'Abastecimento',
    sub: veiculo
      ? `${veiculo.placa} · registre KM, valor e foto da nota`
      : 'Registre combustível com nota fiscal',
    variant: (modoRestrito ? 'hub' : 'page') as 'hub' | 'page',
    onBack: modoRestrito ? undefined : () => navigate('/frota/mobile'),
    metrics: [
      {
        value: historico.length,
        label: 'registros',
      },
      {
        value:
          totalHistorico > 0
            ? `R$ ${totalHistorico.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
            : '—',
        label: 'total',
        accent: true,
      },
      {
        value: veiculo?.km_atual != null ? veiculo.km_atual.toLocaleString('pt-BR') : '—',
        label: 'km',
      },
    ],
  };

  if (loading) {
    return (
      <FrotaMobileShell {...shellProps} sub="Carregando…">
        <LinearProgress />
      </FrotaMobileShell>
    );
  }

  return (
    <FrotaMobileShell {...shellProps}>
      <Box component="form" onSubmit={salvar} className="ck-frota__tabs-layout">
        <div className="ck-visitas__seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'novo'}
            className={`ck-visitas__seg-btn${aba === 'novo' ? ' is-on' : ''}`}
            onClick={() => setAba('novo')}
          >
            Registrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'historico'}
            className={`ck-visitas__seg-btn${aba === 'historico' ? ' is-on' : ''}`}
            onClick={() => setAba('historico')}
          >
            Histórico{historico.length > 0 ? ` · ${historico.length}` : ''}
          </button>
        </div>

        <div className="ck-frota__tabs-body">
        {aba === 'novo' && (
          <>
            {!veiculo ? (
              <FrotaEmptyVeiculo onVerHistorico={() => setAba('historico')} />
            ) : (
              <>
                <FrotaVeiculoFaixa veiculo={veiculo} />
                <Paper elevation={0} sx={frotaCardSx}>
                  <FrotaFormHeader
                    icon={<LocalGasStationIcon />}
                    titulo="Novo abastecimento"
                    subtitulo="KM, valor pago e foto da nota"
                  />
                  {erro && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
                      {erro}
                    </Alert>
                  )}
                  <FrotaPassos passos={passos} />
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <TextField
                      fullWidth
                      label="KM atual"
                      value={km || '—'}
                      inputMode="numeric"
                      required
                      helperText="KM do sistema · não editável"
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
                      label="Valor pago (R$)"
                      value={valor}
                      onChange={(e) => setValor(filtrarMoedaAoDigitar(e.target.value))}
                      inputMode="numeric"
                      required
                      placeholder={ph.valor}
                      helperText="Ex.: digite 15090 → 150,90"
                      sx={campoAlturaFrotaSx}
                      slotProps={{
                        inputLabel: labelFixo.inputLabel,
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">R$</InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Box>
                  <FrotaSecaoFoto
                    ok={temNota}
                    titulo="Nota fiscal *"
                    dica="Tire a foto do cupom ou da nota"
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
                    startIcon={<LocalGasStationIcon />}
                    className="ck-frota__cta"
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
              <FrotaResumoHistorico
                titulo="Últimos registros"
                quantidade={historico.length}
                totalLabel="Total listado"
                totalValor={`R$ ${totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              />
            )}
            {historico.length === 0 ? (
              <FrotaEmptyHistorico
                mensagem="Quando você registrar um abastecimento, ele aparece aqui."
                onRegistrar={() => setAba('novo')}
              />
            ) : (
              historico.map((a) => (
                <FrotaHistoricoItem
                  key={a.id_abastecimento}
                  titulo={a.placa}
                  subtitulo={formatDataHoraBrasilia(a.data_abastecimento)}
                  chips={[
                    { label: `${a.km_atual.toLocaleString('pt-BR')} km` },
                    {
                      label: `R$ ${a.valor_abastecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      destaque: true,
                    },
                  ]}
                  temAnexo={Boolean(a.comprovante_url)}
                  abrindo={abrindoNota === a.id_abastecimento}
                  onAbrirAnexo={() => void abrirComprovante(a)}
                />
              ))
            )}
          </Box>
        )}

        {erro && !veiculo && aba === 'novo' && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErro('')}>
            {erro}
          </Alert>
        )}
        </div>
      </Box>
    </FrotaMobileShell>
  );
}
