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
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'flex-end' },
        gap: { xs: 0.5, md: 0.75 },
        flexWrap: 'wrap',
      }}
    >
      <Tabs
        value={aba}
        onChange={(_, v) => onChangeAba(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 42,
          flex: '1 1 auto',
          minWidth: 0,
          maxWidth: { md: 'calc(100% - 240px)' },
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
            flexShrink: 0,
            width: { xs: '100%', md: 'auto' },
            minWidth: { md: 220 },
            maxWidth: { xs: '100%', md: 280 },
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
