import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import type { FrotaVeiculo } from '../../api/client';
import { rotuloVeiculoLista } from '../../constants/frotaVeiculo';

export const FROTA_NAVY = '#1B2A6B';
export const FROTA_ORANGE = '#E8520A';

export const frotaCardSx = {
  p: 2,
  borderRadius: 2.5,
  border: (theme: any) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(27, 42, 107, 0.1)',
  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 6px 20px rgba(0, 0, 0, 0.35)' : '0 6px 20px rgba(27, 42, 107, 0.07)',
  bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#111827' : '#fff',
} as const;

export const frotaCtaSx = {
  minHeight: 52,
  borderRadius: 2.5,
  bgcolor: (theme: any) => theme.palette.mode === 'dark' ? FROTA_ORANGE : FROTA_NAVY,
  fontWeight: 800,
  fontSize: '1rem',
  textTransform: 'none' as const,
  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 8px 20px rgba(232, 82, 10, 0.35)' : '0 8px 20px rgba(27, 42, 107, 0.3)',
  '&:hover': { bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#c94709' : '#152056' },
  '&.Mui-disabled': {
    bgcolor: 'rgba(27, 42, 107, 0.12)',
    color: 'rgba(27, 42, 107, 0.4)',
  },
};

export function FrotaSegControl<T extends string>({
  valor,
  onChange,
  itens,
}: {
  valor: T;
  onChange: (v: T) => void;
  itens: { id: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        p: 0.5,
        mb: 1.5,
        borderRadius: 2.5,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#111827' : 'rgba(27, 42, 107, 0.06)',
        border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(27, 42, 107, 0.08)',
      }}
    >
      {itens.map((item) => {
        const ativa = valor === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            startIcon={item.icon}
            sx={{
              flex: 1,
              minHeight: 42,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: ativa ? '#fff' : (theme) => theme.palette.mode === 'dark' ? '#94A3B8' : FROTA_NAVY,
              bgcolor: ativa
                ? (theme) => theme.palette.mode === 'dark' ? FROTA_ORANGE : FROTA_NAVY
                : 'transparent',
              boxShadow: ativa
                ? (theme) => theme.palette.mode === 'dark' ? '0 4px 12px rgba(232, 82, 10, 0.3)' : '0 4px 12px rgba(27, 42, 107, 0.3)'
                : 'none',
              '&:hover': {
                bgcolor: ativa
                  ? (theme) => theme.palette.mode === 'dark' ? '#c94709' : '#152056'
                  : 'rgba(27, 42, 107, 0.06)',
              },
              '& .MuiButton-startIcon': { mr: item.icon ? 0.75 : 0 },
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </Box>
  );
}

export function FrotaPassos({
  passos,
}: {
  passos: { ok: boolean; label: string }[];
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      {passos.map((p) => (
        <Box
          key={p.label}
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
            bgcolor: p.ok ? 'rgba(46, 125, 50, 0.08)' : 'rgba(27, 42, 107, 0.04)',
            border: `1px solid ${p.ok ? 'rgba(46, 125, 50, 0.25)' : 'rgba(27, 42, 107, 0.08)'}`,
          }}
        >
          {p.ok ? (
            <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
          ) : (
            <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
          )}
          <Typography
            variant="caption"
            sx={{
              fontWeight: p.ok ? 700 : 500,
              color: p.ok ? 'success.dark' : 'text.secondary',
              textAlign: 'center',
              lineHeight: 1.2,
              fontSize: '0.65rem',
            }}
          >
            {p.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Faixa compacta do veículo — menos altura que o card de controle completo. */
export function FrotaVeiculoFaixa({
  veiculo,
  accent = FROTA_ORANGE,
  extra,
}: {
  veiculo: FrotaVeiculo;
  accent?: string;
  extra?: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: 2.5,
        border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(27, 42, 107, 0.1)',
        borderLeft: `4px solid ${accent}`,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#111827' : '#fff',
        boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 14px rgba(0, 0, 0, 0.35)' : '0 4px 14px rgba(27, 42, 107, 0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 42, 107, 0.08)',
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <DirectionsCarIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#F8FAFC' : FROTA_NAVY, lineHeight: 1.25, fontSize: '0.95rem' }}>
            {rotuloVeiculoLista(veiculo)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.6 }}>
            <Chip
              label="Em uso"
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem' }}
            />
            {veiculo.km_atual != null && (
              <Chip
                label={`${veiculo.km_atual.toLocaleString('pt-BR')} km`}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 42, 107, 0.06)',
                  color: (theme) => theme.palette.mode === 'dark' ? '#94A3B8' : FROTA_NAVY,
                }}
              />
            )}
            {veiculo.proxima_manutencao_km != null && (
              <Chip
                label={`Próx. ${veiculo.proxima_manutencao_km.toLocaleString('pt-BR')} km`}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(232, 82, 10, 0.08)',
                  color: FROTA_ORANGE,
                }}
              />
            )}
          </Box>
          {extra}
        </Box>
      </Box>
    </Paper>
  );
}

export function FrotaEmptyVeiculo({
  onVerHistorico,
}: {
  onVerHistorico?: () => void;
}) {
  return (
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
          color: FROTA_ORANGE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 1.5,
        }}
      >
        <DirectionsCarIcon sx={{ fontSize: 32 }} />
      </Box>
      <Typography sx={{ fontWeight: 800, color: FROTA_NAVY, mb: 0.75 }}>
        Sem veículo atribuído
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: onVerHistorico ? 2 : 0 }}>
        Peça ao responsável para atribuir o veículo pelo portal.
        {onVerHistorico ? ' Enquanto isso, você pode consultar o histórico.' : ''}
      </Typography>
      {onVerHistorico && (
        <Button
          type="button"
          variant="outlined"
          onClick={onVerHistorico}
          startIcon={<HistoryIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderColor: FROTA_ORANGE, color: FROTA_ORANGE }}
        >
          Ver histórico
        </Button>
      )}
    </Paper>
  );
}

export function FrotaFormHeader({
  icon,
  titulo,
  subtitulo,
}: {
  icon: ReactNode;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: 'rgba(232, 82, 10, 0.1)',
          color: FROTA_ORANGE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, color: FROTA_NAVY, lineHeight: 1.2 }}>{titulo}</Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitulo}
        </Typography>
      </Box>
    </Box>
  );
}

export function FrotaSecaoFoto({
  ok,
  titulo,
  dica,
  icon,
  children,
}: {
  ok: boolean;
  titulo: string;
  dica: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: `1px dashed ${ok ? 'rgba(46, 125, 50, 0.4)' : 'rgba(232, 82, 10, 0.35)'}`,
        bgcolor: ok ? 'rgba(46, 125, 50, 0.04)' : 'rgba(232, 82, 10, 0.03)',
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {icon && (
          <Box sx={{ color: ok ? 'success.main' : FROTA_ORANGE, display: 'flex' }}>{icon}</Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: FROTA_NAVY, lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {dica}
          </Typography>
        </Box>
      </Box>
      {children}
    </Box>
  );
}

export function FrotaResumoHistorico({
  titulo,
  quantidade,
  totalLabel,
  totalValor,
}: {
  titulo: string;
  quantidade: number;
  totalLabel: string;
  totalValor: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.75,
        mb: 1.5,
        borderRadius: 2.5,
        border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(27, 42, 107, 0.1)',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#111827' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {titulo}
        </Typography>
        <Typography sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#F8FAFC' : FROTA_NAVY, fontSize: '1.05rem' }}>
          {quantidade} registro{quantidade === 1 ? '' : 's'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {totalLabel}
        </Typography>
        <Typography sx={{ fontWeight: 800, color: FROTA_ORANGE, fontSize: '1.05rem' }}>
          {totalValor}
        </Typography>
      </Box>
    </Paper>
  );
}

export function FrotaEmptyHistorico({
  mensagem,
  onRegistrar,
}: {
  mensagem: string;
  onRegistrar: () => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        textAlign: 'center',
        borderRadius: 3,
        border: (theme) => theme.palette.mode === 'dark' ? '1px dashed rgba(255, 255, 255, 0.2)' : '1px dashed rgba(27, 42, 107, 0.2)',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(27, 42, 107, 0.03)',
      }}
    >
      <HistoryIcon sx={{ fontSize: 40, color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(27, 42, 107, 0.35)', mb: 1 }} />
      <Typography sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#F8FAFC' : FROTA_NAVY, mb: 0.5 }}>Nada por aqui ainda</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {mensagem}
      </Typography>
      <Button
        type="button"
        variant="contained"
        onClick={onRegistrar}
        startIcon={<AddIcon />}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          bgcolor: FROTA_ORANGE,
          '&:hover': { bgcolor: '#c94709' },
        }}
      >
        Registrar agora
      </Button>
    </Paper>
  );
}

export function FrotaHistoricoItem({
  titulo,
  subtitulo,
  chips,
  onAbrirAnexo,
  abrindo,
  temAnexo,
}: {
  titulo: string;
  subtitulo: string;
  chips: { label: string; destaque?: boolean }[];
  onAbrirAnexo?: () => void;
  abrindo?: boolean;
  temAnexo?: boolean;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.75,
        mb: 1.25,
        borderRadius: 2.5,
        border: (theme) => theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(27, 42, 107, 0.1)',
        borderLeft: `4px solid ${FROTA_ORANGE}`,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#111827' : '#fff',
        boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 14px rgba(0, 0, 0, 0.35)' : '0 4px 14px rgba(27, 42, 107, 0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#F8FAFC' : FROTA_NAVY, lineHeight: 1.25 }}>{titulo}</Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {subtitulo}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {chips.map((c) => (
              <Typography
                key={c.label}
                variant="caption"
                sx={{
                  fontWeight: c.destaque ? 800 : 700,
                  color: c.destaque ? FROTA_ORANGE : (theme) => theme.palette.mode === 'dark' ? '#94A3B8' : FROTA_NAVY,
                  bgcolor: c.destaque ? 'rgba(232, 82, 10, 0.12)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 42, 107, 0.06)',
                  px: 1,
                  py: 0.35,
                  borderRadius: 1,
                }}
              >
                {c.label}
              </Typography>
            ))}
          </Box>
        </Box>
        {temAnexo && onAbrirAnexo && (
          <IconButton
            type="button"
            size="small"
            aria-label="Ver anexo"
            disabled={abrindo}
            onClick={onAbrirAnexo}
            sx={{
              color: FROTA_ORANGE,
              bgcolor: 'rgba(232, 82, 10, 0.08)',
              '&:hover': { bgcolor: 'rgba(232, 82, 10, 0.16)' },
            }}
          >
            <ImageOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}
