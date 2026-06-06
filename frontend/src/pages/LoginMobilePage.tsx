import { useState } from 'react';
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
import AppFooter from '../components/AppFooter';
import SupportContact from '../components/SupportContact';
import { api } from '../api/client';
import { setSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_BG = '#f5f5f3';
const NAVY = '#1B2A6B';

export default function LoginMobilePage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  usePageTitle('Login Mobile');

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
      navigate('/chamados/mobile', { replace: true, state: { welcome: data.usuario.nome } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const conhecidas = ['incorretos', 'obrigatórios', 'Sessão expirada', 'indisponível'];
      setErro(
        msg && conhecidas.some((t) => msg.includes(t))
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
        height: '100%',
        minHeight: '100dvh',
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
          px: 2,
          py: 3,
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
                mb: 1,
                letterSpacing: '-0.01em',
              }}
            >
              Vision Check
            </Typography>

            <Box
              sx={{
                display: 'inline-block',
                mb: 1,
                py: 0.5,
                px: 1.5,
                borderRadius: 1.5,
                bgcolor: 'rgba(27, 42, 107, 0.07)',
                border: '1px solid rgba(27, 42, 107, 0.1)',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.35,
                  fontSize: '0.875rem',
                  color: NAVY,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Chamados
              </Typography>
            </Box>

            <Typography
              sx={{
                lineHeight: 1.5,
                fontSize: '0.875rem',
                fontWeight: 500,
                color: NAVY,
                opacity: 0.8,
                mb: 3.5,
                px: 0.5,
              }}
            >
              Abra e acompanhe chamados de manutenção na sua loja.
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

            <SupportContact />
          </Box>
        </Paper>
      </Box>

      <AppFooter compact />

      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setToast('')} sx={{ minWidth: 280 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
