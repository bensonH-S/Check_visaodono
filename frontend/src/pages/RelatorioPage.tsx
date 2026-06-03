import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import { api, fmtNota, fmtData } from '../api/client';
import type { VisitaDetalhe } from '../api/client';

export default function RelatorioPage() {
  const { id } = useParams();
  const [data, setData] = useState<VisitaDetalhe | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .visita(Number(id))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <LinearProgress />;

  const v = data.visita;
  const nota = Number(v.nota_final);
  const anterior = data.historico_notas[1];
  const diff = anterior ? nota - Number(anterior.nota) : null;

  return (
    <Box>
      <Paper className="p-4 mb-4 flex flex-wrap gap-4 items-start">
        <Box
          className="w-20 h-20 rounded-full border-[3px] border-[#E8520A] flex flex-col items-center justify-center shrink-0"
          sx={{ bgcolor: '#FFF0E8' }}
        >
          <Typography variant="h5" color="primary" sx={{ fontWeight: 600 }}>
            {fmtNota(v.nota_final)}
          </Typography>
          <Typography variant="caption" color="primary">
            nota
          </Typography>
        </Box>
        <Box className="flex-1">
          <Typography variant="h6">
            {v.name} · BKN {v.bk_number || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fmtData(v.data_visita)} · {v.city}/{v.state} · {v.neighborhood}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Auditor: {v.nome_usuario} · Status: {v.status}
          </Typography>
          <Box className="flex gap-2 mt-2 flex-wrap">
            {anterior && (
              <Chip
                size="small"
                label={`Anterior: ${fmtNota(anterior.nota)} (${fmtData(anterior.data_registro)})`}
                variant="outlined"
                color="secondary"
              />
            )}
            {diff != null && (
              <Chip
                size="small"
                label={`${diff >= 0 ? '+' : ''}${diff.toFixed(0)}p`}
                color={diff >= 0 ? 'success' : 'error'}
              />
            )}
          </Box>
        </Box>
      </Paper>

      <Paper className="p-4 mb-4">
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Desempenho por categoria
        </Typography>
        {data.desempenho_categorias.map((c) => (
          <Box key={c.categoria} className="flex items-center gap-3 mb-2">
            <Typography variant="caption" className="w-36 text-right shrink-0">
              {c.categoria}
            </Typography>
            <Box className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <Box
                className="h-full rounded flex items-center justify-end pr-2 text-xs text-white font-medium"
                sx={{
                  width: `${c.percentual}%`,
                  bgcolor: Number(c.percentual) >= 80 ? '#639922' : Number(c.percentual) >= 60 ? '#E8520A' : '#1B2A6B',
                  minWidth: c.percentual ? '40px' : 0,
                }}
              >
                {c.percentual}%
              </Box>
            </Box>
          </Box>
        ))}
        {!data.desempenho_categorias.length && (
          <Typography color="text.secondary">Sem respostas registradas.</Typography>
        )}
      </Paper>

      {data.nao_conformidades.length > 0 && (
        <Paper className="p-4">
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Não conformidades vinculadas
          </Typography>
          {data.nao_conformidades.map((nc, i) => (
            <Typography key={i} variant="body2" sx={{ py: 0.5 }}>
              [{nc.gravidade}] {nc.area}: {nc.descricao}
            </Typography>
          ))}
        </Paper>
      )}
    </Box>
  );
}
