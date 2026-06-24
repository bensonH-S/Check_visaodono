import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SendIcon from '@mui/icons-material/Send';
import { api } from '../../api/client';
import type { WppStatus } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { portalPanelSx } from '../../theme/tokens';

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WppStatus | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [erro, setErro] = useState('');
  const pollingRef = useRef<number | null>(null);
  const estavaConectadoRef = useRef(false);
  const { showToast, ToastSnackbar } = useToast();

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setErro('');
    try {
      const s = await api.wppStatus();
      setStatus(s);
      if (s.conectado) {
        setQrcode(null);
        if (!estavaConectadoRef.current) {
          estavaConectadoRef.current = true;
          showToast('WhatsApp conectado!');
        }
        return;
      }
      estavaConectadoRef.current = false;
      if (s.enabled && !s.conectado) {
        const qr = await api.wppQrcode();
        if (qr.qrcode) setQrcode(qr.qrcode);
      }
    } catch (e) {
      if (!silencioso) setErro(e instanceof Error ? e.message : 'Erro ao carregar status');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (!status?.enabled || status.conectado) return undefined;

    pollingRef.current = window.setInterval(() => {
      void carregar(true);
    }, 5000);

    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [status?.enabled, status?.conectado, carregar]);

  async function conectar(reiniciar = false) {
    setConectando(true);
    setErro('');
    try {
      const res = await api.wppConectar(reiniciar);
      if (res.qrcode) setQrcode(res.qrcode);
      setStatus((prev) => (prev ? { ...prev, conectado: res.conectado } : prev));
      if (!res.conectado) await carregar(true);
      showToast(
        res.conectado
          ? 'WhatsApp conectado!'
          : res.qrcode
            ? 'QR Code pronto — escaneie no celular'
            : res.message || 'Aguarde até 2 min e clique em Atualizar',
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar');
    } finally {
      setConectando(false);
    }
  }

  async function enviarTeste() {
    if (!telefoneTeste.trim()) return;
    setEnviandoTeste(true);
    setErro('');
    try {
      await api.wppTeste({ telefone: telefoneTeste.trim() });
      showToast('Mensagem de teste enviada!');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro no envio de teste');
    } finally {
      setEnviandoTeste(false);
    }
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Sessão <strong>wpp_visao_check</strong> via wppconnect-server
      </Typography>

      {loading && <LinearProgress />}
      {erro && (
        <Alert severity="error">
          {erro}
        </Alert>
      )}

      <Paper elevation={0} sx={{ ...portalPanelSx, p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Status da sessão
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void carregar()} disabled={loading}>
            Atualizar
          </Button>
        </Box>

        {status?.servicoIndisponivel ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {status.message || 'Serviço wppconnect indisponível.'}{' '}
            No servidor, confira <code>docker ps | grep vision-check</code> e rode{' '}
            <code>./fix-wpp.sh</code> (ou <code>docker-compose up -d --force-recreate wppconnect</code>).
          </Alert>
        ) : !status?.enabled ? (
          <Alert severity="warning">
            WhatsApp desabilitado. Defina <code>WPP_ENABLED=true</code> no <code>.env</code> e reinicie o servidor.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              label={status.conectado ? 'Conectado' : 'Aguardando QR'}
              color={status.conectado ? 'success' : 'warning'}
              size="small"
            />
            <Chip label={`Sessão: ${status.session || status.sessionConfig}`} size="small" variant="outlined" />
            {status.publicUrl && (
              <Chip label={`URL: ${status.publicUrl}`} size="small" variant="outlined" />
            )}
          </Box>
        )}

        {status?.enabled && !status.conectado && (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
              No celular: <strong>WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho</strong>.
              A página atualiza sozinha a cada 5s até conectar.
            </Alert>
            {qrcode ? (
              <Box sx={{ mb: 2 }}>
                <Box
                  component="img"
                  src={qrcode}
                  alt="QR Code WhatsApp"
                  sx={{ maxWidth: 280, width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Clique em &quot;Gerar QR Code&quot;. Na primeira vez pode levar até 2 minutos (Chromium no
                servidor).
              </Typography>
            )}
            {conectando && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Iniciando sessão… aguarde, não feche a página.
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<QrCodeScannerIcon />}
                onClick={() => void conectar(!qrcode)}
                disabled={conectando}
              >
                {conectando ? 'Iniciando…' : qrcode ? 'Novo QR Code' : 'Gerar QR Code'}
              </Button>
              {qrcode && (
                <Button variant="outlined" onClick={() => void conectar(true)} disabled={conectando}>
                  Reiniciar sessão
                </Button>
              )}
            </Box>
          </Box>
        )}

        {status?.enabled && status.conectado && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Sessão ativa. Notificações de chamados serão enviadas aos usuários com WhatsApp cadastrado.
          </Alert>
        )}
      </Paper>

      <Paper elevation={0} sx={{ ...portalPanelSx, p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Envio de teste
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
          <TextField
            label="Telefone (DDD + número)"
            placeholder="61999998888"
            value={telefoneTeste}
            onChange={(e) => setTelefoneTeste(e.target.value)}
            size="small"
            fullWidth
          />
          <Button
            variant="outlined"
            startIcon={<SendIcon />}
            onClick={() => void enviarTeste()}
            disabled={enviandoTeste || !status?.conectado}
            sx={{ flexShrink: 0 }}
          >
            Enviar teste
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Cadastre o WhatsApp de cada usuário em Configurações → Usuários.
        </Typography>
      </Paper>

      <ToastSnackbar />
    </Box>
  );
}
