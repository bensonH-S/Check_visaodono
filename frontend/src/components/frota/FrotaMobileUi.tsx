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
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
  bgcolor: 'rgba(51, 56, 64, 0.92)',
  color: '#f5f5f5',
} as const;

export const frotaCtaSx = {
  minHeight: 52,
  borderRadius: 2.5,
  bgcolor: '#fe6c22',
  color: '#fff',
  fontWeight: 800,
  fontSize: '1rem',
  textTransform: 'none' as const,
  boxShadow: '0 8px 20px rgba(254, 108, 34, 0.35)',
  '&:hover': { bgcolor: '#e55f18' },
  '&.Mui-disabled': {
    bgcolor: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(245, 245, 245, 0.35)',
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
        bgcolor: '#2a3038',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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
              color: ativa ? '#fff' : '#8d8d8d',
              bgcolor: ativa ? '#fe6c22' : 'transparent',
              boxShadow: ativa ? '0 4px 12px rgba(254, 108, 34, 0.3)' : 'none',
              '&:hover': {
                bgcolor: ativa ? '#e55f18' : 'rgba(255, 255, 255, 0.06)',
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
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        mb: 1.5,
        alignItems: 'stretch',
      }}
      role="list"
      aria-label="Etapas"
    >
      {passos.map((p) => (
        <Box
          key={p.label}
          role="listitem"
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            py: 0.45,
            px: 0.75,
            minHeight: 28,
            borderRadius: 1.5,
            bgcolor: p.ok ? 'rgba(34, 197, 94, 0.14)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${p.ok ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
          }}
        >
          {p.ok ? (
            <CheckCircleIcon sx={{ fontSize: 15, color: '#86efac', flexShrink: 0 }} />
          ) : (
            <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: '#8d8d8d', flexShrink: 0 }} />
          )}
          <Typography
            component="span"
            sx={{
              fontWeight: p.ok ? 700 : 600,
              color: p.ok ? '#86efac' : '#8d8d8d',
              lineHeight: 1,
              fontSize: '0.68rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderLeft: `4px solid ${accent}`,
        bgcolor: 'rgba(51, 56, 64, 0.92)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
        color: '#f5f5f5',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.08)',
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
          <Typography sx={{ fontWeight: 800, color: '#f5f5f5', lineHeight: 1.25, fontSize: '0.95rem' }}>
            {rotuloVeiculoLista(veiculo)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.6 }}>
            <Chip
              label="Em uso"
              size="small"
              variant="filled"
              className="ck-frota-hub__em-uso"
              sx={{
                height: 22,
                fontWeight: 700,
                fontSize: '0.7rem',
                color: '#86efac',
                bgcolor: 'rgba(34, 197, 94, 0.18)',
                border: '1px solid rgba(134, 239, 172, 0.55)',
                '& .MuiChip-label': { color: '#86efac', px: 1 },
              }}
            />
            {veiculo.km_atual != null && (
              <Chip
                label={`${veiculo.km_atual.toLocaleString('pt-BR')} km`}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  color: '#8d8d8d',
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
                  bgcolor: 'rgba(254, 108, 34, 0.16)',
                  color: '#ff9a5c',
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
          bgcolor: 'rgba(254, 108, 34, 0.16)',
          color: '#fe6c22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 1.5,
        }}
      >
        <DirectionsCarIcon sx={{ fontSize: 32 }} />
      </Box>
      <Typography sx={{ fontWeight: 800, color: '#f5f5f5', mb: 0.75 }}>
        Sem veículo atribuído
      </Typography>
      <Typography variant="body2" sx={{ mb: onVerHistorico ? 2 : 0, color: '#8d8d8d' }}>
        Peça ao responsável para atribuir o veículo pelo portal.
        {onVerHistorico ? ' Enquanto isso, você pode consultar o histórico.' : ''}
      </Typography>
      {onVerHistorico && (
        <Button
          type="button"
          variant="outlined"
          onClick={onVerHistorico}
          startIcon={<HistoryIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#fe6c22', color: '#ff9a5c' }}
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
        <Typography sx={{ fontWeight: 800, color: '#f5f5f5', lineHeight: 1.2 }}>{titulo}</Typography>
        <Typography variant="caption" sx={{ color: '#8d8d8d' }}>
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
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f5f5f5', lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" sx={{ color: '#8d8d8d' }}>
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
        border: '1px solid rgba(255, 255, 255, 0.1)',
        bgcolor: 'rgba(51, 56, 64, 0.92)',
        color: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#8d8d8d !important' }}>
          {titulo}
        </Typography>
        <Typography sx={{ fontWeight: 800, color: '#f5f5f5 !important', fontSize: '1.05rem' }}>
          {quantidade} registro{quantidade === 1 ? '' : 's'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#8d8d8d !important' }}>
          {totalLabel}
        </Typography>
        <Typography sx={{ fontWeight: 800, color: '#ff9a5c !important', fontSize: '1.05rem' }}>
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
        border: '1px dashed rgba(255, 255, 255, 0.2)',
        bgcolor: 'rgba(255, 255, 255, 0.04)',
        color: '#f5f5f5',
      }}
    >
      <HistoryIcon sx={{ fontSize: 40, color: 'rgba(245, 245, 245, 0.35)', mb: 1 }} />
      <Typography sx={{ fontWeight: 800, color: '#f5f5f5 !important', mb: 0.5 }}>
        Nada por aqui ainda
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: '#8d8d8d !important' }}>
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
          bgcolor: '#fe6c22',
          '&:hover': { bgcolor: '#e55f18' },
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
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderLeft: '4px solid #fe6c22',
        bgcolor: 'rgba(51, 56, 64, 0.92)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
        color: '#f5f5f5',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: '#f5f5f5 !important', lineHeight: 1.25 }}>
            {titulo}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: '#8d8d8d !important',
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
                  color: c.destaque ? '#ff9a5c !important' : '#cfcfcf !important',
                  bgcolor: c.destaque ? 'rgba(254, 108, 34, 0.16)' : 'rgba(255, 255, 255, 0.08)',
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
              color: '#fe6c22',
              bgcolor: 'rgba(254, 108, 34, 0.12)',
              '&:hover': { bgcolor: 'rgba(254, 108, 34, 0.2)' },
            }}
          >
            <ImageOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}
