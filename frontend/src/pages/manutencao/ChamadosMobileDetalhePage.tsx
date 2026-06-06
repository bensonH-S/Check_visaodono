import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChamadoDetalheConteudo from '../../components/manutencao/ChamadoDetalheConteudo';

export default function ChamadosMobileDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const id = Number(idChamado);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      navigate('/chamados/mobile', { replace: true });
    }
  }, [id, navigate]);

  if (!Number.isFinite(id)) return null;

  return (
    <ChamadoDetalheConteudo
      idChamado={id}
      variante="mobile"
      permitirEncerrar={false}
    />
  );
}
