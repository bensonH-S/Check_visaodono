import { Navigate } from 'react-router-dom';

/** Desktop: registro abre como modal em /energia. */
export default function EnergiaNovoPage() {
  return <Navigate to="/energia" replace state={{ abrirNovo: true }} />;
}
