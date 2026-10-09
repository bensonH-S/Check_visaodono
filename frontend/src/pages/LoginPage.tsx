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
import MeridianMarca from '../brand/MeridianMarca';
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { setSessao, logout } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAppConfig } from '../hooks/useAppConfig';
import { assetUrl, LOGO_MERIDIAN_MARK_M, normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from '../theme';
import './login-desktop.css';

const FUNDO_LOGIN = `${assetUrl('Fundo_Principal.png')}?v=fill-ok`;
const MARK_M = `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=2`;
const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';
const NAVY = '#1B6EF3';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 50,
    bgcolor: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    fontFamily: 'Manrope, system-ui, sans-serif',
    '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.28)' },
    '&:hover fieldset': { borderColor: 'rgba(27, 110, 243, 0.5)' },
    '&.Mui-focused fieldset': { borderColor: NAVY, borderWidth: 1.5 },
  },
  '& .MuiOutlinedInput-input': {
    py: '13px',
    color: '#F8FAFC !important',
    fontSize: '0.95rem',
    fontFamily: 'Manrope, system-ui, sans-serif',
    '&::placeholder': { color: 'rgba(148,163,184,0.65)', opacity: 1 },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(148, 163, 184, 0.9)',
    fontFamily: 'Manrope, system-ui, sans-serif',
    fontWeight: 600,
    '&.Mui-focused': { color: NAVY },
  },
  '& .MuiSvgIcon-root': { color: 'rgba(148, 163, 184, 0.85)' },
};

const ERROS_CONHECIDOS = [
  'incorretos',
  'obrigatórios',
  'Sessão expirada',
  'indisponível',
  'Banco de dados',
  'PostgreSQL',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { version, environment } = useAppConfig();
  const from = normalizeAppRoute((location.state as { from?: string })?.from || '/dashboard');
  const versionLabel =
    version === 'dev' ? 'dev' : version.startsWith('v') ? version : `v${version}`;

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
    logout();
  }, []);

  useEffect(() => {
    if (isMobileDevice()) {
      navigate('/login/mobile', { replace: true, state: location.state });
    }
  }, [navigate, location.state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const emailTrim = email.trim();
    if (!emailTrim && !senha) {
      avisar('e-mail e senha');
      return;
    }
    if (!emailTrim) {
      avisar('e-mail');
      return;
    }
    if (!senha) {
      avisar('senha');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(emailTrim, senha);
      setSessao(data.accessToken, data.usuario);
      navigate(from, { replace: true, state: { welcome: data.usuario.nome } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErro(
        msg && ERROS_CONHECIDOS.some((t) => msg.includes(t))
          ? msg
          : 'E-mail ou senha incorretos'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Box
        className="meridian-login"
        sx={{
          position: 'relative',
          minHeight: '100svh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 4,
          overflow: 'hidden',
          bgcolor: '#051017',
        }}
      >
        <Box
          component="img"
          src={FUNDO_LOGIN}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.18,
            filter: 'saturate(0.6) contrast(1.08)',
            pointerEvents: 'none',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 55% 50% at 50% 28%, rgba(27,110,243,0.32), transparent 60%), linear-gradient(180deg, #020617 0%, #051017 45%, #020617 100%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          className="meridian-login__stack"
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -20,
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(27,110,243,0.28), transparent 68%)',
              filter: 'blur(8px)',
              pointerEvents: 'none',
            }}
          />

          <Box
            component="img"
            className="meridian-login__mark"
            src={MARK_M}
            alt=""
            sx={{
              position: 'relative',
              width: { xs: 96, sm: 112 },
              height: 'auto',
              mb: 1.75,
              filter: 'drop-shadow(0 0 28px rgba(27,110,243,0.4))',
            }}
          />

          <MeridianMarca sx={{ width: '100%', maxWidth: 280, mb: 1.75 }} />

          <Typography
            sx={{
              fontFamily: 'Manrope, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: { xs: '0.88rem', sm: '0.95rem' },
              color: 'rgba(186, 230, 253, 0.9)',
              lineHeight: 1.4,
              maxWidth: 320,
              mb: 3,
            }}
          >
            Do caixa ao campo — uma visão só para quem decide.
          </Typography>

          <Box
            sx={{
              width: '100%',
              p: { xs: 2.5, sm: 3 },
              borderRadius: '16px',
              bgcolor: 'rgba(11, 18, 32, 0.78)',
              border: '1px solid rgba(27, 110, 243, 0.2)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(16px)',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, system-ui, sans-serif',
                fontWeight: 800,
                fontSize: '1.5rem',
                letterSpacing: '-0.02em',
                color: '#F8FAFC',
                mb: 0.4,
              }}
            >
              Entrar
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Manrope, system-ui, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'rgba(148, 163, 184, 0.95)',
                mb: 2.75,
              }}
            >
              Acesse com seu e-mail corporativo
            </Typography>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.15, textAlign: 'left' }}
            >
              <TextField
                label="E-mail"
                type="email"
                size="small"
                fullWidth
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grupoalvim.com.br"
                sx={fieldSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                label="Senha"
                type={mostrarSenha ? 'text' : 'password'}
                size="small"
                fullWidth
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={senha ? undefined : '••••••••'}
                sx={fieldSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                          onClick={() => setMostrarSenha((v) => !v)}
                          edge="end"
                          size="small"
                          sx={{ color: 'rgba(148,163,184,0.85)' }}
                        >
                          {mostrarSenha ? (
                            <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {erro && (
                <Alert severity="error" variant="filled" sx={{ py: 0.3, fontSize: '0.8rem' }}>
                  {erro}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 0.35,
                  py: 1.35,
                  borderRadius: '12px',
                  fontFamily: 'Manrope, system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  textTransform: 'none',
                  color: '#fff',
                  background: `linear-gradient(90deg, ${NAVY} 0%, #0EA5E9 100%)`,
                  boxShadow: '0 12px 28px rgba(27, 110, 243, 0.32)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #0D4ECC 0%, #0284C7 100%)',
                  },
                }}
              >
                {loading ? 'Entrando…' : 'Entrar no Meridian'}
              </Button>
            </Box>

            <Box
              sx={{
                mt: 2,
                '& .MuiTypography-root': { color: 'rgba(148,163,184,0.8) !important' },
                '& button': { color: '#60A5FA !important' },
              }}
            >
              <SupportContact compact />
            </Box>
          </Box>

          <Typography
            sx={{
              mt: 2.5,
              fontFamily: 'Manrope, system-ui, sans-serif',
              fontSize: '0.7rem',
              color: 'rgba(148,163,184,0.5)',
            }}
          >
            {COPYRIGHT}
            <Box component="span" sx={{ mx: 0.55 }}>
              ·
            </Box>
            {versionLabel} · {environment}
          </Typography>
        </Box>

        <Snackbar
          open={!!toast}
          autoHideDuration={2000}
          onClose={() => setToast('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            severity="warning"
            variant="filled"
            onClose={() => setToast('')}
            sx={{ width: '100%', minWidth: 280 }}
          >
            {toast}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
