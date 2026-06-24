import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import MobileLoginFooter from '../components/MobileLoginFooter';
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { destinoPosLoginMobile, getToken, logout, setSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import PwaInstallDialog from '../components/PwaInstallDialog';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { MOBILE_VIEWPORT, SAFE_AREA_TOP, safeAreaX } from '../theme/safeArea';
import { APP_NAME } from '../config/brand';

const PAGE_BG = '#f5f5f3';
const NAVY = '#1B2A6B';
const MOBILE_MODULES = ['Checklist', 'Chamados', 'Frota'] as const;

const ERROS_CONHECIDOS = [
  'incorretos',
  'obrigatórios',
  'Sessão expirada',
  'indisponível',
  'Banco de dados',
  'PostgreSQL',
];

export default function LoginMobilePage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  usePageTitle('Login Mobile');

  useEffect(() => {
    iniciarServiceWorkerPwa();
    const token = getToken();
    if (!token) {
      logout();
      return;
    }
    let ativo = true;
    api
      .me({ skipSessionRedirect: true })
      .then((usuario) => {
        if (!ativo) return;
        setSessao(token, usuario);
        navigate(destinoPosLoginMobile(usuario), { replace: true });
      })
      .catch(() => {
        if (!ativo) return;
        logout();
      });
    return () => {
      ativo = false;
    };
  }, [navigate]);

  function avisar(campo: string) {
    setToast(`Preencha o campo ${campo}.`);
  }

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
      navigate(destinoPosLoginMobile(data.usuario), {
        replace: true,
        state: { welcome: data.usuario.nome },
      });
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
    <Box
      sx={{
        ...MOBILE_VIEWPORT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: PAGE_BG,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...safeAreaX(16),
          ...SAFE_AREA_TOP,
          pb: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 400,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: 5,
              bgcolor: NAVY,
              boxShadow: '0 4px 12px rgba(27, 42, 107, 0.35)',
            }}
          />
          <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
            <BrandLogo maxWidth={{ xs: 120, sm: 136 }} sx={{ mx: 'auto', mb: 0.75 }} />

            <Typography
              sx={{
                fontWeight: 800,
                color: '#E8520A',
                fontSize: { xs: '1.2rem', sm: '1.3rem' },
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
                gap: 0.5,
                mt: { xs: 0.25, sm: 0.5 },
                mb: { xs: 0.5, sm: 0.65 },
                py: 0.5,
                px: 1,
                mx: 'auto',
                borderRadius: 1.5,
                bgcolor: 'rgba(27, 42, 107, 0.07)',
                border: '1px solid rgba(27, 42, 107, 0.1)',
                maxWidth: '100%',
              }}
            >
              {MOBILE_MODULES.map((label, index) => (
                <Box
                  key={label}
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  {index > 0 && (
                    <Typography
                      component="span"
                      sx={{
                        color: '#E8520A',
                        fontSize: '0.65rem',
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
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
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
                lineHeight: 1.5,
                fontSize: '0.875rem',
                fontWeight: 500,
                color: NAVY,
                opacity: 0.8,
                mt: 0,
                mb: 2.5,
                px: 0.5,
              }}
            >
              Manutenção, visitas e controle de frota.
            </Typography>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
            >
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                size="small"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grupoalvim.com.br"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Senha"
                type={mostrarSenha ? 'text' : 'password'}
                fullWidth
                size="small"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={senha ? undefined : '••••••••'}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" color="action" />
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
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          ) : (
                            <VisibilityOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {erro && (
                <Alert severity="error" variant="filled" sx={{ py: 0.25 }}>
                  {erro}
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                size="medium"
                fullWidth
                disabled={loading}
                sx={{ py: 1, fontWeight: 600 }}
              >
                {loading ? 'Entrando…' : 'Acessar'}
              </Button>
            </Box>

            <SupportContact compact />
          </Box>
        </Paper>
      </Box>

      <MobileLoginFooter />

      <PwaInstallDialog />

      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setToast('')} sx={{ minWidth: 280 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
