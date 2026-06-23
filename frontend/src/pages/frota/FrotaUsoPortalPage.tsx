import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api, type FrotaAssuncao, type FrotaVeiculo } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

export default function FrotaUsoPortalPage() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [assuncoes, setAssuncoes] = useState<FrotaAssuncao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([api.frotaVeiculos(), api.frotaAssuncoes()])
      .then(([v, a]) => {
        setVeiculos(v);
        setAssuncoes(a);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const emUso = veiculos.filter((v) => v.id_usuario_responsavel);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {emUso.length} veículo{emUso.length !== 1 ? 's' : ''} em uso agora
        </Typography>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Em uso no momento
          </Typography>
          {emUso.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Nenhum veículo assumido no momento.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
              {emUso.map((v) => (
                <Paper
                  key={v.id_veiculo}
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
                    <Typography sx={{ fontWeight: 700 }}>{v.placa}</Typography>
                    <Chip label="Em uso" size="small" color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Responsável: <strong>{v.nome_responsavel}</strong>
                  </Typography>
                  {v.assuncao_em && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Desde {formatDataHoraBrasilia(v.assuncao_em)}
                      {v.km_atual != null ? ` · KM ${v.km_atual.toLocaleString('pt-BR')}` : ''}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          )}

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Histórico de assunções
          </Typography>
          {assuncoes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum registro de assunção.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {assuncoes.map((a) => (
                <Paper
                  key={a.id_assuncao}
                  elevation={0}
                  sx={{ p: 1.5, border: '1px solid', borderColor: colors.border, borderRadius: 1.5 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {a.placa} · {a.nome_usuario}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Início: {formatDataHoraBrasilia(a.data_inicio)}
                    {a.data_fim ? ` · Fim: ${formatDataHoraBrasilia(a.data_fim)}` : ' · Em andamento'}
                    {a.km_inicio != null ? ` · KM início ${a.km_inicio.toLocaleString('pt-BR')}` : ''}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
