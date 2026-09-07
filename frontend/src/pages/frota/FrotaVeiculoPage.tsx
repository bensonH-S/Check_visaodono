import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
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
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  const dadosPreenchidos = Boolean(idVeiculoAssumir && kmInputParaNumero(kmAssumir) != null);
  const cnhPreenchida = fotoCnh.length > 0;
  const fotosVeiculoOk = fotosVeiculo.length > 0;
  const podeAssumir = dadosPreenchidos && cnhPreenchida && fotosVeiculoOk;

  const etapaAtiva = !dadosPreenchidos ? 0 : !cnhPreenchida ? 1 : !fotosVeiculoOk ? 2 : 3;

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

  function limparFotosAoAlterarDados() {
    setFotoCnh([]);
    setFotosVeiculo([]);
  }

  function aoMudarVeiculo(valor: number | '') {
    setIdVeiculoAssumir(valor);
    limparFotosAoAlterarDados();
  }

  function aoMudarKm(valor: string) {
    setKmAssumir(filtrarKmAoDigitar(valor));
  }

  function aoMudarCnh(fotos: string[]) {
    setFotoCnh(fotos.slice(0, 1));
    if (!fotos.length) setFotosVeiculo([]);
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
      >
        <LinearProgress />
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
          onDesassumir={(km) => void desassumir(km)}
        />
      ) : (
        <div className="ck-frota__form-card">
          <Typography sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5, fontSize: '1rem' }}>
            Assumir controle do carro
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.82rem' }}>
            Preencha veículo e KM, depois anexe a CNH e as fotos do carro.
          </Typography>

          <div className="ck-visitas__seg" role="list" style={{ marginBottom: 16 }}>
            {passosLabels.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`ck-visitas__seg-btn${i <= etapaAtiva ? ' is-on' : ''}`}
                disabled
                style={{ pointerEvents: 'none', opacity: i <= etapaAtiva ? 1 : 0.55 }}
              >
                {label}
              </button>
            ))}
          </div>

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
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        {ph.veiculo}
                      </Box>
                    );
                  }
                  const v = veiculosDisponiveis.find((item) => item.id_veiculo === Number(selected));
                  return v ? rotuloVeiculoOpcao(v) : String(selected);
                },
                ...selectMenuScrollProps,
              },
            }}
          >
            {veiculosDisponiveis.map((v) => (
              <MenuItem key={v.id_veiculo} value={v.id_veiculo}>
                {rotuloVeiculoOpcao(v)}
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

          {dadosPreenchidos && !cnhPreenchida && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                Foto da CNH
              </Typography>
              <PhotoCaptureMulti
                fotos={fotoCnh}
                onChange={aoMudarCnh}
                max={1}
                inlineActions
                hideCaption
              />
            </Box>
          )}

          {dadosPreenchidos && cnhPreenchida && !fotosVeiculoOk && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
                CNH anexada. Agora tire ao menos uma foto do veículo.
              </Alert>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                Fotos do veículo
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Envie de 1 a {MAX_FOTOS_VEICULO} fotos do carro.
              </Typography>
              <PhotoCaptureMulti
                fotos={fotosVeiculo}
                onChange={setFotosVeiculo}
                max={MAX_FOTOS_VEICULO}
                inlineActions
                thumbColumns={3}
                hideCaption
              />
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setFotoCnh([]);
                  setFotosVeiculo([]);
                }}
                sx={{ mt: 1, color: 'text.secondary' }}
              >
                Alterar foto da CNH
              </Button>
            </Box>
          )}

          {dadosPreenchidos && cnhPreenchida && fotosVeiculoOk && (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              CNH e fotos do veículo prontas. Confirme a atribuição abaixo.
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={() => void assumir()}
            disabled={salvando || !podeAssumir}
            className="ck-frota__cta"
          >
            {salvando ? 'Registrando…' : 'Atribuir veículo'}
          </Button>

          {!podeAssumir && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 1 }}
            >
              {!dadosPreenchidos
                ? 'Selecione o veículo e informe a quilometragem para continuar.'
                : !cnhPreenchida
                  ? 'Anexe a foto da CNH para seguir para as fotos do veículo.'
                  : !fotosVeiculoOk
                    ? 'Anexe ao menos uma foto do veículo para atribuir.'
                    : null}
            </Typography>
          )}
        </div>
      )}
    </FrotaMobileShell>
  );
}
