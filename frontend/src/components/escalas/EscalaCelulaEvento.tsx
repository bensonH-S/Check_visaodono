import { useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { colors } from '../../theme/tokens';
import type { EscalaPlanejamentoTipo } from '../../api/client';
import { TIPOS_PLANEJAMENTO } from './escalaPlanejamentoTipos';

const COR_EVENTO: Record<EscalaPlanejamentoTipo, string> = {
  audiencia: '#7C3AED',
  reuniao: '#2563EB',
  congresso: '#DB2777',
  treinamento: '#059669',
};

type Props = {
  tipos: EscalaPlanejamentoTipo[];
  editavel: boolean;
  onChange?: (tipos: EscalaPlanejamentoTipo[]) => void;
};

export default function EscalaCelulaEvento({ tipos, editavel, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const labels = tipos
    .map((t) => TIPOS_PLANEJAMENTO.find((x) => x.value === t)?.label || t)
    .filter(Boolean);
  const cor =
    tipos.length === 1
      ? COR_EVENTO[tipos[0]]
      : tipos.length > 1
        ? '#7030A0'
        : undefined;
  const tooltip = labels.length
    ? labels.join(', ')
    : editavel
      ? 'Escolher tipo de evento'
      : 'Sem evento';

  function abrir(e: MouseEvent<HTMLElement>) {
    if (!editavel) return;
    setAnchor(e.currentTarget);
  }

  function toggle(tipo: EscalaPlanejamentoTipo) {
    if (!onChange) return;
    onChange(tipos.includes(tipo) ? tipos.filter((t) => t !== tipo) : [...tipos, tipo]);
  }

  return (
    <>
      <Tooltip title={tooltip}>
        <Box
          component={editavel ? 'button' : 'div'}
          type={editavel ? 'button' : undefined}
          onClick={abrir}
          sx={{
            all: editavel ? 'unset' : undefined,
            boxSizing: 'border-box',
            width: '100%',
            py: 0.65,
            px: 0.5,
            borderRadius: 1,
            cursor: editavel ? 'pointer' : 'default',
            bgcolor: cor ? `${cor}44` : 'transparent',
            border: tipos.length ? `1px solid ${cor ?? '#7030A0'}` : '1px dashed #e5e7eb',
            fontSize: '0.72rem',
            fontWeight: 700,
            minHeight: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            color: colors.textPrimary,
            '&:hover': editavel
              ? { boxShadow: `inset 0 0 0 1px ${cor ?? colors.navy}` }
              : undefined,
          }}
        >
          {labels.length ? (
            labels.map((n) => (
              <Box key={n} component="span" sx={{ lineHeight: 1.2 }}>
                {n}
              </Box>
            ))
          ) : (
            <Box component="span" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              {editavel ? '+' : '—'}
            </Box>
          )}
        </Box>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {TIPOS_PLANEJAMENTO.map((t) => (
          <MenuItem key={t.value} dense onClick={() => toggle(t.value)} sx={{ py: 0.35 }}>
            <Checkbox size="small" checked={tipos.includes(t.value)} sx={{ py: 0, mr: 0.5 }} />
            <ListItemText primary={t.label} slotProps={{ primary: { sx: { fontSize: '0.82rem' } } }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
