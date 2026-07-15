import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { api, type FrotaVeiculo } from '../../api/client';
import FrotaVeiculosKmSemanaPanel, { periodoSemanaAtualKm } from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { rotuloVeiculoOpcao } from '../../constants/frotaVeiculo';
import { tablePageLayoutSx } from '../../utils/tablePageLayout';

export default function FrotaRelatorioKmPage() {
  const semana = periodoSemanaAtualKm();
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [kmDataInicio, setKmDataInicio] = useState(semana.inicio);
  const [kmDataFim, setKmDataFim] = useState(semana.fim);

  useEffect(() => {
    api
      .frotaVeiculos()
      .then(setVeiculos)
      .catch(() => setVeiculos([]));
  }, []);

  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
    [veiculos],
  );

  return (
    <Box sx={tablePageLayoutSx}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1.5,
          flexShrink: 0,
          flexWrap: 'wrap',
          pt: 0.5,
          pb: 0.25,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160, pb: 1 }}>
          Relatório de KM apontado no sistema
        </Typography>
        <Autocomplete
          options={veiculosOrdenados}
          value={veiculoSel}
          onChange={(_, v) => setVeiculoSel(v)}
          getOptionLabel={(v) => rotuloVeiculoOpcao(v)}
          isOptionEqualToValue={(a, b) => a.id_veiculo === b.id_veiculo}
          sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
          renderInput={(params) => (
            <TextField {...params} label="Veículo" size="small" placeholder="Todos" />
          )}
        />
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
        somenteApontado
        idVeiculoFiltro={veiculoSel?.id_veiculo ?? null}
        dataInicio={kmDataInicio}
        dataFim={kmDataFim}
        onChangeInicio={setKmDataInicio}
        onChangeFim={setKmDataFim}
      />
    </Box>
  );
}
