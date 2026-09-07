import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LogoutIcon from '@mui/icons-material/Logout';
import type { FrotaVeiculo } from '../../api/client';
import { filtrarKmAoDigitar, formatarKmInput, kmInputParaNumero, labelFixo, ph, rotuloVeiculoLista } from '../../constants/frotaVeiculo';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

type Props = {
  veiculo: FrotaVeiculo;
  salvando?: boolean;
  onDesassumir?: (kmAtual: number) => void;
  /** Quando false, oculta devolução (atribuição só pelo portal). Default: true. */
  permitirDevolver?: boolean;
};

export default function FrotaVeiculoControleCard({
  veiculo,
  salvando,
  onDesassumir,
  permitirDevolver = true,
}: Props) {
  const kmInputRef = useRef<HTMLInputElement>(null);
  const [mostrarKmDevolucao, setMostrarKmDevolucao] = useState(false);
  const [kmDevolucao, setKmDevolucao] = useState(
    veiculo.km_atual != null ? formatarKmInput(String(veiculo.km_atual)) : '',
  );

  useEffect(() => {
    if (!mostrarKmDevolucao) return;
    const t = window.setTimeout(() => {
      const el = kmInputRef.current;
      if (!el) return;
      el.focus();
      el.select?.();
    }, 80);
    return () => window.clearTimeout(t);
  }, [mostrarKmDevolucao]);

  function abrirDevolucao() {
    setKmDevolucao(veiculo.km_atual != null ? formatarKmInput(String(veiculo.km_atual)) : '');
    setMostrarKmDevolucao(true);
  }

  function devolver() {
    const km = kmInputParaNumero(kmDevolucao);
    if (km == null || !onDesassumir) return;
    onDesassumir(km);
  }

  const kmValido = kmInputParaNumero(kmDevolucao) != null;
  const exibeDevolucao = permitirDevolver && !!onDesassumir;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2.5,
        border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(27, 42, 107, 0.12)',
        borderLeft: (theme) => `4px solid ${theme.palette.mode === 'dark' ? ORANGE : NAVY}`,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#111827' : '#fff',
        boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 6px 20px rgba(27, 42, 107, 0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 88,
          height: 88,
          borderRadius: '50%',
          bgcolor: 'rgba(232, 82, 10, 0.08)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', position: 'relative' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 42, 107, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: ORANGE,
          }}
        >
          <DirectionsCarIcon />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.08em', lineHeight: 1.2, display: 'block' }}
          >
            {exibeDevolucao ? 'Veículo sob seu controle' : 'Seu veículo'}
          </Typography>
          <Typography sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#F8FAFC' : NAVY, fontSize: '1.05rem', lineHeight: 1.3, mt: 0.25 }}>
            {rotuloVeiculoLista(veiculo)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            <Chip label="Em uso" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
            {veiculo.km_atual != null && (
              <Chip
                label={`KM ${veiculo.km_atual.toLocaleString('pt-BR')}`}
                size="small"
                sx={{
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 42, 107, 0.06)',
                  color: (theme) => theme.palette.mode === 'dark' ? '#94A3B8' : NAVY,
                  fontWeight: 600,
                  border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(27, 42, 107, 0.1)',
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {exibeDevolucao && mostrarKmDevolucao && (
        <TextField
          fullWidth
          label="KM na devolução"
          value={kmDevolucao}
          onChange={(e) => setKmDevolucao(filtrarKmAoDigitar(e.target.value))}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          inputRef={kmInputRef}
          required
          placeholder={ph.km}
          sx={{ mt: 2 }}
          slotProps={{
            inputLabel: labelFixo.inputLabel,
            htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' },
          }}
          helperText="Informe a quilometragem atual ao devolver o veículo"
          disabled={salvando}
        />
      )}

      {exibeDevolucao && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
        {mostrarKmDevolucao ? (
          <>
            <Button
              fullWidth
              variant="contained"
              size="medium"
              disabled={salvando || !kmValido}
              onClick={devolver}
              startIcon={<LogoutIcon fontSize="small" />}
              sx={{
                minHeight: 42,
                borderRadius: 2,
                bgcolor: ORANGE,
                fontWeight: 700,
                '&:hover': { bgcolor: '#c94709' },
              }}
            >
              {salvando ? 'Devolvendo veículo…' : 'Confirmar devolução'}
            </Button>
            <Button
              fullWidth
              variant="text"
              size="small"
              disabled={salvando}
              onClick={() => setMostrarKmDevolucao(false)}
              sx={{ color: 'text.secondary' }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            size="medium"
            disabled={salvando}
            onClick={abrirDevolucao}
            startIcon={<LogoutIcon fontSize="small" />}
            sx={{
              minHeight: 42,
              borderRadius: 2,
              borderColor: 'rgba(232, 82, 10, 0.45)',
              color: ORANGE,
              fontWeight: 700,
              bgcolor: 'rgba(232, 82, 10, 0.04)',
              '&:hover': {
                borderColor: ORANGE,
                bgcolor: 'rgba(232, 82, 10, 0.1)',
              },
            }}
          >
            Devolver veículo
          </Button>
        )}
      </Box>
      )}
    </Paper>
  );
}
