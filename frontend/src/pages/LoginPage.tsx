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

import AppFooter from '../components/AppFooter';

import SupportContact from '../components/SupportContact';

import { api } from '../api/client';

import { setSessao } from '../lib/auth';

import { usePageTitle } from '../hooks/usePageTitle';
import { normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';



const PAGE_BG = '#f5f5f3';
const NAVY = '#1B2A6B';

const FEATURES = ['Checklist', 'Chamados', 'Visão de Dono'] as const;



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
            maxWidth: 440,
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
          <Box sx={{ px: { xs: 2.5, sm: 3 }, pt: 2, pb: { xs: 2.5, sm: 3 } }}>
            <BrandLogo maxWidth={{ xs: 120, sm: 140, md: 160 }} sx={{ mx: 'auto', mb: 0.75 }} />

            <Typography
              sx={{
                fontWeight: 800,
                color: '#E8520A',
                fontSize: { xs: '1.25rem', sm: '1.4rem', md: '1.5rem' },
                lineHeight: 1.2,
                mb: 1,
                letterSpacing: '-0.01em',
              }}
            >
              Vision Check
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mb: 1,
                py: 1,
                px: 1.5,
                borderRadius: 1.5,
                bgcolor: 'rgba(27, 42, 107, 0.07)',
                border: '1px solid rgba(27, 42, 107, 0.1)',
              }}
            >
              {FEATURES.map((label, index) => (
                <Box
                  key={label}
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
                >
                  {index > 0 && (
                    <Typography
                      component="span"
                      sx={{ color: '#E8520A', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1, opacity: 0.85 }}
                    >
                      |
                    </Typography>
                  )}
                  <Typography
                    component="span"
                    sx={{
                      color: NAVY,
                      lineHeight: 1.4,
                      fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      transition: 'color 0.2s ease',
                      '&:hover': { color: '#E8520A' },
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
                fontSize: { xs: '0.875rem', sm: '0.9rem' },
                fontWeight: 500,
                color: NAVY,
                opacity: 0.8,
                mb: 3.5,
                px: 1,
              }}
            >
              Visão operacional das unidades do Grupo.
            </Typography>

            <Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

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
                <Alert severity="error" variant="filled">
                  {erro}
                </Alert>
              )}

              <Button

                type="submit"

                variant="contained"

                size="large"

                disabled={loading}

                sx={{ mt: 0.5, py: 1.25, fontWeight: 600 }}

              >

                {loading ? 'Entrando…' : 'Acessar'}

              </Button>

            </Box>



            <SupportContact />
          </Box>
        </Paper>
      </Box>

      <AppFooter />

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

  );

}

