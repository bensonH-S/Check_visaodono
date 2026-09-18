import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import SyncIcon from '@mui/icons-material/Sync';
import { api, type AgenteAlvimStatus } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { portalPanelSx } from '../../theme/tokens';

const MODELO_LABEL: Record<string, string> = {
  'gpt-4o-mini': 'GPT-4o mini (barato)',
  'gpt-4o': 'GPT-4o',
  'gpt-4.1-mini': 'GPT-4.1 mini',
  'gpt-4.1': 'GPT-4.1',
};

export default function AgenteAlvimPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { showToast, ToastSnackbar } = useToast();

  const [status, setStatus] = useState<AgenteAlvimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState('');
  const [tom, setTom] = useState('');
  const [modelo, setModelo] = useState('gpt-4o-mini');
  const [grupo, setGrupo] = useState('');
  const [telefoneTeste, setTelefoneTeste] = useState('61991094654');
  const [ferramenta, setFerramenta] = useState('estoque');
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await api.agenteAlvimStatus();
      setStatus(data);
      setTom(data.tom || '');
      setModelo(data.ai_model || 'gpt-4o-mini');
      setGrupo(data.grupo_whatsapp || '');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o Agente Alvim');
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
    try {
      const data = await api.agenteAlvimSalvar({
        tom: tom.trim(),
        ai_model: modelo.trim() || null,
        grupo_whatsapp: grupo.trim() || null,
      });
      setStatus(data);
      setTom(data.tom || tom);
      setModelo(data.ai_model || modelo);
      setGrupo(data.grupo_whatsapp || '');
      showToast('Persona e modelo salvos.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function sincronizarGrupos() {
    setSincronizando(true);
    setErro('');
    try {
      const r = await api.agenteAlvimSincronizarGrupos();
      if (!r.ok) {
        setErro(r.motivo === 'sessao_wpp' ? 'WhatsApp desconectado. Conecte em Configurações > WhatsApp.' : (r.motivo || 'Não deu para listar os grupos'));
        return;
      }
      await carregar();
      showToast('Grupos do WhatsApp mapeados.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao buscar grupos');
    } finally {
      setSincronizando(false);
    }
  }

  async function enviarTeste() {
    if (!telefoneTeste.trim()) {
      showToast('Informe o telefone de teste.', 'error');
      return;
    }
    setTestando(true);
    setErro('');
    try {
      const r = await api.agenteAlvimTeste({
        ferramenta,
        telefone: telefoneTeste.trim(),
      });
      if (!r.ok) {
        setErro(r.motivo || 'Teste não enviou');
        return;
      }
      showToast('Recado de teste enviado.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no teste');
    } finally {
      setTestando(false);
    }
  }

  const modelos = status?.ai_modelos?.length ? status.ai_modelos : Object.keys(MODELO_LABEL);
  const modelosSelect = modelos.includes(modelo) ? modelos : [modelo, ...modelos];

  return (
    <Box sx={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ToastSnackbar />
      <Typography variant="body2" color="text.secondary">
        Persona e modelo ficam salvos aqui. O Alvim usa isso no Zap — não precisa colar prompt no chat.
      </Typography>

      {loading && <LinearProgress />}
      {erro && (
        <Alert severity="error" onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {status && !status.env_enabled && (
        <Alert severity="info">
          O disparo automático está desligado. O Alvim ainda ouve os grupos e responde no fio.
        </Alert>
      )}

      <Paper elevation={0} sx={{ ...portalPanelSx, p: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip
            size="small"
            label={status?.ai_enabled ? 'GPT ligado' : 'GPT desligado'}
            color={status?.ai_enabled ? 'success' : 'default'}
          />
          <Chip size="small" variant="outlined" label={status?.ai_provider || 'openai'} />
          <Chip
            size="small"
            variant="outlined"
            label={status?.wpp ? 'WhatsApp ok' : 'WhatsApp off'}
            color={status?.wpp ? 'success' : 'warning'}
          />
        </Box>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="alvim-modelo">Modelo</InputLabel>
          <Select
            labelId="alvim-modelo"
            label="Modelo"
            value={modelo}
            onChange={(e) => setModelo(String(e.target.value))}
          >
            {modelosSelect.map((id) => (
              <MenuItem key={id} value={id}>
                {MODELO_LABEL[id] || id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Persona (tom / voz)"
          value={tom}
          onChange={(e) => setTom(e.target.value)}
          multiline
          minRows={7}
          fullWidth
          helperText="Isto é a voz. O prompt operacional completo (conferir antes de comemorar, estados da pendência, silêncio) já está no sistema e o GPT recebe junto — não precisa colar o textão aqui."
        />

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Grupos do WhatsApp
          </Typography>
          <Button
            size="small"
            startIcon={<SyncIcon />}
            onClick={() => void sincronizarGrupos()}
            disabled={sincronizando}
          >
            {sincronizando ? 'Buscando…' : 'Buscar grupos'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Não precisa do @g.us. O Alvim lê Liderança, Gestores e Região — Projetos de TI no Zap conectado.
        </Typography>
        {status?.grupos?.lideranca && (
          <Chip size="small" sx={{ mr: 0.5, mb: 0.5 }} label={`Liderança: ${status.grupos.lideranca.nome}`} />
        )}
        {status?.grupos?.gestores && (
          <Chip size="small" sx={{ mr: 0.5, mb: 0.5 }} label={`Gestores: ${status.grupos.gestores.nome}`} />
        )}
        {(status?.grupos?.regioes || []).map((g) => (
          <Chip
            key={g.id}
            size="small"
            sx={{ mr: 0.5, mb: 0.5 }}
            label={`Região ${g.nome_regional || g.regional || g.nome}`}
          />
        ))}
        {!status?.grupos?.lideranca && !status?.grupos?.gestores && !(status?.grupos?.regioes || []).length && (
          <Typography variant="body2" color="text.secondary">
            Nenhum grupo mapeado ainda. Conecte o WhatsApp e clique em Buscar grupos.
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => void salvar()}
            disabled={salvando || loading}
            sx={isDark ? undefined : { bgcolor: '#1B2A6B', '&:hover': { bgcolor: '#152256' } }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...portalPanelSx, p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Teste (não manda para regional)
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="alvim-ferramenta">Ferramenta</InputLabel>
            <Select
              labelId="alvim-ferramenta"
              label="Ferramenta"
              value={ferramenta}
              onChange={(e) => setFerramenta(String(e.target.value))}
            >
              <MenuItem value="estoque">Estoque zerado</MenuItem>
              <MenuItem value="contagem">Contagem faltou</MenuItem>
              <MenuItem value="escala">Escala</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Seu WhatsApp"
            value={telefoneTeste}
            onChange={(e) => setTelefoneTeste(e.target.value)}
            placeholder="61 9…"
            sx={{ flex: 1, minWidth: 180 }}
          />
          <Button
            variant="outlined"
            startIcon={<SendIcon />}
            onClick={() => void enviarTeste()}
            disabled={testando}
          >
            {testando ? 'Enviando…' : 'Enviar teste'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
