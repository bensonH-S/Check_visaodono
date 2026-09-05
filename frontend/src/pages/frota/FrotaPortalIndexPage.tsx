import { Navigate, useLocation } from 'react-router-dom';
import { getUsuario } from '../../lib/auth';
import { primeiraRotaFrota } from './frotaNav';

/** Índice do portal de frota — redireciona para o primeiro módulo disponível preservando query params. */
export default function FrotaPortalIndexPage() {
  const location = useLocation();
  return <Navigate to={`${primeiraRotaFrota(getUsuario())}${location.search}`} replace />;
}
