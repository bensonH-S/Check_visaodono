import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
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
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { setSessao, logout } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAppConfig } from '../hooks/useAppConfig';
import { assetUrl, normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';
import { APP_NAME, APP_TAGLINE } from '../config/brand';

import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from '../theme';

const FUNDO_LOGIN = `${assetUrl('Fundo_Principal.png')}?v=fill-ok`;
const PAGE_BG = '#e8e8e8';
const NAVY = '#1B2A6B';
const FEATURES = APP_TAGLINE.split(' · ');
const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';

const loginFieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: { xs: 44, sm: 48 },
    bgcolor: '#ffffff',
    borderRadius: '8px',
    '& fieldset': {
      borderColor: 'rgba(27, 42, 107, 0.25)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(27, 42, 107, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1B2A6B',
      borderWidth: 2,
    },
  },
  '& .MuiOutlinedInput-input': {
    py: { xs: '11px', sm: '12px' },
    color: '#111827 !important',
    fontSize: { xs: '0.875rem', sm: '0.925rem' },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(27, 42, 107, 0.75)',
    fontSize: { xs: '0.85rem', md: '0.88rem' },
    '&.Mui-focused': {
      color: '#1B2A6B',
    },
  },
  '& .MuiInputAdornment-root': { mr: 0.5 },
};

const loginFieldsWidth = { xs: 280, sm: 310, md: 330 };

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
    document.documentElement.classList.remove('dark');
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
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: '100svh',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        bgcolor: PAGE_BG,
        px: { xs: 1, sm: 1.5 },
        py: { xs: 1.5, sm: 2 },
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
          zIndex: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block',
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          bgcolor: 'rgba(27, 42, 107, 0.12)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pb: { xs: 2.5, sm: 3 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: { xs: 340, sm: 360, md: 380 },
            border: '1px solid',
            borderColor: 'rgba(27, 42, 107, 0.12)',
            borderRadius: { xs: 1.5, sm: 2 },
            textAlign: 'center',
            overflow: 'hidden',
            bgcolor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 18px 48px rgba(27, 42, 107, 0.12)',
          }}
        >
          <Box
            sx={{
              height: 4,
              bgcolor: NAVY,
              boxShadow: '0 3px 10px rgba(27, 42, 107, 0.3)',
            }}
          />
          <Box sx={{ px: { xs: 1.25, sm: 1.75 }, pt: { xs: 1.5, sm: 2 }, pb: { xs: 2.25, sm: 2.75 } }}>
            <BrandLogo maxWidth={{ xs: 96, sm: 110, md: 120 }} sx={{ mx: 'auto', mb: 0.5 }} />

            <Typography
              sx={{
                fontWeight: 800,
                color: '#E8520A',
                fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.2rem' },
                lineHeight: 1.2,
                mb: { xs: 1.25, sm: 1.5 },
                letterSpacing: '-0.01em',
              }}
            >
              {APP_NAME}
            </Typography>

            <Box
              sx={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: 0.45, sm: 0.6 },
                mt: { xs: 0.25, sm: 0.5 },
                mb: { xs: 0.5, sm: 0.65 },
                py: { xs: 0.45, sm: 0.55 },
                px: { xs: 0.75, sm: 0.9 },
                mx: 'auto',
                borderRadius: 1,
                bgcolor: 'rgba(27, 42, 107, 0.06)',
                border: '1px solid rgba(27, 42, 107, 0.08)',
                maxWidth: '100%',
              }}
            >
              {FEATURES.map((label, index) => (
                <Box
                  key={label}
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: { xs: 0.45, sm: 0.6 } }}
                >
                  {index > 0 && (
                    <Typography
                      component="span"
                      sx={{
                        color: '#E8520A',
                        fontSize: { xs: '0.6rem', sm: '0.64rem', md: '0.66rem' },
                        fontWeight: 600,
                        lineHeight: 1,
                        opacity: 0.8,
                      }}
                    >
                      |
                    </Typography>
                  )}
                  <Typography
                    component="span"
                    sx={{
                      color: NAVY,
                      lineHeight: 1.2,
                      fontSize: { xs: '0.68rem', sm: '0.72rem', md: '0.76rem' },
                      fontWeight: 600,
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Typography
              sx={{
                lineHeight: 1.4,
                fontSize: { xs: '0.78rem', sm: '0.82rem', md: '0.85rem' },
                fontWeight: 500,
                color: NAVY,
                opacity: 0.8,
                mt: 0,
                mb: { xs: 2, sm: 2.25 },
                px: 0.5,
              }}
            >
              Visão operacional das unidades do Grupo.
            </Typography>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.1 },
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  maxWidth: loginFieldsWidth,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 2.5, sm: 3 },
                }}
              >
                <TextField
                  label="E-mail"
                  type="email"
                  size="small"
                  margin="none"
                  fullWidth
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@grupoalvim.com.br"
                  sx={loginFieldSx}
                  slotProps={{
                    inputLabel: { sx: { fontSize: { xs: '0.78rem', md: '0.82rem' } } },
                    input: {
                      sx: { fontSize: { xs: '0.82rem', md: '0.86rem' } },
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon sx={{ fontSize: 16 }} color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="Senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  size="small"
                  margin="none"
                  fullWidth
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={senha ? undefined : '••••••••'}
                  sx={loginFieldSx}
                  slotProps={{
                    inputLabel: { sx: { fontSize: { xs: '0.78rem', md: '0.82rem' } } },
                    input: {
                      sx: { fontSize: { xs: '0.82rem', md: '0.86rem' } },
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ fontSize: 16 }} color="action" />
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
                          >
                            {mostrarSenha ? (
                              <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} />
                            ) : (
                              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              {erro && (
                <Alert
                  severity="error"
                  variant="filled"
                  sx={{ py: 0.25, fontSize: '0.78rem', width: '100%', maxWidth: loginFieldsWidth }}
                >
                  {erro}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="medium"
                disabled={loading}
                sx={{
                  width: '100%',
                  maxWidth: loginFieldsWidth,
                  mt: { xs: 1.3, sm: 1.6 },
                  py: { xs: 1, md: 1.15 },
                  fontSize: { xs: '0.875rem', md: '0.925rem' },
                  fontWeight: 600,
                  bgcolor: '#1B2A6B',
                  color: '#ffffff',
                  '&:hover': {
                    bgcolor: '#152056',
                  },
                }}
              >
                {loading ? 'Entrando…' : 'Acessar'}
              </Button>
            </Box>

            <SupportContact compact />
          </Box>
        </Paper>
      </Box>

      <Box
        component="footer"
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          flexShrink: 0,
          px: 1.5,
          py: 0.75,
          textAlign: 'center',
          bgcolor: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: '0.72rem', sm: '0.78rem' },
            fontWeight: 500,
            color: 'rgba(27, 42, 107, 0.7)',
            letterSpacing: '0.02em',
            lineHeight: 1.4,
            textShadow: '0 0 8px rgba(243, 241, 248, 0.9)',
          }}
        >
          {COPYRIGHT}
          <Box component="span" sx={{ mx: 0.6, opacity: 0.6 }}>
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
