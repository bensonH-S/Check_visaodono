import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Coluna estreita só em telas pequenas; a partir de md usa a largura disponível.
 * Preferir breakpoints de viewport em vez de user-agent — funciona ao redimensionar a janela.
 */
export const portalContentSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: { xs: 480, sm: 640, md: 'none' },
  mx: { xs: 'auto', md: 0 },
};

/** Detalhe de chamado / aprovação no portal (não confundir com rota /chamados/mobile). */
export function detalheChamadoSx(variante: 'desktop' | 'mobile' = 'desktop'): SxProps<Theme> {
  if (variante === 'mobile') {
    return { width: '100%', maxWidth: 480, mx: 'auto' };
  }
  return portalContentSx;
}
