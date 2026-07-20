import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
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
import { destinoPosLoginMobile, getToken, logout, setSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAppConfig } from '../hooks/useAppConfig';
import PwaInstallDialog from '../components/PwaInstallDialog';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { formatMobileVersionNumber } from '../components/MobileVersionBadge';
import { assetUrl } from '../config/paths';
import { APP_NAME } from '../config/brand';
import { MOBILE_VIEWPORT } from '../theme/safeArea';
import './login-mobile.css';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';

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
  const { version } = useAppConfig();
  const versao = formatMobileVersionNumber(version);

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
          : 'E-mail ou senha incorretos',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="ck-login" sx={{ ...MOBILE_VIEWPORT, height: '100%' }}>
      <div className="ck-login__scroll">
        <div className="ck-login__stage">
          <div className="ck-login__glow--a" aria-hidden />
          <div className="ck-login__glow--b" aria-hidden />
          <div className="ck-login__mesh" aria-hidden />

          <img
            src={assetUrl('Logo_Icon-clear.png')}
            alt=""
            className="ck-login__logo"
            width={88}
            height={88}
          />
          <div className="ck-login__stage-inner">
            <p className="ck-login__mark">Grupo Alvim</p>
            <h1 className="ck-login__title">{APP_NAME}</h1>
            <p className="ck-login__sub">
              Manutenção, visitas e controle de frota.
            </p>
          </div>
        </div>

        <div className="ck-login__sheet">
          <div className="ck-login__sheet-inner">
            <p className="ck-login__sheet-label">Acesso</p>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              className="ck-login__form"
            >
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grupoalvim.com.br"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fff',
                    fontFamily: 'Manrope, system-ui, sans-serif',
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon fontSize="small" sx={{ color: '#E8520A' }} />
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fff',
                    fontFamily: 'Manrope, system-ui, sans-serif',
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" sx={{ color: '#E8520A' }} />
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
                <Alert severity="error" variant="filled" sx={{ py: 0.25, borderRadius: 2 }}>
                  {erro}
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                className="ck-login__cta"
              >
                {loading ? 'Entrando…' : 'Acessar'}
              </Button>
            </Box>

            <div className="ck-login__bottom">
              <div className="ck-login__support">
                <SupportContact compact />
              </div>
              <footer className="ck-login__footer">
                {COPYRIGHT}
                {versao ? ` · ${versao}` : ''}
              </footer>
            </div>
          </div>
        </div>
      </div>

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
