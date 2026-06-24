import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { api, type Loja } from '../../api/client';
import DialogTitleWithIcon from '../DialogTitleWithIcon';
import LojaMiniMap from './LojaMiniMap';
import { showToast } from '../../utils/toast';
import { buscarCep, cepSomenteDigitos, formatarCepInput } from '../../utils/cep';

type FormLoja = {
  name: string;
  address: string;
  zip_code: string;
  city: string;
  state: string;
  neighborhood: string;
  bk_number: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
};

const FONTE_VALOR_CAMPO = '0.75rem';
const MAPA_ALTURA = 280;
const MAPA_CABECALHO_ALTURA = 36;

const mapaCabecalhoSx = {
  minHeight: MAPA_CABECALHO_ALTURA,
  mb: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  flexShrink: 0,
} as const;

const lojaCampoProps = {
  fullWidth: true,
  size: 'small' as const,
  margin: 'dense' as const,
  slotProps: {
    inputLabel: { shrink: true },
    htmlInput: {
      style: { fontSize: FONTE_VALOR_CAMPO },
    },
  },
};

const campoSomenteLeitura = {
  ...lojaCampoProps,
  slotProps: {
    ...lojaCampoProps.slotProps,
    input: { readOnly: true },
  },
  sx: {
    '& .MuiInputBase-input': {
      bgcolor: 'action.hover',
      cursor: 'default',
    },
  },
};

function lojaParaForm(loja: Loja): FormLoja {
  return {
    name: loja.name || '',
    address: loja.address || '',
    zip_code: loja.zip_code ? formatarCepInput(String(loja.zip_code)) : '',
    city: loja.city || '',
    state: loja.state || '',
    neighborhood: loja.neighborhood || '',
    bk_number: loja.bk_number || '',
    latitude: loja.latitude != null && loja.latitude !== '' ? String(loja.latitude) : '',
    longitude: loja.longitude != null && loja.longitude !== '' ? String(loja.longitude) : '',
    is_active: loja.is_active !== false,
  };
}

function parseCoord(val: string): number | null {
  const n = Number(String(val).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

type Props = {
  open: boolean;
  loja: Loja | null;
  onClose: () => void;
  onSalvo: (loja: Loja) => void;
};

export default function LojaEditDialog({ open, loja, onClose, onSalvo }: Props) {
  const [form, setForm] = useState<FormLoja | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoMapa, setBuscandoMapa] = useState(false);
  const ultimoCepBuscado = useRef('');

  useEffect(() => {
    if (open && loja) {
      setForm(lojaParaForm(loja));
      ultimoCepBuscado.current = cepSomenteDigitos(loja.zip_code || '');
    }
    if (!open) {
      setForm(null);
      ultimoCepBuscado.current = '';
    }
  }, [open, loja]);

  const dialogAberto = open && loja != null && form != null;

  function atualizar(campo: keyof FormLoja, valor: string | boolean) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
  }

  function definirCoordenadas(novaLat: number, novaLng: number) {
    setForm((f) =>
      f
        ? {
            ...f,
            latitude: novaLat.toFixed(6),
            longitude: novaLng.toFixed(6),
          }
        : f,
    );
  }

  async function preencherPorCep(cepFormatado: string) {
    const digits = cepSomenteDigitos(cepFormatado);
    if (digits.length !== 8 || digits === ultimoCepBuscado.current) return;

    ultimoCepBuscado.current = digits;
    setBuscandoCep(true);
    try {
      const dados = await buscarCep(digits);
      if (!dados) {
        showToast('CEP não encontrado', 'warning');
        return;
      }
      setForm((f) =>
        f
          ? {
              ...f,
              zip_code: formatarCepInput(digits),
              address: dados.address || f.address,
              neighborhood: dados.neighborhood || f.neighborhood,
              city: dados.city,
              state: dados.state,
            }
          : f,
      );
    } catch {
      showToast('Erro ao buscar CEP', 'error');
      ultimoCepBuscado.current = '';
    } finally {
      setBuscandoCep(false);
    }
  }

  function onCepChange(valor: string) {
    const formatado = formatarCepInput(valor);
    atualizar('zip_code', formatado);
    const digits = cepSomenteDigitos(formatado);
    if (digits.length < 8) {
      ultimoCepBuscado.current = '';
    }
    if (digits.length === 8) {
      void preencherPorCep(formatado);
    }
  }

  async function localizarPeloEndereco(f: FormLoja) {
    const parts = [f.address, f.neighborhood, f.city, f.state, 'Brasil'].filter(Boolean);
    if (parts.length < 2) {
      showToast('Preencha o CEP ou endereço para localizar no mapa', 'warning');
      return;
    }

    setBuscandoMapa(true);
    try {
      const q = encodeURIComponent(parts.join(', '));
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
        { headers: { 'User-Agent': 'VisionCheck/1.0 (lojas-config)' } },
      );
      if (!res.ok) throw new Error('Serviço de mapa indisponível');
      const data = await res.json();
      if (!data?.[0]) {
        showToast('Endereço não encontrado no mapa', 'warning');
        return;
      }
      definirCoordenadas(Number(data[0].lat), Number(data[0].lon));
      showToast('Localização encontrada pelo endereço');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao localizar', 'error');
    } finally {
      setBuscandoMapa(false);
    }
  }

  async function salvar() {
    if (!form || !loja) return;

    if (!form.name.trim()) {
      showToast('Informe o nome da loja', 'warning');
      return;
    }

    const latitude = parseCoord(form.latitude);
    const longitude = parseCoord(form.longitude);

    if ((form.latitude.trim() || form.longitude.trim()) && (latitude == null || longitude == null)) {
      showToast('Latitude e longitude inválidas', 'warning');
      return;
    }

    setSalvando(true);
    try {
      const atualizada = await api.lojaAtualizar(loja.id_loja, {
        name: form.name.trim(),
        address: form.address.trim() || null,
        zip_code: cepSomenteDigitos(form.zip_code) || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        bk_number: form.bk_number.trim() || null,
        is_active: form.is_active,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });
      showToast('Loja atualizada');
      onSalvo(atualizada);
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  const lat = form ? parseCoord(form.latitude) : null;
  const lng = form ? parseCoord(form.longitude) : null;

  return (
    <Dialog open={dialogAberto} onClose={salvando ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitleWithIcon icon={<EditOutlinedIcon />}>
        Editar loja — {loja?.name}
      </DialogTitleWithIcon>
      <DialogContent dividers>
        {form && (
          <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box sx={{ ...mapaCabecalhoSx, display: { xs: 'none', md: 'flex' } }} aria-hidden />
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    flex: 1,
                    minHeight: { md: MAPA_ALTURA },
                  }}
                >
              <Grid container spacing={1}>
                <Grid size={{ xs: 4, sm: 3 }}>
                  <TextField
                    label="BKN"
                    {...lojaCampoProps}
                    value={form.bk_number}
                    onChange={(e) => atualizar('bk_number', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 8, sm: 9 }}>
                  <TextField
                    label="Nome"
                    {...lojaCampoProps}
                    value={form.name}
                    onChange={(e) => atualizar('name', e.target.value)}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6, sm: 5 }}>
                  <TextField
                    label="CEP"
                    {...lojaCampoProps}
                    value={form.zip_code}
                    onChange={(e) => onCepChange(e.target.value)}
                    placeholder="00000-000"
                    slotProps={{
                      ...lojaCampoProps.slotProps,
                      htmlInput: {
                        ...lojaCampoProps.slotProps.htmlInput,
                        inputMode: 'numeric',
                        maxLength: 9,
                      },
                      ...(buscandoCep
                        ? {
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <CircularProgress size={16} />
                                </InputAdornment>
                              ),
                            },
                          }
                        : {}),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 7 }}>
                  <TextField
                    label="Bairro"
                    {...lojaCampoProps}
                    value={form.neighborhood}
                    onChange={(e) => atualizar('neighborhood', e.target.value)}
                  />
                </Grid>
              </Grid>
              <TextField
                label="Endereço"
                {...lojaCampoProps}
                value={form.address}
                onChange={(e) => atualizar('address', e.target.value)}
                placeholder="Rua, número, complemento"
              />
              <Grid container spacing={1}>
                <Grid size={8}>
                  <TextField
                    label="Cidade"
                    value={form.city}
                    {...campoSomenteLeitura}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    label="UF"
                    value={form.state}
                    {...campoSomenteLeitura}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={1} sx={{ mt: 0.5 }}>
                <Grid size={6}>
                  <TextField
                    label="Latitude"
                    {...lojaCampoProps}
                    value={form.latitude}
                    onChange={(e) => atualizar('latitude', e.target.value)}
                    placeholder="-15.780000"
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Longitude"
                    {...lojaCampoProps}
                    value={form.longitude}
                    onChange={(e) => atualizar('longitude', e.target.value)}
                    placeholder="-47.929000"
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => atualizar('is_active', e.target.checked)}
                  />
                }
                label="Loja ativa"
              />
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={mapaCabecalhoSx}>
                <Typography variant="body2" color="text.secondary">
                  Clique no mapa ou arraste o pin para definir a localização
                </Typography>
                <Button
                  size="small"
                  onClick={() => void localizarPeloEndereco(form)}
                  disabled={buscandoMapa}
                  startIcon={buscandoMapa ? <CircularProgress size={14} /> : undefined}
                >
                  Buscar pelo endereço
                </Button>
              </Box>
              <LojaMiniMap latitude={lat} longitude={lng} onChange={definirCoordenadas} height={MAPA_ALTURA} />
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
