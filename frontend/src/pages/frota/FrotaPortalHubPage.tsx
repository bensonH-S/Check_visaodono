import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import FrotaHubCard from '../../components/frota/FrotaHubCard';

export default function FrotaPortalHubPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Módulos de gestão da frota veicular.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <FrotaHubCard
          titulo="Gestão de veículos"
          descricao="Cadastre, edite e consulte documentos de cada veículo da frota."
          icon={<DirectionsCarIcon />}
          onClick={() => navigate('/frota/veiculos')}
        />
        <FrotaHubCard
          titulo="Uso e assunção"
          descricao="Veja quem assumiu ou está utilizando cada veículo e o histórico de uso."
          icon={<PersonPinCircleIcon />}
          onClick={() => navigate('/frota/uso')}
        />
        <FrotaHubCard
          titulo="Controle de combustível"
          descricao="Acompanhe abastecimentos, valores, KM e comprovantes da frota."
          icon={<LocalGasStationIcon />}
          onClick={() => navigate('/frota/combustivel')}
        />
        <FrotaHubCard
          titulo="Manutenções"
          descricao="Registros de manutenção, revisões e serviços realizados nos veículos."
          icon={<BuildIcon />}
          onClick={() => navigate('/frota/manutencoes')}
        />
      </Box>
    </Box>
  );
}
