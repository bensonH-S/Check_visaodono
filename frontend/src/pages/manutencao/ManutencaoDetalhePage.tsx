import { useNavigate, useParams } from 'react-router-dom';
import ChamadoDetalheConteudo from '../../components/manutencao/ChamadoDetalheConteudo';
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
    <ChamadoDetalheConteudo
      idChamado={id}
      onVoltar={() => navigate('/chamados')}
    />
  );
}
