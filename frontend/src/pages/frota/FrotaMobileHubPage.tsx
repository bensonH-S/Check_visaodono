import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { api, fmtData } from '../../api/client';
import type { FrotaResumoMobile } from '../../api/client';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

function CardOpcao({
  titulo,
  descricao,
  icon,
  onClick,
  badge,
}: {
  titulo: string;
  descricao: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: ReactNode;
}) {
  return (
    <Paper
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        p: 2,
        mb: 1.5,
        width: '100%',
        textAlign: 'left',
        border: '1px solid rgba(27, 42, 107, 0.1)',
        borderRadius: 2,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: '#fff',
      }}
    >
      <Box sx={{ color: ORANGE, display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, color: NAVY }}>{titulo}</Typography>
          {badge}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {descricao}
        </Typography>
      </Box>
      <ArrowForwardIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />
    </Paper>
  );
}

export default function FrotaMobileHubPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<FrotaResumoMobile | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .frotaResumo()
      .then(setResumo)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box sx={{ px: 2, py: 1 }}>
      {erro && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {erro}
        </Typography>
      )}

      {resumo?.veiculo ? (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(27, 42, 107, 0.04)' }}>
          <Typography variant="overline" color="text.secondary">
            Veículo sob seu controle
          </Typography>
          <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '1.1rem' }}>
            {resumo.veiculo.placa}
            {resumo.veiculo.modelo ? ` · ${resumo.veiculo.marca || ''} ${resumo.veiculo.modelo}`.trim() : ''}
          </Typography>
          {resumo.veiculo.km_atual != null && (
            <Typography variant="body2" color="text.secondary">
              KM atual: {resumo.veiculo.km_atual.toLocaleString('pt-BR')} km
            </Typography>
          )}
        </Paper>
      ) : (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px dashed rgba(232, 82, 10, 0.4)' }}>
          <Typography variant="body2" color="text.secondary">
            Nenhum veículo atribuído. Assuma o controle na aba Veículo.
          </Typography>
        </Paper>
      )}

      <CardOpcao
        titulo="Abastecimento"
        descricao="KM atual, valor e foto do comprovante"
        icon={<LocalGasStationIcon />}
        onClick={() => navigate('/frota/mobile/abastecimento')}
      />
      <CardOpcao
        titulo="Termo de ferramentas"
        descricao="Assinatura digital e fotos dos equipamentos"
        icon={<AssignmentIcon />}
        onClick={() => navigate('/frota/mobile/termo')}
        badge={
          resumo?.termo.assinado ? (
            <Chip label="Assinado" size="small" color="success" />
          ) : (
            <Chip label="Pendente" size="small" color="warning" />
          )
        }
      />
      <CardOpcao
        titulo="Veículo"
        descricao="Assumir controle, documentos, multas e manutenção"
        icon={<DirectionsCarIcon />}
        onClick={() => navigate('/frota/mobile/veiculo')}
      />

      {!!resumo?.abastecimentos.length && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: NAVY }}>
            Últimos abastecimentos
          </Typography>
          {resumo.abastecimentos.map((a) => (
            <Typography key={a.id_abastecimento} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {fmtData(a.data_abastecimento)} · {a.km_atual.toLocaleString('pt-BR')} km · R${' '}
              {a.valor_abastecido.toFixed(2)}
            </Typography>
          ))}
        </Box>
      )}

      <Button
        fullWidth
        variant="text"
        startIcon={<BuildIcon />}
        sx={{ mt: 2 }}
        onClick={() => navigate('/frota/mobile/veiculo')}
      >
        Configuração e manutenção do carro
      </Button>
    </Box>
  );
}
