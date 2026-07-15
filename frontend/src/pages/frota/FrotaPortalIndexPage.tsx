import { Navigate } from 'react-router-dom';
import { getUsuario } from '../../lib/auth';
import { primeiraRotaFrota } from './frotaNav';

/** Índice do portal de frota — redireciona para o primeiro módulo disponível. */
export default function FrotaPortalIndexPage() {
  return <Navigate to={primeiraRotaFrota(getUsuario())} replace />;
}
