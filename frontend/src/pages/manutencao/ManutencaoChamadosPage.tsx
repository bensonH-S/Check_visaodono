import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';

const STATUS: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export default function ManutencaoChamadosPage() {
  const navigate = useNavigate();
  const sessao = getUsuario();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [assumindo, setAssumindo] = useState<number | null>(null);

  async function assumir(id: number) {
    setAssumindo(id);
    try {
      await api.manutAssumirChamado(id);
      const atual = await api.manutChamados();
      setLista(atual);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao assumir');
    } finally {
      setAssumindo(null);
    }
  }

  useEffect(() => {
    api
      .manutChamados()
      .then(setLista)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box className="flex justify-center py-16">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="max-w-3xl mx-auto w-full">
      <Box className="flex justify-between items-center mb-4 gap-2">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Chamados
        </Typography>
        {sessao && temPermissao('chamados.abrir', sessao) && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/chamados/novo')}
            className="hidden md:inline-flex"
          >
            Novo
          </Button>
        )}
      </Box>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      {!lista.length && !erro && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            Nenhum chamado ainda.
          </Typography>
          {sessao && temPermissao('chamados.abrir', sessao) && (
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/chamados/novo')}>
              Abrir primeiro chamado
            </Button>
          )}
        </Paper>
      )}

      <Box className="flex flex-col gap-3">
        {lista.map((c) => (
          <Paper key={c.id_chamado} sx={{ p: 2 }}>
            <Box className="flex justify-between gap-2 mb-1">
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                #{c.numero}
              </Typography>
              <Chip label={c.urgencia} size="small" color={c.urgencia === 'critica' || c.urgencia === 'alta' ? 'error' : 'default'} />
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {c.titulo}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {c.categoria} · {c.loja}
              {c.total_fotos > 0 ? ` · ${c.total_fotos} foto(s)` : ''}
            </Typography>
            <Box className="flex gap-1 mt-2 flex-wrap items-center">
              <Chip label={STATUS[c.status] || c.status} size="small" variant="outlined" />
              <Chip
                label={`SLA ${new Date(c.prazo_sla).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                size="small"
                variant="outlined"
              />
              {c.status === 'aberto' && sessao && temPermissao('chamados.assumir', sessao) && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={assumindo === c.id_chamado}
                    onClick={() => assumir(c.id_chamado)}
                  >
                    {assumindo === c.id_chamado ? '...' : 'Assumir'}
                  </Button>
                )}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
