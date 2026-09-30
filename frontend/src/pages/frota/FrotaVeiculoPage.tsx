import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import FrotaMobileShell from '../../components/frota/FrotaMobileShell';
import { api } from '../../api/client';
import type { FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { filtrarKmAoDigitar, kmInputParaNumero, labelFixo, ph, rotuloVeiculoOpcao } from '../../constants/frotaVeiculo';
import { showToast } from '../../utils/toast';

const MAX_FOTOS_VEICULO = 10;

type EtapaAssumir = 0 | 1 | 2 | 3;

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FrotaVeiculoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [meuVeiculo, setMeuVeiculo] = useState<FrotaVeiculo | null>(null);
  const [idVeiculoAssumir, setIdVeiculoAssumir] = useState<number | ''>('');
  const [kmAssumir, setKmAssumir] = useState('');
  const [fotoCnh, setFotoCnh] = useState<string[]>([]);
  const [fotosVeiculo, setFotosVeiculo] = useState<string[]>([]);
  const [etapa, setEtapa] = useState<EtapaAssumir>(0);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  const dadosPreenchidos = Boolean(idVeiculoAssumir && kmInputParaNumero(kmAssumir) != null);
  const cnhPreenchida = fotoCnh.length > 0;
  const fotosVeiculoOk = fotosVeiculo.length > 0;
  const podeAssumir = dadosPreenchidos && cnhPreenchida && fotosVeiculoOk;

  const veiculosDisponiveis = useMemo(
    () => veiculos.filter((v) => v.id_usuario_responsavel == null),
    [veiculos],
  );

  async function carregar() {
    setLoading(true);
    try {
      const [lista, resumo] = await Promise.all([api.frotaVeiculos(), api.frotaResumo()]);
      setVeiculos(lista);
      setMeuVeiculo(resumo.veiculo);
      setIdVeiculoAssumir((atual) => {
        if (!atual) return atual;
        const v = lista.find((item) => item.id_veiculo === atual);
        return v?.id_usuario_responsavel == null ? atual : '';
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function aoMudarVeiculo(valor: number | '') {
    setIdVeiculoAssumir(valor);
    setFotoCnh([]);
    setFotosVeiculo([]);
    setEtapa(0);
  }

  function aoMudarKm(valor: string) {
    setKmAssumir(filtrarKmAoDigitar(valor));
  }

  function continuarParaCnh() {
    if (!dadosPreenchidos) return;
    setEtapa(1);
  }

  function aoMudarCnh(fotos: string[]) {
    const next = fotos.slice(0, 1);
    setFotoCnh(next);
    if (next.length > 0) setEtapa(2);
  }

  function voltarAosDados() {
    setEtapa(0);
  }

  function voltarACnh() {
    setEtapa(1);
  }

  function voltarAsFotos() {
    setEtapa(2);
  }

  function finalizarFotos() {
    if (!fotosVeiculoOk) {
      showToast('Tire ao menos uma foto do veículo', 'warning');
      return;
    }
    setEtapa(3);
  }

  async function desassumir(kmAtual: number) {
    if (!meuVeiculo) return;
    setSalvando(true);
    setErro('');
    setOk('');
    try {
      await api.frotaDesassumirVeiculo(kmAtual);
      setMeuVeiculo(null);
      setIdVeiculoAssumir('');
      setKmAssumir('');
      setFotoCnh([]);
      setFotosVeiculo([]);
      setEtapa(0);
      showToast('Carro devolvido com sucesso!', 'success');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao desassumir');
    } finally {
      setSalvando(false);
    }
  }

  async function assumir() {
    if (!podeAssumir) return;
    const km = kmInputParaNumero(kmAssumir);
    if (km == null) {
      setErro('Informe a quilometragem atual');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('id_veiculo', String(idVeiculoAssumir));
      fd.append('km_atual', String(km));
      const cnhBlob = dataUrlToBlob(fotoCnh[0]);
      fd.append('cnh', cnhBlob, `cnh${extensaoMidia(cnhBlob)}`);
      fotosVeiculo.forEach((foto, i) => {
        const blob = dataUrlToBlob(foto);
        fd.append('fotos_veiculo', blob, `veiculo_${i + 1}${extensaoMidia(blob)}`);
      });
      const r = await api.frotaAssumirVeiculo(fd);
      setMeuVeiculo(r.veiculo);
      setIdVeiculoAssumir('');
      setKmAssumir('');
      setFotoCnh([]);
      setFotosVeiculo([]);
      setEtapa(0);
      setOk('Controle do veículo assumido hoje.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao assumir');
    } finally {
      setSalvando(false);
    }
  }

  const passosLabels = ['Dados', 'CNH', 'Fotos', 'OK'];

  if (loading) {
    return (
      <FrotaMobileShell
        titleLine1="Controle"
        sub="Carregando veículos…"
        variant="page"
        onBack={() => navigate('/frota/mobile')}
        temVeiculo={false}
      >
        <LinearProgress
          sx={{
            my: 1.5,
            borderRadius: 1,
            backgroundColor: 'rgba(255,154,92,0.18)',
            '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
          }}
        />
      </FrotaMobileShell>
    );
  }

  return (
    <FrotaMobileShell
      titleLine1="Controle"
      sub={
        meuVeiculo
          ? 'Veículo sob seu controle — devolva quando terminar o uso.'
          : 'Assuma com CNH e fotos do carro, uma etapa de cada vez.'
      }
      variant="page"
      onBack={() => navigate('/frota/mobile')}
      temVeiculo={Boolean(meuVeiculo)}
      metrics={[
        {
          value: meuVeiculo?.placa ?? '—',
          label: 'placa',
          accent: Boolean(meuVeiculo),
        },
        {
          value: veiculosDisponiveis.length,
          label: 'livres',
        },
        {
          value: meuVeiculo ? 'Em uso' : 'Livre',
          label: 'status',
          ok: Boolean(meuVeiculo),
        },
      ]}
    >
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk('')}>
          {ok}
        </Alert>
      )}

      {meuVeiculo ? (
        <FrotaVeiculoControleCard
          veiculo={meuVeiculo}
          salvando={salvando}
          temaEscuro
          onDesassumir={(km) => void desassumir(km)}
        />
      ) : (
        <div className="ck-frota__form-card">
          <Typography sx={{ fontWeight: 800, color: '#f5f5f5', mb: 0.5, fontSize: '1rem' }}>
            Assumir controle do carro
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.82rem', color: '#8d8d8d' }}>
            Preencha veículo e KM, depois anexe a CNH e as fotos do carro.
          </Typography>

          <div className="ck-frota-hub__passos" role="list" aria-label="Etapas">
            {passosLabels.map((label, i) => {
              const feito = etapa === 3 ? true : i < etapa;
              const atual = i === etapa && etapa < 3;
              return (
                <span
                  key={label}
                  role="listitem"
                  className={`ck-frota-hub__passo${feito ? ' is-done' : ''}${atual ? ' is-on' : ''}`}
                >
                  {feito ? (
                    <CheckCircleIcon className="ck-frota-hub__passo-ico" />
                  ) : (
                    <RadioButtonUncheckedIcon className="ck-frota-hub__passo-ico" />
                  )}
                  <span className="ck-frota-hub__passo-label">{label}</span>
                </span>
              );
            })}
          </div>

          {etapa === 0 && (
            <>
              <TextField
                select
                fullWidth
                label="Veículo"
                value={idVeiculoAssumir}
                onChange={(e) => aoMudarVeiculo(Number(e.target.value) || '')}
                sx={{ mb: 2 }}
                slotProps={{
                  inputLabel: labelFixo.inputLabel,
                  select: {
                    displayEmpty: true,
                    renderValue: (selected: unknown) => {
                      if (!selected) {
                        return (
                          <Box component="span" className="ck-frota__ph">
                            {ph.veiculo}
                          </Box>
                        );
                      }
                      const v = veiculosDisponiveis.find((item) => item.id_veiculo === Number(selected));
                      return (
                        <Box className="ck-frota-hub__veiculo-opt" component="span">
                          <DirectionsCarIcon className="ck-frota-hub__veiculo-opt-ico" />
                          <span>{v ? rotuloVeiculoOpcao(v) : String(selected)}</span>
                        </Box>
                      );
                    },
                    MenuProps: {
                      ...selectMenuScrollProps.MenuProps,
                      slotProps: {
                        paper: {
                          className: 'ck-frota-hub__menu',
                          sx: {
                            maxHeight: 320,
                            overflowY: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            bgcolor: '#333840',
                            color: '#f5f5f5',
                            backgroundImage: 'none',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                {veiculosDisponiveis.map((v) => (
                  <MenuItem key={v.id_veiculo} value={v.id_veiculo}>
                    <Box className="ck-frota-hub__veiculo-opt" component="span">
                      <DirectionsCarIcon className="ck-frota-hub__veiculo-opt-ico" />
                      <span>{rotuloVeiculoOpcao(v)}</span>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="Quilometragem atual"
                value={kmAssumir}
                onChange={(e) => aoMudarKm(e.target.value)}
                inputMode="numeric"
                required
                placeholder={ph.km}
                sx={{ mb: 2 }}
                slotProps={{ inputLabel: labelFixo.inputLabel }}
              />

              {dadosPreenchidos ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={continuarParaCnh}
                  className="ck-frota__cta"
                >
                  Continuar
                </Button>
              ) : (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', textAlign: 'center', color: '#8d8d8d' }}
                >
                  Selecione o veículo e informe a quilometragem para continuar.
                </Typography>
              )}
            </>
          )}

          {etapa === 1 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#f5f5f5' }}>
                Foto da CNH
              </Typography>
              <PhotoCaptureMulti
                fotos={fotoCnh}
                onChange={aoMudarCnh}
                max={1}
                inlineActions
                hideCaption
              />
              {!cnhPreenchida && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', textAlign: 'center', mt: 1, color: '#8d8d8d' }}
                >
                  Anexe a foto da CNH para seguir para as fotos do veículo.
                </Typography>
              )}
              <div className="ck-frota__acoes-etapa">
                <Button
                  variant="outlined"
                  disableElevation
                  onClick={voltarAosDados}
                  className="ck-frota__btn-voltar"
                >
                  Voltar
                </Button>
                {cnhPreenchida && (
                  <Button
                    variant="contained"
                    onClick={() => setEtapa(2)}
                    className="ck-frota__cta"
                  >
                    Continuar
                  </Button>
                )}
              </div>
            </Box>
          )}

          {etapa === 2 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#f5f5f5' }}>
                Fotos do veículo
              </Typography>
              <PhotoCaptureMulti
                fotos={fotosVeiculo}
                onChange={setFotosVeiculo}
                max={MAX_FOTOS_VEICULO}
                inlineActions
                thumbColumns={3}
                hideCaption
              />
              <div className="ck-frota__acoes-etapa">
                <Button
                  variant="outlined"
                  disableElevation
                  onClick={voltarACnh}
                  className="ck-frota__btn-voltar"
                >
                  Voltar
                </Button>
                <Button
                  variant="contained"
                  disabled={!fotosVeiculoOk}
                  onClick={finalizarFotos}
                  className="ck-frota__cta"
                >
                  Finalizar{fotosVeiculoOk ? ` (${fotosVeiculo.length})` : ''}
                </Button>
              </div>
            </Box>
          )}

          {etapa === 3 && (
            <>
              <p className="ck-frota-hub__banner is-ok">
                {fotosVeiculo.length} foto{fotosVeiculo.length === 1 ? '' : 's'} do veículo e CNH
                prontas. Confirme a atribuição abaixo.
              </p>
              <div className="ck-frota__acoes-etapa">
                <Button
                  variant="outlined"
                  disableElevation
                  onClick={voltarAsFotos}
                  className="ck-frota__btn-voltar"
                >
                  Voltar
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void assumir()}
                  disabled={salvando || !podeAssumir}
                  className="ck-frota__cta"
                >
                  {salvando ? 'Registrando…' : 'Atribuir'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </FrotaMobileShell>
  );
}
