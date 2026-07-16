import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { api, fmtData } from '../../api/client';
import type { FrotaResumoMobile } from '../../api/client';
import { getUsuario, modoAppTecnicoFrotaRestrito, podeAssinarTermoFerramentasMobile } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA } from '../../theme/safeArea';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

function CardOpcao({
  titulo,
  descricao,
  icon,
  onClick,
  badge,
  disabled,
}: {
  titulo: string;
  descricao: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Paper
      component="button"
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      sx={{
        p: 2,
        mb: 1.5,
        width: '100%',
        textAlign: 'left',
        border: '1px solid rgba(27, 42, 107, 0.1)',
        borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: disabled ? 'rgba(0,0,0,0.02)' : '#fff',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <Box sx={{ color: disabled ? 'text.disabled' : ORANGE, display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, color: disabled ? 'text.disabled' : NAVY }}>{titulo}</Typography>
          {badge}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {descricao}
        </Typography>
      </Box>
      {!disabled && <ArrowForwardIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />}
    </Paper>
  );
}

export default function FrotaMobileHubPage() {
  const navigate = useNavigate();
  const sessao = getUsuario();
  const modoRestrito = modoAppTecnicoFrotaRestrito(sessao);
  const exibeTermoFerramentas = !modoRestrito && podeAssinarTermoFerramentasMobile(sessao);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<FrotaResumoMobile | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const r = await api.frotaResumo();
    setResumo(r);
    return r;
  }

  useEffect(() => {
    carregar()
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  async function desassumir(kmAtual: number) {
    setSalvando(true);
    setErro('');
    try {
      await api.frotaDesassumirVeiculo(kmAtual);
      await carregar();
      showToast('Carro devolvido com sucesso!', 'success');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao desassumir veículo');
    } finally {
      setSalvando(false);
    }
  }

  const temVeiculo = Boolean(resumo?.veiculo);
  const msgSemVeiculo = modoRestrito
    ? 'Nenhum veículo atribuído. Peça ao responsável para atribuir pelo portal.'
    : 'Nenhum veículo atribuído. Assuma o controle na aba Veículo para liberar abastecimento e manutenção.';
  const msgAbastecimento = temVeiculo
    ? 'KM, valor (R$) e foto da nota fiscal'
    : modoRestrito
      ? 'Aguarde a atribuição do veículo no portal'
      : 'Assuma um veículo para registrar abastecimento';
  const msgManutencao = temVeiculo
    ? 'Registrar serviços, descrição do que foi feito e fatura'
    : 'Assuma um veículo para registrar manutenção';

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box sx={{ ...MOBILE_PAGE_COLUMN, maxWidth: 480, mx: 'auto', width: '100%' }}>
      <Box sx={{ flexShrink: 0, py: 1 }}>
        {erro && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {erro}
          </Typography>
        )}

        {resumo?.veiculo ? (
          <FrotaVeiculoControleCard
            veiculo={resumo.veiculo}
            salvando={salvando}
            permitirDevolver={!modoRestrito}
            onDesassumir={modoRestrito ? undefined : (km) => void desassumir(km)}
          />
        ) : (
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px dashed rgba(232, 82, 10, 0.4)' }}>
            <Typography variant="body2" color="text.secondary">
              {msgSemVeiculo}
            </Typography>
          </Paper>
        )}
      </Box>

      <Box sx={{ ...MOBILE_SCROLL_AREA, py: 1, pt: 0 }}>
      <CardOpcao
        titulo="Abastecimento"
        descricao={msgAbastecimento}
        icon={<LocalGasStationIcon />}
        onClick={() => navigate('/frota/mobile/abastecimento')}
        disabled={!temVeiculo}
      />
      {exibeTermoFerramentas && (
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
      )}
      {!modoRestrito && (
        <CardOpcao
          titulo="Veículo"
          descricao="Assumir controle com CNH e fotos do veículo"
          icon={<DirectionsCarIcon />}
          onClick={() => navigate('/frota/mobile/veiculo')}
        />
      )}
      {!modoRestrito && (
        <CardOpcao
          titulo="Manutenção do veículo"
          descricao={msgManutencao}
          icon={<BuildIcon />}
          onClick={() => navigate('/frota/mobile/manutencao')}
          disabled={!temVeiculo}
        />
      )}

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
      </Box>
    </Box>
  );
}
