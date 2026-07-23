import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeAprovarFreelancers } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = { children: ReactNode };

/** Rota mobile: regional (freelancers.aprovar) ou TI/diretor/dono (todas as lojas). */
export default function RotaFreelancersAprovacao({ children }: Props) {
  const user = getUsuario();
  if (!podeAprovarFreelancers(user)) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
