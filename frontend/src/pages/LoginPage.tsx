import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { assetUrl, LOGO_GRUPO_ALVIM } from '../config/paths';
import { api } from '../api/client';
import { setSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  usePageTitle('Entrar');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.login(email.trim(), senha);
      setSessao(data.accessToken, data.usuario);
      navigate(from, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="min-h-screen flex flex-col md:flex-row">
      <Box
        className="md:w-[42%] flex items-center justify-center p-8 md:p-12"
        sx={{
          background: 'linear-gradient(145deg, #1B2A6B 0%, #243580 55%, #1B2A6B 100%)',
          color: 'white',
        }}
      >
        <Box className="max-w-md">
          <Box
            component="img"
            src={assetUrl(LOGO_GRUPO_ALVIM)}
            alt="Grupo Alvim"
            sx={{ width: '100%', maxWidth: 220, mb: 3, filter: 'brightness(0) invert(1)' }}
          />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
            Portal Grupo Alvim
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, lineHeight: 1.6 }}>
            Um só lugar para checklist em loja, chamados de manutenção e visão operacional das
            unidades Burger King.
          </Typography>
        </Box>
      </Box>

      <Box className="flex-1 flex items-center justify-center p-6 bg-[#f5f5f3]">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Entrar no sistema
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use seu e-mail corporativo.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <TextField
              label="E-mail"
              type="email"
              required
              fullWidth
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.nome@grupoalvim.com.br"
            />
            <TextField
              label="Senha"
              type="password"
              required
              fullWidth
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            {erro && <Alert severity="error">{erro}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 1 }}>
              {loading ? 'Entrando...' : 'Acessar portal'}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Dev: admin@grupoalvim.com.br · senha Alvim@2026
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
