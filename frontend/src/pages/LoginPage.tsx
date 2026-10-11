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
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { setSessao, logout } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAppConfig } from '../hooks/useAppConfig';
import { assetUrl, LOGO_MERIDIAN_GESTAO, LOGO_MERIDIAN_MARK_M, normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from '../theme';
import { textosLogin } from '../financeiro/loginI18n';
import './login-desktop.css';

const FUNDO_LOGIN = `${assetUrl('Fundo_Principal.png')}?v=fill-ok`;
const MARK_M = `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=2`;
const LOGO_GESTAO = `${assetUrl(LOGO_MERIDIAN_GESTAO)}?v=1`;
const COPYRIGHT = '©2026 Grupo Alvim · Alvim Participações e Investimentos S/A';
/** Azul normal → azul bem escuro (sem ciano, para não “brilhar” no card). */
const BTN_GRAD = 'linear-gradient(90deg, #0548d1 0%, #0439b0 42%, #02061f 100%)';
const BTN_GRAD_HOVER = 'linear-gradient(90deg, #0D4ECC 0%, #0548d1 42%, #040c3b 100%)';

const FIELD_BG = '#0b1220';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    bgcolor: `${FIELD_BG} !important`,
    borderRadius: '10px',
    fontFamily: 'Manrope, system-ui, sans-serif',
    overflow: 'hidden',
    '& fieldset': { borderColor: 'rgba(5, 72, 209, 0.45)' },
    '&:hover fieldset': { borderColor: 'rgba(5, 72, 209, 0.75)' },
    '&.Mui-focused fieldset': { borderColor: '#0548d1', borderWidth: 1.5 },
  },
  '& .MuiOutlinedInput-input': {
    py: '10px',
    color: '#F8FAFC !important',
    WebkitTextFillColor: '#F8FAFC',
    caretColor: '#F8FAFC',
    bgcolor: 'transparent !important',
    borderRadius: 0,
    fontSize: '0.875rem',
    fontFamily: 'Manrope, system-ui, sans-serif',
    '&::placeholder': {
      color: 'rgba(148, 163, 184, 0.55) !important',
      WebkitTextFillColor: 'rgba(148, 163, 184, 0.55) !important',
      opacity: 1,
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(148, 163, 184, 0.9)',
    fontFamily: 'Manrope, system-ui, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    '&.Mui-focused': { color: '#3B82F6' },
  },
  '& .MuiSvgIcon-root': { color: 'rgba(148, 163, 184, 0.85)', fontSize: 17 },
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

  const tx = textosLogin('pt');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  function avisar(campo: 'email' | 'senha' | 'ambos') {
    setToast(tx.preencha(campo));
  }

  usePageTitle(tx.titulo);

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
      avisar('ambos');
      return;
    }
    if (!emailTrim) {
      avisar('email');
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
          : tx.credenciaisInvalidas
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
          pt: 4,
          pb: 5.5,
          overflow: 'hidden',
          bgcolor: '#051017',
          colorScheme: 'dark',
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
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              p: { xs: 2.5, sm: 3 },
              borderRadius: '16px',
              bgcolor: 'rgba(11, 18, 32, 0.78)',
              border: '1px solid rgba(27, 110, 243, 0.2)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(16px)',
              textAlign: 'center',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg, #0548d1 0%, #0439b0 45%, #02061f 100%)',
              },
            }}
          >
            <Box
              component="img"
              className="meridian-login__mark"
              src={MARK_M}
              alt=""
              sx={{
                width: 72,
                height: 'auto',
                mb: 1.1,
                mx: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 4px 12px rgba(2, 6, 31, 0.45))',
              }}
            />
            <Box
              component="img"
              src={LOGO_GESTAO}
              alt="Meridian Gestão Operacional"
              sx={{
                width: '100%',
                maxWidth: 200,
                height: 'auto',
                mb: 1.75,
                mx: 'auto',
                display: 'block',
                objectFit: 'contain',
              }}
            />
            <Typography
              sx={{
                fontFamily: 'Manrope, system-ui, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'rgba(148, 163, 184, 0.95)',
                mb: 2.5,
              }}
            >
              {tx.subtitulo}
            </Typography>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 1.65, textAlign: 'left' }}
            >
              <TextField
                label={tx.email}
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
                label={tx.senha}
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
                          aria-label={mostrarSenha ? tx.ocultarSenha : tx.mostrarSenha}
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
                  mt: 0.25,
                  py: 0.95,
                  minHeight: 40,
                  borderRadius: '10px',
                  fontFamily: 'Manrope, system-ui, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  color: '#fff !important',
                  textShadow: '0 1px 2px rgba(4, 12, 59, 0.45)',
                  background: BTN_GRAD,
                  boxShadow: '0 8px 18px rgba(2, 6, 31, 0.45)',
                  '&:hover': {
                    background: BTN_GRAD_HOVER,
                    boxShadow: '0 10px 22px rgba(5, 72, 209, 0.35)',
                  },
                  '&.Mui-disabled': {
                    color: '#fff !important',
                    opacity: 0.88,
                    background: BTN_GRAD,
                  },
                }}
              >
                {loading ? tx.entrando : tx.entrar}
              </Button>
            </Box>

            <Box
              sx={{
                mt: 2,
                '& .MuiTypography-caption:not(button)': { color: 'rgba(148,163,184,0.7)' },
                '& button': {
                  color: '#F8FAFC !important',
                  textDecorationColor: 'rgba(248, 250, 252, 0.45) !important',
                  transition: 'color 0.15s ease, text-decoration-color 0.15s ease',
                  '&:hover': {
                    color: '#0548d1 !important',
                    textDecorationColor: 'rgba(5, 72, 209, 0.9) !important',
                  },
                },
              }}
            >
              <SupportContact compact />
            </Box>
          </Box>
        </Box>

        <Typography
          component="footer"
          sx={{
            position: 'absolute',
            zIndex: 1,
            left: 0,
            right: 0,
            bottom: 0,
            px: 2,
            py: 1.5,
            textAlign: 'center',
            fontFamily: 'Manrope, system-ui, sans-serif',
            fontSize: '0.7rem',
            color: 'rgba(148,163,184,0.5)',
            pointerEvents: 'none',
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
        sx={{ zIndex: 20000 }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setToast('')}
          sx={{ width: '100%', minWidth: 280, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}
        >
          {toast}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
