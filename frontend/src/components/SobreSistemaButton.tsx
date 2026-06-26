import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { colors } from '../theme/tokens';
import SobreSistemaDialog from './SobreSistemaDialog';

type Props = {
  variante?: 'mobile' | 'portal';
};

export default function SobreSistemaButton({ variante = 'portal' }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Sobre o sistema"
        onClick={() => setAberto(true)}
        sx={{ color: variante === 'mobile' ? colors.navy : colors.textSecondary }}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>

      <SobreSistemaDialog open={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
