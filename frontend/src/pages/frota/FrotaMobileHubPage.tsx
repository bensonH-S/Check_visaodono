import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import { api, fmtData } from '../../api/client';
import type { FrotaResumoMobile } from '../../api/client';
import { getUsuario, logout, modoAppTecnicoFrotaRestrito } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import { showToast } from '../../utils/toast';
import FrotaVeiculoControleCard from '../../components/frota/FrotaVeiculoControleCard';
import FrotaPlusSheet from '../../components/frota/FrotaPlusSheet';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import AppHubDock from '../../components/hub/AppHubDock';
import '../../components/estoque/estoque-hub.css';
import '../../components/frota/frota-mobile.css';

export default function FrotaMobileHubPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const modoRestrito = modoAppTecnicoFrotaRestrito(user);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<FrotaResumoMobile | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [plusAberto, setPlusAberto] = useState(false);

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
    : 'Nenhum veículo atribuído. Toque no + para assumir um veículo e liberar as operações.';
  const placa = resumo?.veiculo?.placa ?? '—';
  const kmLabel =
    resumo?.veiculo?.km_atual != null
      ? resumo.veiculo.km_atual.toLocaleString('pt-BR')
      : '—';

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-frota-hub"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
          <div className="ck-estoque-hub__actions">
            <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
            <MobileUsuarioMenu
              user={user}
              onLogout={() => {
                logout();
                navigate('/login/mobile');
              }}
            />
          </div>
        </div>

        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>Frota</h1>
            <span className="ck-frota-hub__placa">{placa}</span>
          </div>
          <p className="ck-frota-hub__sub">
            {loading
              ? 'Carregando resumo do veículo…'
              : temVeiculo
                ? 'Abastecimento, manutenção e controle do veículo sob sua responsabilidade.'
                : 'Assuma um veículo ou aguarde a atribuição para liberar as operações.'}
          </p>
        </div>
      </header>

      <div className="ck-estoque-hub__panel">
        {!loading && (
          <div className="ck-frota-hub__kpis" aria-live="polite">
            <div className={`ck-frota-hub__kpi${temVeiculo ? ' is-on' : ''}`}>
              <strong>{placa}</strong>
              <span>Placa</span>
            </div>
            <div className="ck-frota-hub__kpi">
              <strong>{kmLabel}</strong>
              <span>KM atual</span>
            </div>
            <div className="ck-frota-hub__kpi">
              <strong>{resumo?.abastecimentos.length ?? 0}</strong>
              <span>Abastec.</span>
            </div>
          </div>
        )}
      </div>

      <div className="ck-estoque-hub__scroll ck-frota-hub__scroll">
        {loading ? (
          <LinearProgress
            sx={{
              my: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : (
          <>
            {erro ? <p className="ck-frota-hub__err">{erro}</p> : null}

            {resumo?.veiculo ? (
              <div className="ck-frota-hub__card-wrap">
                <FrotaVeiculoControleCard
                  veiculo={resumo.veiculo}
                  salvando={salvando}
                  permitirDevolver={!modoRestrito}
                  temaEscuro
                  onDesassumir={modoRestrito ? undefined : (km) => void desassumir(km)}
                />
              </div>
            ) : (
              <div className="ck-frota-hub__empty-card">{msgSemVeiculo}</div>
            )}

            {!!resumo?.abastecimentos.length && (
              <div className="ck-frota-hub__hist">
                <p className="ck-frota-hub__label">Últimos abastecimentos</p>
                {resumo.abastecimentos.map((a) => (
                  <p key={a.id_abastecimento} className="ck-frota-hub__hist-row">
                    {fmtData(a.data_abastecimento)} · {a.km_atual.toLocaleString('pt-BR')} km · R${' '}
                    {a.valor_abastecido.toFixed(2)}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AppHubDock
        ativo={null}
        plusLabel="Operações"
        plusDisabled={loading}
        onPlus={() => setPlusAberto(true)}
      />

      <FrotaPlusSheet
        open={plusAberto}
        onClose={() => setPlusAberto(false)}
        temVeiculo={temVeiculo}
        termoAssinado={resumo?.termo.assinado}
      />
    </div>
  );
}
