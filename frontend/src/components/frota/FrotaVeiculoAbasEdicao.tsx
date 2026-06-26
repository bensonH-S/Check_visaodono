import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import FiltroIntervaloDatasFrota from './FiltroIntervaloDatasFrota';

type Props = {
  aba: number;
  onChangeAba: (aba: number) => void;
  labelDocumentos?: string;
  kmDataInicio: string;
  kmDataFim: string;
  onChangeKmInicio: (value: string) => void;
  onChangeKmFim: (value: string) => void;
  /** Sem padding lateral (página de detalhe). */
  semPadding?: boolean;
};

export default function FrotaVeiculoAbasEdicao({
  aba,
  onChangeAba,
  labelDocumentos = 'Documentos',
  kmDataInicio,
  kmDataFim,
  onChangeKmInicio,
  onChangeKmFim,
  semPadding = false,
}: Props) {
  return (
    <Box
      sx={{
        px: semPadding ? 0 : 3,
        mb: semPadding ? 2 : 0,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 0.5,
        minHeight: 42,
      }}
    >
      <Tabs value={aba} onChange={(_, v) => onChangeAba(v)} sx={{ minHeight: 42, flex: '0 1 auto' }}>
        <Tab label="Dados do veículo" value={0} />
        <Tab label="KM" value={1} />
        <Tab label={labelDocumentos} value={2} />
      </Tabs>

      {aba === 1 && (
        <Box sx={{ pb: 0.65, flexShrink: 0, ml: 0.5 }}>
          <FiltroIntervaloDatasFrota
            compacto
            dataInicio={kmDataInicio}
            dataFim={kmDataFim}
            onChangeInicio={onChangeKmInicio}
            onChangeFim={onChangeKmFim}
          />
        </Box>
      )}
    </Box>
  );
}
