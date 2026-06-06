import { useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ChamadoDetalheConteudo from '../../components/manutencao/ChamadoDetalheConteudo';
import type { ManutChamadoDetalhe } from '../../api/client';

type DetalheOutletContext = {
  setDetalheTitulo: (titulo: string) => void;
};

export default function ChamadosMobileDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const { setDetalheTitulo } = useOutletContext<DetalheOutletContext>();
  const id = Number(idChamado);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      navigate('/chamados/mobile', { replace: true });
    }
  }, [id, navigate]);

  function onDetalheCarregado(detalhe: ManutChamadoDetalhe) {
    const tituloCurto =
      detalhe.titulo.length > 28 ? `${detalhe.titulo.slice(0, 28)}…` : detalhe.titulo;
    setDetalheTitulo(`#${detalhe.numero} · ${tituloCurto}`);
  }

  useEffect(() => () => setDetalheTitulo(''), [setDetalheTitulo]);

  if (!Number.isFinite(id)) return null;

  return (
    <ChamadoDetalheConteudo
      idChamado={id}
      onDetalheCarregado={onDetalheCarregado}
      variante="mobile"
      permitirEncerrar={false}
    />
  );
}
