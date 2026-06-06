import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { getUsuario, temPermissao } from '../../lib/auth';

export default function ChamadosSubNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUsuario();
  const podeChamados = temPermissao('chamados.ver', user);
  const podeAprovar = temPermissao('chamados.aprovar', user);

  if (!podeChamados && !podeAprovar) return null;

  const emAprovacoes = location.pathname.startsWith('/chamados/aprovacoes');
  const valor = emAprovacoes || !podeChamados ? 'aprovacoes' : 'chamados';

  function onChange(_: unknown, v: string) {
    if (v === 'aprovacoes') navigate('/chamados/aprovacoes');
    else if (podeChamados) navigate('/chamados');
  }

  return (
    <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={valor} onChange={onChange} variant="scrollable" scrollButtons="auto">
        {podeChamados && <Tab value="chamados" label="Chamados" />}
        {podeAprovar && <Tab value="aprovacoes" label="Aprovações" />}
      </Tabs>
    </Box>
  );
}
