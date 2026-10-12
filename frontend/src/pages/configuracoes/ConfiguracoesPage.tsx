import { Navigate } from 'react-router-dom';
import { getUsuario } from '../../lib/auth';
import { primeiraRotaConfig } from './configNav';

/** Índice — abre o primeiro ajuste disponível. */
export default function ConfiguracoesPage() {
  return <Navigate to={primeiraRotaConfig(getUsuario())} replace />;
}
