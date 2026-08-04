import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { api, fmtData } from '../../api/client';
import type { FrotaResumoMobile } from '../../api/client';
import { getUsuario, modoAppTecnicoFrotaRestrito, podeAssinarTermoFerramentasMobile } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import FrotaMobileShell from '../../components/frota/FrotaMobileShell';

function TileOpcao({
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
    <button type="button" className="ck-frota__tile" onClick={onClick} disabled={disabled}>
      <span className="ck-frota__tile-mono" aria-hidden>
        {icon}
      </span>
      <span className="ck-frota__tile-copy">
        <strong>
          {titulo}
          {badge}
        </strong>
        <small>{descricao}</small>
      </span>
      {!disabled && (
        <span className="ck-frota__tile-go" aria-hidden>
          ›
        </span>
      )}
    </button>
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
    : modoRestrito
      ? 'Aguarde a atribuição do veículo no portal'
      : 'Assuma um veículo para registrar manutenção';
  const placa = resumo?.veiculo?.placa ?? '—';
  const kmLabel =
    resumo?.veiculo?.km_atual != null
      ? resumo.veiculo.km_atual.toLocaleString('pt-BR')
      : '—';

  if (loading) {
    return (
      <FrotaMobileShell
        titleLine1="Sua frota"
        sub="Carregando resumo do veículo…"
        variant="hub"
      >
        <LinearProgress />
      </FrotaMobileShell>
    );
  }

  return (
    <FrotaMobileShell
      titleLine1="Sua frota"
      sub={
        temVeiculo
          ? 'Abastecimento, manutenção e controle do veículo sob sua responsabilidade.'
          : 'Assuma um veículo ou aguarde a atribuição para liberar as operações.'
      }
      variant="hub"
      metrics={[
        { value: placa, label: 'placa', accent: temVeiculo },
        { value: kmLabel, label: 'km atual' },
        {
          value: resumo?.abastecimentos.length ?? 0,
          label: 'abastec.',
        },
      ]}
    >
      {erro && (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 12px' }}>
          {erro}
        </p>
      )}

      {resumo?.veiculo ? (
        <FrotaVeiculoControleCard
          veiculo={resumo.veiculo}
          salvando={salvando}
          permitirDevolver={!modoRestrito}
          onDesassumir={modoRestrito ? undefined : (km) => void desassumir(km)}
        />
      ) : (
        <div
          className="ck-frota__form-card"
          style={{
            borderStyle: 'dashed',
            borderColor: 'rgba(232, 82, 10, 0.4)',
            background: 'rgba(232, 82, 10, 0.04)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(20, 32, 72, 0.65)', lineHeight: 1.4 }}>
            {msgSemVeiculo}
          </p>
        </div>
      )}

      <p className="ck-frota__sheet-label" style={{ marginTop: 4 }}>
        Operações
      </p>

      <TileOpcao
        titulo="Abastecimento"
        descricao={msgAbastecimento}
        icon={<LocalGasStationIcon />}
        onClick={() => navigate('/frota/mobile/abastecimento')}
        disabled={!temVeiculo}
      />
      {exibeTermoFerramentas && (
        <TileOpcao
          titulo="Termo de ferramentas"
          descricao="Assinatura digital e fotos dos equipamentos"
          icon={<AssignmentIcon />}
          onClick={() => navigate('/frota/mobile/termo')}
          badge={
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: resumo?.termo.assinado
                  ? 'rgba(46, 125, 50, 0.12)'
                  : 'rgba(237, 108, 2, 0.14)',
                color: resumo?.termo.assinado ? '#2e7d32' : '#ed6c02',
              }}
            >
              {resumo?.termo.assinado ? 'Assinado' : 'Pendente'}
            </span>
          }
        />
      )}
      {!modoRestrito && (
        <TileOpcao
          titulo="Veículo"
          descricao="Assumir controle com CNH e fotos do veículo"
          icon={<DirectionsCarIcon />}
          onClick={() => navigate('/frota/mobile/veiculo')}
        />
      )}
      <TileOpcao
        titulo="Manutenção do veículo"
        descricao={msgManutencao}
        icon={<BuildIcon />}
        onClick={() => navigate('/frota/mobile/manutencao')}
        disabled={!temVeiculo}
      />

      {!!resumo?.abastecimentos.length && (
        <div style={{ marginTop: 16 }}>
          <p className="ck-frota__sheet-label">Últimos abastecimentos</p>
          {resumo.abastecimentos.map((a) => (
            <p
              key={a.id_abastecimento}
              style={{
                margin: '0 0 6px',
                fontSize: '0.8rem',
                color: 'rgba(20, 32, 72, 0.55)',
                fontWeight: 500,
              }}
            >
              {fmtData(a.data_abastecimento)} · {a.km_atual.toLocaleString('pt-BR')} km · R${' '}
              {a.valor_abastecido.toFixed(2)}
            </p>
          ))}
        </div>
      )}
    </FrotaMobileShell>
  );
}
