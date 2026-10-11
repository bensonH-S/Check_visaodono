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
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { formatMobileVersionNumber } from '../components/MobileVersionBadge';
import { assetUrl, LOGO_MERIDIAN_GESTAO, LOGO_MERIDIAN_MARK_M } from '../config/paths';
import { MOBILE_VIEWPORT } from '../theme/safeArea';
import { textosLogin } from '../financeiro/loginI18n';
import './login-mobile.css';

const COPYRIGHT = '©2026 Grupo Alvim · Alvim Participações e Investimentos S/A';
const FUNDO_LOGIN = `${assetUrl('Fundo_Principal.png')}?v=fill-ok`;
const MARK_M = `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=oficial3`;
const LOGO_GESTAO = `${assetUrl(LOGO_MERIDIAN_GESTAO)}?v=1`;
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

export default function LoginMobilePage() {
  const navigate = useNavigate();
  const { version } = useAppConfig();
  const versao = formatMobileVersionNumber(version);

  const tx = textosLogin('pt');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  usePageTitle(tx.titulo);

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

  function avisar(campo: 'email' | 'senha' | 'ambos') {
    setToast(tx.preencha(campo));
  }

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
      navigate(destinoPosLoginMobile(data.usuario), {
        replace: true,
        state: { welcome: data.usuario.nome },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErro(
        msg && ERROS_CONHECIDOS.some((t) => msg.includes(t))
          ? msg
          : tx.credenciaisInvalidas,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="ck-login" sx={{ ...MOBILE_VIEWPORT, height: '100%' }}>
      <div className="ck-login__scroll">
        <img className="ck-login__bg" src={FUNDO_LOGIN} alt="" aria-hidden />
        <div className="ck-login__veil" aria-hidden />

        <div className="ck-login__content">
          <div className="ck-login__card">
            <img className="ck-login__mark" src={MARK_M} alt="" />
            <img
              className="ck-login__brand-logo"
              src={LOGO_GESTAO}
              alt="Meridian Gestão Operacional"
            />
            <p className="ck-login__subtitle">{tx.subtitulo}</p>

            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit}
              className="ck-login__form"
            >
              <TextField
                label={tx.email}
                type="email"
                fullWidth
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grupoalvim.com.br"
                size="small"
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
                fullWidth
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={senha ? undefined : '••••••••'}
                size="small"
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
                <Alert severity="error" variant="filled" sx={{ py: 0.3, fontSize: '0.8rem', borderRadius: 2 }}>
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
                {loading ? tx.entrando : tx.entrar}
              </Button>
            </Box>

            <div className="ck-login__support">
              <SupportContact compact />
            </div>
          </div>
        </div>

        <footer className="ck-login__footer">
          {COPYRIGHT}
          {versao ? ` · ${versao}` : ''}
        </footer>
      </div>

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
          sx={{ minWidth: 280, boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
