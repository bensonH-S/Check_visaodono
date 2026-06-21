import { Navigate } from 'react-router-dom';
import { getUsuario } from '../../lib/auth';
import { primeiraRotaConfig } from './configNav';

/** Índice de configurações — redireciona para o primeiro módulo disponível. */
export default function ConfiguracoesPage() {
  return <Navigate to={primeiraRotaConfig(getUsuario())} replace />;
}
