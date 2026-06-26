import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FrotaVeiculosKmSemanaPanel, { periodoSemanaAtualKm } from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { tablePageLayoutSx } from '../../utils/tablePageLayout';

export default function FrotaRelatorioKmPage() {
  const navigate = useNavigate();
  const semana = periodoSemanaAtualKm();
  const [kmDataInicio, setKmDataInicio] = useState(semana.inicio);
  const [kmDataFim, setKmDataFim] = useState(semana.fim);

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0, pt: 0.5, pb: 0.25 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar" sx={{ mb: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, pb: 1 }}>
          Relatório de KM da frota
        </Typography>
        <Box sx={{ flexShrink: 0 }}>
          <FiltroIntervaloDatasFrota
            dataInicio={kmDataInicio}
            dataFim={kmDataFim}
            onChangeInicio={setKmDataInicio}
            onChangeFim={setKmDataFim}
          />
        </Box>
      </Box>

      <FrotaVeiculosKmSemanaPanel
        ativo
        ocultarFiltro
        dataInicio={kmDataInicio}
        dataFim={kmDataFim}
        onChangeInicio={setKmDataInicio}
        onChangeFim={setKmDataFim}
      />
    </Box>
  );
}
