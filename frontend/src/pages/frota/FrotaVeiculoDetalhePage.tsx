import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { api, type FrotaVeiculo } from '../../api/client';
import FrotaVeiculoDialog from '../../components/frota/FrotaVeiculoDialog';
import FrotaVeiculoDocumentosPanel from '../../components/frota/FrotaVeiculoDocumentosPanel';
import FrotaVeiculoKmPanel from '../../components/frota/FrotaVeiculoKmPanel';
import FrotaVeiculoAbasEdicao from '../../components/frota/FrotaVeiculoAbasEdicao';
import { periodoSemanaAtualKm } from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { showToast } from '../../utils/toast';

export default function FrotaVeiculoDetalhePage() {
  const { id } = useParams();
  const idVeiculo = Number(id);
  const navigate = useNavigate();

  const [aba, setAba] = useState(0);
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [qtdDocumentos, setQtdDocumentos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editAberto, setEditAberto] = useState(false);
  const [kmDataInicio, setKmDataInicio] = useState(() => periodoSemanaAtualKm().inicio);
  const [kmDataFim, setKmDataFim] = useState(() => periodoSemanaAtualKm().fim);

  const carregar = useCallback(() => {
    if (!Number.isFinite(idVeiculo)) return;
    setLoading(true);
    Promise.all([api.frotaVeiculo(idVeiculo), api.frotaDocumentos(idVeiculo)])
      .then(([v, docs]) => {
        setVeiculo(v);
        setQtdDocumentos(docs.length);
      })
      .catch((e) => showToast(e instanceof Error ? e.message : 'Erro ao carregar', 'error'))
      .finally(() => setLoading(false));
  }, [idVeiculo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!Number.isFinite(idVeiculo)) {
    return <Alert severity="error">Veículo inválido</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (!veiculo) {
    return (
      <Alert severity="error">
        Veículo não encontrado.{' '}
        <Button size="small" onClick={() => navigate('/frota/operacao?aba=cadastro')}>
          Voltar
        </Button>
      </Alert>
    );
  }

  const titulo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo';

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/frota/operacao?aba=cadastro')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Chip label={veiculo.placa} size="small" sx={{ mt: 0.5, fontWeight: 700 }} />
        </Box>
        {aba === 0 && (
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditAberto(true)}>
            Editar
          </Button>
        )}
      </Box>

      <FrotaVeiculoAbasEdicao
        semPadding
        aba={aba}
        onChangeAba={setAba}
        labelDocumentos={`Documentos (${qtdDocumentos})`}
        kmDataInicio={kmDataInicio}
        kmDataFim={kmDataFim}
        onChangeKmInicio={setKmDataInicio}
        onChangeKmFim={setKmDataFim}
      />

      <Box sx={{ display: aba === 0 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            Identificação
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
            <Info label="Placa" value={veiculo.placa} />
            <Info label="RENAVAM" value={veiculo.renavam || '—'} />
            <Info label="Chassi" value={veiculo.chassi || '—'} />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            Dados do veículo
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
            <Info label="Marca" value={veiculo.marca || '—'} />
            <Info label="Modelo" value={veiculo.modelo || '—'} />
            <Info label="Ano" value={veiculo.ano ? String(veiculo.ano) : '—'} />
            <Info label="Cor" value={veiculo.cor || '—'} />
            <Info label="Combustível" value={veiculo.combustivel || '—'} />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            Uso e observações
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <Info label="Responsável" value={veiculo.nome_responsavel || 'Sem responsável'} />
            <Info
              label="Atribuição"
              value={veiculo.assuncao_em ? formatDataHoraBrasilia(veiculo.assuncao_em) : '—'}
            />
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <Info label="Observações" value={veiculo.observacoes || '—'} />
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: aba === 1 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          <FrotaVeiculoKmPanel
            idVeiculo={veiculo.id_veiculo}
            ocultarFiltro
            dataInicio={kmDataInicio}
            dataFim={kmDataFim}
            onChangeInicio={setKmDataInicio}
            onChangeFim={setKmDataFim}
          />
        </Paper>
      </Box>

      <Box sx={{ display: aba === 2 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          <FrotaVeiculoDocumentosPanel
            idVeiculo={veiculo.id_veiculo}
            onDocumentosChange={setQtdDocumentos}
          />
        </Paper>
      </Box>

      <FrotaVeiculoDialog
        open={editAberto}
        veiculo={veiculo}
        onClose={() => setEditAberto(false)}
        onSalvo={carregar}
      />
    </Box>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
