import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AprovacaoOrcamentoDetalhe from '../../components/manutencao/AprovacaoOrcamentoDetalhe';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function ManutencaoAprovacaoDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const id = Number(idChamado);

  usePageTitle('Aprovar orçamento');

  if (!Number.isFinite(id)) {
    navigate('/chamados/aprovacoes', { replace: true });
    return null;
  }

  return (
    <Box>
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/chamados/aprovacoes')}
        sx={{ mb: 2 }}
      >
        Voltar às aprovações
      </Button>
      <AprovacaoOrcamentoDetalhe
        idChamado={id}
        onConcluido={() => navigate('/chamados/aprovacoes')}
      />
    </Box>
  );
}
