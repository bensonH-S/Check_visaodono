import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import EmailIcon from '@mui/icons-material/Email';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTheme } from '@mui/material/styles';
import { api, type ConfiguracaoSmtp } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { portalPanelSx } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

const NAVY = '#1B2A6B';

export default function SmtpPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { showToast, ToastSnackbar } = useToast();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(true);

  const [config, setConfig] = useState<ConfiguracaoSmtp | null>(null);
  const [form, setForm] = useState({
    host: '',
    port: 587,
    secure: false,
    usuario: '',
    senha: '',
    email_from: '',
    nome_from: '',
    ativo: true,
  });

  const [emailTeste, setEmailTeste] = useState('');
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await api.smtpObter();
      setConfig(data);
      setForm({
        host: data.host || '',
        port: data.port || 587,
        secure: Boolean(data.secure),
        usuario: data.usuario || '',
        senha: data.senha || '',
        email_from: data.email_from || '',
        nome_from: data.nome_from || 'MERIDIAN',
        ativo: data.ativo !== false,
      });
      if (!emailTeste && data.usuario && data.usuario.includes('@')) {
        setEmailTeste(data.usuario);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar configurações de SMTP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar() {
    setSalvando(true);
    setErro('');
    setResultadoTeste(null);
    try {
      const payload = {
        host: form.host.trim(),
        port: Number(form.port) || 587,
        secure: form.secure,
        usuario: form.usuario.trim(),
        senha: form.senha ? form.senha : undefined,
        email_from: form.email_from.trim(),
        nome_from: form.nome_from.trim(),
        ativo: form.ativo,
      };

      const salvo = await api.smtpSalvar(payload);
      setConfig(salvo);
      if (salvo.senha !== undefined) {
        setForm((prev) => ({ ...prev, senha: salvo.senha || prev.senha }));
      }
      showToast('Configurações de SMTP salvas com sucesso!');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar configurações de SMTP');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarTeste() {
    if (!emailTeste || !emailTeste.includes('@')) {
      showToast('Informe um e-mail válido para o teste.', 'error');
      return;
    }
    setTestando(true);
    setResultadoTeste(null);
    try {
      const res = await api.smtpTestar({ para: emailTeste.trim() });
      setResultadoTeste({ ok: true, mensagem: res.mensagem });
      showToast('E-mail de teste enviado com sucesso!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar e-mail de teste';
      setResultadoTeste({ ok: false, mensagem: msg });
    } finally {
      setTestando(false);
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 840,
        height: '100%',
        overflowY: 'auto',
        pr: { xs: 0.5, sm: 1.5 },
        pb: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <ToastSnackbar />

      {/* Banner Superior */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: isDark ? 'rgba(232, 82, 10, 0.35)' : 'divider',
          background: isDark
            ? 'linear-gradient(135deg, rgba(232, 82, 10, 0.28) 0%, rgba(249, 115, 22, 0.16) 100%)'
            : `linear-gradient(135deg, ${NAVY} 0%, #2a3d8f 100%)`,
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(232, 82, 10, 0.25)' : 'rgba(255,255,255,0.15)',
                color: isDark ? '#FB923C' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EmailIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Servidor de E-mail (SMTP)
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                Configure as credenciais e parâmetros de envio direto pelo painel
              </Typography>
            </Box>
          </Box>

        </Box>
      </Paper>

      {loading && <LinearProgress />}

      {erro && (
        <Alert
          severity="error"
          onClose={() => setErro('')}
          sx={
            isDark
              ? {
                  bgcolor: 'rgba(239, 68, 68, 0.12)',
                  color: '#FCA5A5',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  '& .MuiAlert-icon': { color: '#F87171' },
                }
              : undefined
          }
        >
          {erro}
        </Alert>
      )}

      {/* Card de Formulário */}
      <Paper elevation={0} sx={{ ...portalPanelSx, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Parâmetros de Conexão e Autenticação
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Estes dados substituem as variáveis do arquivo .env quando ativos.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={config?.ativo ? 'Servidor Ativo' : 'Servidor Inativo'}
              color={config?.ativo ? 'success' : 'default'}
              size="small"
            />
            {config?.atualizado_em && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                Atualizado: {formatDataHoraBrasilia(config.atualizado_em)}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2.5 }} />

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              label="Servidor SMTP (Host)"
              fullWidth
              size="small"
              placeholder="ex: smtp.gmail.com ou mail.suaempresa.com.br"
              value={form.host}
              onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
              helperText="Host do servidor de e-mail da empresa ou provedor."
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Porta"
              fullWidth
              size="small"
              type="number"
              placeholder="587"
              value={form.port}
              onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) || 0 }))}
              helperText="Porta padrão: 587 (STARTTLS) ou 465 (SSL)."
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.secure}
                  onChange={(e) => setForm((p) => ({ ...p, secure: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Conexão Segura (SSL / TLS direta)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ative caso utilize porta 465 com criptografia SSL direta. Mantenha desligado para STARTTLS (porta 587).
                  </Typography>
                </Box>
              }
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Usuário / E-mail de Autenticação"
              fullWidth
              size="small"
              placeholder="ex: notificacoes@suaempresa.com.br"
              value={form.usuario}
              onChange={(e) => setForm((p) => ({ ...p, usuario: e.target.value }))}
              helperText="E-mail ou login aceito pelo servidor SMTP."
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Senha SMTP"
              fullWidth
              size="small"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite a senha do SMTP"
              value={form.senha}
              onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
              helperText="Para Gmail, utilize uma Senha de App de 16 caracteres."
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setMostrarSenha((v) => !v)}
                        edge="end"
                        aria-label="mostrar senha"
                      >
                        {mostrarSenha ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1.5, mb: 1.5 }}>
              Remetente dos E-mails (From)
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="E-mail do Remetente (From Address)"
              fullWidth
              size="small"
              placeholder="ex: no-reply@suaempresa.com.br"
              value={form.email_from}
              onChange={(e) => setForm((p) => ({ ...p, email_from: e.target.value }))}
              helperText="Endereço que aparecerá como remetente nas mensagens enviadas."
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Nome do Remetente (From Name)"
              fullWidth
              size="small"
              placeholder="ex: MERIDIAN | Visão do Dono"
              value={form.nome_from}
              onChange={(e) => setForm((p) => ({ ...p, nome_from: e.target.value }))}
              helperText="Nome de exibição exibido no leitor de e-mail do destinatário."
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Habilitar envio de e-mails do sistema via este servidor
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Quando desmarcado, os envios automáticos de e-mail ficam suspensos.
                  </Typography>
                </Box>
              }
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => void salvar()}
            disabled={salvando || loading}
            sx={{ px: 3, fontWeight: 700 }}
          >
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </Button>
        </Box>
      </Paper>

      {/* Card de Teste de Envio */}
      <Paper elevation={0} sx={{ ...portalPanelSx, p: { xs: 2, sm: 3 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Testar Envio de E-mail
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Envie um e-mail de teste em tempo real para confirmar a conexão com o servidor e as credenciais.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="E-mail de destino para teste"
            size="small"
            type="email"
            placeholder="seu-email@empresa.com.br"
            value={emailTeste}
            onChange={(e) => setEmailTeste(e.target.value)}
            sx={{ flex: 1, minWidth: 260 }}
          />
          <Button
            variant="contained"
            color="secondary"
            startIcon={testando ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={() => void enviarTeste()}
            disabled={testando || !emailTeste.trim() || loading}
            sx={{ fontWeight: 600 }}
          >
            {testando ? 'Enviando teste…' : 'Enviar teste'}
          </Button>
        </Box>

        {resultadoTeste && (
          <Alert
            severity={resultadoTeste.ok ? 'success' : 'error'}
            icon={resultadoTeste.ok ? <CheckCircleIcon fontSize="inherit" /> : undefined}
            sx={{
              mt: 2,
              ...(resultadoTeste.ok
                ? isDark
                  ? {
                      bgcolor: 'rgba(34, 197, 94, 0.12)',
                      color: '#86EFAC',
                      border: '1px solid rgba(34, 197, 94, 0.28)',
                    }
                  : {}
                : isDark
                ? {
                    bgcolor: 'rgba(239, 68, 68, 0.12)',
                    color: '#FCA5A5',
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                  }
                : {}),
            }}
          >
            {resultadoTeste.mensagem}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
