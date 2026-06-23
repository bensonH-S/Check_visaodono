import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api, fetchMediaAutenticada, type FrotaAbastecimentoPortal } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

export default function FrotaCombustivelPortalPage() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<FrotaAbastecimentoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    api
      .frotaAbastecimentosPortal()
      .then(setLista)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirComprovante(url: string) {
    try {
      const path = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      const blob = await fetchMediaAutenticada(path);
      window.open(blob, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore */
    }
  }

  const total = lista.reduce((s, a) => s + a.valor_abastecido, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {lista.length} abastecimento{lista.length !== 1 ? 's' : ''}
          {lista.length > 0 && ` · Total R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
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
          Nenhum abastecimento registrado.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {lista.map((a) => (
            <Paper
              key={a.id_abastecimento}
              elevation={0}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: colors.border,
                borderLeft: `4px solid ${colors.navy}`,
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700 }}>{a.placa}</Typography>
                <Typography sx={{ fontWeight: 700, color: colors.navy }}>
                  R$ {a.valor_abastecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {a.nome_usuario} · KM {a.km_atual.toLocaleString('pt-BR')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {formatDataHoraBrasilia(a.data_abastecimento)}
              </Typography>
              {a.comprovante_url && (
                <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => void abrirComprovante(a.comprovante_url!)}>
                  Ver comprovante
                </Button>
              )}
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
