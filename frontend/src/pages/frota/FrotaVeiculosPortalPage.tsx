import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import { api, type FrotaVeiculo } from '../../api/client';
import FrotaVeiculoDialog from '../../components/frota/FrotaVeiculoDialog';
import FrotaVeiculoCard from '../../components/frota/FrotaVeiculoCard';
import { colors } from '../../theme/tokens';

export default function FrotaVeiculosPortalPage() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<FrotaVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<FrotaVeiculo | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    api
      .frotaVeiculos()
      .then(setLista)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setErro('');
    setDialogAberto(true);
  }

  function abrirEditar(v: FrotaVeiculo) {
    setEditando(v);
    setErro('');
    setDialogAberto(true);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {lista.length} veículo{lista.length !== 1 ? 's' : ''} cadastrado{lista.length !== 1 ? 's' : ''}
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
          Adicionar veículo
        </Button>
      </Box>

      {erro && !dialogAberto && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : lista.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: colors.border }}>
          <DirectionsCarIcon sx={{ fontSize: 40, color: colors.textMuted, mb: 1 }} />
          <Typography color="text.secondary">Nenhum veículo cadastrado.</Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={abrirNovo}>
            Cadastrar primeiro veículo
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 240px))',
            gap: 1.5,
            justifyContent: 'flex-start',
          }}
        >
          {lista.map((v) => (
            <FrotaVeiculoCard key={v.id_veiculo} veiculo={v} onEditar={abrirEditar} />
          ))}
        </Box>
      )}

      <FrotaVeiculoDialog
        open={dialogAberto}
        veiculo={editando}
        onClose={() => setDialogAberto(false)}
        onSalvo={carregar}
      />
    </Box>
  );
}
