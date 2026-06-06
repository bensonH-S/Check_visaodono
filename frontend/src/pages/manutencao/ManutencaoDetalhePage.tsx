import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChamadoDetalheConteudo from '../../components/manutencao/ChamadoDetalheConteudo';
import ChamadosSubNav from '../../components/manutencao/ChamadosSubNav';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function ManutencaoDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const id = Number(idChamado);

  usePageTitle('Detalhe do chamado');

  if (!Number.isFinite(id)) {
    navigate('/chamados', { replace: true });
    return null;
  }

  return (
    <Box>
      <ChamadosSubNav />
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/chamados')}
        sx={{ mb: 2 }}
      >
        Voltar
      </Button>
      <ChamadoDetalheConteudo idChamado={id} />
    </Box>
  );
}
