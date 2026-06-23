import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api, type FrotaManutencaoPortal } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export default function FrotaManutencaoPortalPage() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<FrotaManutencaoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    api
      .frotaManutencoesPortal()
      .then(setLista)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {lista.length} manutenção{lista.length !== 1 ? 'ões' : ''} registrada{lista.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : lista.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma manutenção registrada.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {lista.map((m) => (
            <Paper
              key={m.id_manutencao}
              elevation={0}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: colors.border,
                borderLeft: `4px solid ${colors.navy}`,
                borderRadius: 2,
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                {m.placa} · {m.descricao}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.nome_usuario}
                {m.km != null ? ` · KM ${m.km.toLocaleString('pt-BR')}` : ''}
                {m.valor != null ? ` · R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Realizada em {fmtData(m.data_manutencao)}
                {m.proxima_manutencao ? ` · Próxima ${fmtData(m.proxima_manutencao)}` : ''}
                {' · '}
                Registrado {formatDataHoraBrasilia(m.created_at)}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
