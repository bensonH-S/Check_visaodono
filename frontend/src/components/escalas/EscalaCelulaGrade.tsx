import { useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { colors } from '../../theme/tokens';
import { primeiroNome } from './escalaVisitasUtils';

const COR_MULTI = '#7030A0';

type Opcao = { id_usuario: number; nome: string };

type Props = {
  ids: number[];
  mapNome: Map<number, string>;
  mapCor: Map<number, string>;
  opcoes: Opcao[];
  editavel: boolean;
  onChange?: (ids: number[]) => void;
};

export default function EscalaCelulaGrade({ ids, mapNome, mapCor, opcoes, editavel, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const nomes = ids
    .map((id) => mapNome.get(id))
    .filter(Boolean)
    .map((n) => primeiroNome(n!));
  const cor = ids.length === 1 ? mapCor.get(ids[0]) || '#64748B' : ids.length > 1 ? COR_MULTI : undefined;
  const tooltip = nomes.length ? nomes.join(', ') : editavel ? 'Atribuir visita' : 'Sem visita';

  function abrir(e: MouseEvent<HTMLElement>) {
    if (!editavel) return;
    setAnchor(e.currentTarget);
  }

  function toggle(id: number) {
    if (!onChange) return;
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
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
            border: ids.length ? `1px solid ${cor ?? COR_MULTI}` : '1px dashed #e5e7eb',
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
          {nomes.length ? (
            nomes.map((n) => (
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
        {opcoes.map((r) => (
          <MenuItem key={r.id_usuario} dense onClick={() => toggle(r.id_usuario)} sx={{ py: 0.35 }}>
            <Checkbox size="small" checked={ids.includes(r.id_usuario)} sx={{ py: 0, mr: 0.5 }} />
            <ListItemText primary={r.nome} slotProps={{ primary: { sx: { fontSize: '0.82rem' } } }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
