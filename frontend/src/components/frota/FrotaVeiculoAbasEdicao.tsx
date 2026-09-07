import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import FiltroIntervaloDatasFrota from './FiltroIntervaloDatasFrota';
import { useAppTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/tokens';

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
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : colors.navy;

  return (
    <Box
      sx={{
        px: semPadding ? 0 : 3,
        mb: semPadding ? 2 : 0,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >
      <Tabs
        value={aba}
        onChange={(_, v) => onChangeAba(v)}
        variant="standard"
        scrollButtons={false}
        sx={{
          minHeight: 42,
          flex: '1 1 auto',
          minWidth: 0,
          '& .MuiTab-root': {
            minHeight: 42,
            minWidth: 'auto',
            px: 1.5,
            textTransform: 'none',
            color: colors.textSecondary,
          },
          '& .Mui-selected': { color: `${acento} !important` },
          '& .MuiTabs-indicator': { backgroundColor: acento },
        }}
      >
        <Tab label="Dados do veículo" value={0} />
        <Tab label="KM" value={1} />
        <Tab label={labelDocumentos} value={2} />
      </Tabs>

      {aba === 1 && (
        <Box
          sx={{
            pb: 0.65,
            flex: '0 0 auto',
            width: 300,
          }}
        >
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
