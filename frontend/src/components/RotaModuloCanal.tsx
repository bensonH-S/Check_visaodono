import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, primeiraRotaMobileApp } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';
import { moduloNoCanal, type CanalApp, type ModuloCanalCodigo } from '../config/modulosCanal';
import { useAppConfig } from '../hooks/useAppConfig';

type Props = {
  codigo: ModuloCanalCodigo;
  canal: CanalApp;
  children: ReactNode;
};

export default function RotaModuloCanal({ codigo, canal, children }: Props) {
  const { modulos } = useAppConfig();
  if (moduloNoCanal(modulos, codigo, canal)) return <>{children}</>;
  const user = getUsuario();
  const destino =
    canal === 'mobile' && user ? primeiraRotaMobileApp(user) : primeiraRotaPermitida(user);
  return <Navigate to={destino} replace />;
}
