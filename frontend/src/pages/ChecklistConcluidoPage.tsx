import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';
import { api, fmtNota, fmtData, scoreColor } from '../api/client';

export default function ChecklistConcluidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [visita, setVisita] = useState<{
    name: string;
    bk_number: string | null;
    nome_usuario: string;
    data_visita: string;
    nota_final: string | number | null;
    status: string;
  } | null>(null);
  const [categorias, setCategorias] = useState<Array<{ categoria: string; percentual: string }>>([]);

  useEffect(() => {
    if (!id) return;
    api
      .visita(Number(id))
      .then((d) => {
        setVisita(d.visita);
        setCategorias(d.desempenho_categorias);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (err || !visita) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{err || 'Visita não encontrada'}</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/checklist')}>
          Voltar
        </Button>
      </Box>
    );
  }

  const nota = Number(visita.nota_final ?? 0);
  const corNota = scoreColor(nota);

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        px: 2,
        py: 3,
        pb: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: '#EAF3DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
          Visita finalizada!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {visita.name}
          {visita.bk_number ? ` · BKN ${visita.bk_number}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {fmtData(visita.data_visita)} · {visita.nome_usuario} · #{id}
        </Typography>
      </Box>

      <Paper
        sx={{
          p: 3,
          mb: 2,
          borderRadius: 3,
          textAlign: 'center',
          background: `linear-gradient(145deg, ${corNota}18 0%, #fff 60%)`,
          border: `2px solid ${corNota}`,
        }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
          Nota da avaliação
        </Typography>
        <Typography
          variant="h2"
          sx={{ fontWeight: 800, color: corNota, lineHeight: 1.1, my: 0.5 }}
        >
          {fmtNota(visita.nota_final)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {nota >= 85
            ? 'Excelente desempenho operacional'
            : nota >= 75
              ? 'Desempenho dentro da meta, com pontos de atenção'
              : 'Atenção: resultado abaixo da meta'}
        </Typography>
      </Paper>

      {categorias.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Por seção
          </Typography>
          {categorias.map((c) => {
            const pct = Number(c.percentual);
            return (
              <Box key={c.categoria} sx={{ mb: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {c.categoria}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {c.percentual}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: pct >= 80 ? '#3B6D11' : pct >= 60 ? '#E8520A' : '#1B2A6B',
                    },
                  }}
                />
              </Box>
            );
          })}
        </Paper>
      )}

      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<DescriptionIcon />}
          onClick={() => navigate(`/relatorio/visita/${id}`)}
          sx={{ minHeight: 52 }}
        >
          Ver relatório completo
        </Button>
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => navigate('/checklist', { state: { reiniciar: true } })}
          sx={{ minHeight: 48 }}
        >
          Nova visita
        </Button>
        <Button
          fullWidth
          color="inherit"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
        >
          Voltar ao início
        </Button>
      </Box>
    </Box>
  );
}
