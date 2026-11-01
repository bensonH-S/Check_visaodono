import { useState } from 'react';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import { DIAS_ABREV, DIAS_LONGO, rotuloFolgaDias } from './escalaVisitasUtils';
import { colors, radius, shadows } from '../../theme/tokens';

type Props = {
  dias: number[];
  rotuloExtra?: string | null;
  onChange: (dias: number[]) => void;
  disabled?: boolean;
};

export default function FolgasSemanaCampo({ dias, rotuloExtra, onChange, disabled }: Props) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const marcados = [...new Set(dias.filter((dia) => dia >= 0 && dia <= 6))].sort((a, b) => a - b);
  const rotulo = rotuloFolgaDias(marcados) || rotuloExtra || '—';

  function alternar(dia: number) {
    const set = new Set(marcados);
    if (set.has(dia)) set.delete(dia);
    else set.add(dia);
    onChange([...set].sort((a, b) => a - b));
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        disabled={disabled}
        onClick={(e) => setAncora(e.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          maxWidth: '100%',
          m: 0,
          p: 0,
          border: 0,
          background: 'transparent',
          color: colors.textPrimary,
          font: 'inherit',
          fontSize: '0.8rem',
          fontWeight: 700,
          lineHeight: 1.2,
          cursor: disabled ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rotulo}
        </Box>
        <Box component="span" aria-hidden sx={{ color: colors.textMuted, fontSize: 10, lineHeight: 1 }}>
          ▾
        </Box>
      </Box>
      <Popover
        open={Boolean(ancora)}
        anchorEl={ancora}
        onClose={() => setAncora(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              p: 1.25,
              width: 248,
              borderRadius: `${radius.lg}px`,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.cardHover,
              bgcolor: colors.surface,
            },
          },
        }}
      >
        <Box sx={{ mb: 1, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: colors.textMuted }}>
          FOLGAS DA SEMANA
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
          {DIAS_ABREV.map((nome, dia) => {
            const ativo = marcados.includes(dia);
            return (
              <Box
                key={nome}
                component="button"
                type="button"
                aria-pressed={ativo}
                title={DIAS_LONGO[dia]}
                onClick={() => alternar(dia)}
                sx={{
                  gridColumn: dia > 3 ? 'span 1' : undefined,
                  m: 0,
                  minHeight: 36,
                  borderRadius: `${radius.md}px`,
                  border: '1px solid',
                  borderColor: ativo ? '#0548d1' : colors.border,
                  background: ativo ? '#0548d1' : 'transparent',
                  color: ativo ? '#fff' : colors.textPrimary,
                  font: 'inherit',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {nome}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
