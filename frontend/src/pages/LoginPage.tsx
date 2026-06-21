import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import BrandLogo from '../components/BrandLogo';
import AppFooter from '../components/AppFooter';
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { setSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';
import { colors, radius, shadows } from '../theme/tokens';
import { APP_NAME, APP_TAGLINE } from '../config/brand';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = normalizeAppRoute((location.state as { from?: string })?.from || '/');

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  function avisar(campo: string) {
    setToast(`Preencha o campo ${campo}.`);
  }

  usePageTitle('Login');

  useEffect(() => {
    if (isMobileDevice()) {
      navigate('/login/mobile', { replace: true, state: location.state });
    }
  }, [navigate, location.state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const emailTrim = email.trim();
    if (!emailTrim && !senha) { avisar('e-mail e senha'); return; }
    if (!emailTrim) { avisar('e-mail'); return; }
    if (!senha) { avisar('senha'); return; }

    setLoading(true);
    try {
      const data = await api.login(emailTrim, senha);
      setSessao(data.accessToken, data.usuario);
      navigate(from, { replace: true, state: { welcome: data.usuario.nome } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const conhecidas = ['incorretos', 'obrigatórios', 'Sessão expirada', 'indisponível', 'Banco de dados', 'PostgreSQL'];
      setErro(msg && conhecidas.some((t) => msg.includes(t)) ? msg : 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: colors.canvas }}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 4,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 400,
            bgcolor: colors.surface,
            border: '1px solid',
            borderColor: colors.border,
            borderRadius: `${radius.xl}px`,
            boxShadow: shadows.login,
            px: { xs: 3, sm: 4 },
            py: { xs: 3.5, sm: 4 },
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <BrandLogo maxWidth={140} sx={{ mx: 'auto', mb: 2, filter: 'none' }} />
            <Typography sx={{ fontWeight: 600, fontSize: '1.125rem', color: colors.textPrimary, letterSpacing: '-0.02em' }}>
              {APP_NAME}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: '0.875rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              Entre com suas credenciais corporativas
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: colors.textMuted }}>
              {APP_TAGLINE}
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@grupoalvim.com.br"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="Senha"
              type={mostrarSenha ? 'text' : 'password'}
              fullWidth
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        size="small"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setMostrarSenha((v) => !v)}
                        edge="end"
                      >
                        {mostrarSenha ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {erro && (
              <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
                {erro}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 0.5,
                py: 1.125,
                bgcolor: colors.navy,
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': { bgcolor: colors.navyDark },
              }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SupportContact compact />
          </Box>
        </Box>
      </Box>

      <AppFooter compact />

      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="warning" onClose={() => setToast('')} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
