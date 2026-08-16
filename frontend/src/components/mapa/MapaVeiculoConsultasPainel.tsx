import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import AltRouteOutlinedIcon from '@mui/icons-material/AltRouteOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import {
  api,
  fmtData,
  type FrotaAbastecimentoPortal,
  type FrotaManutencaoPortal,
  type FrotaMultaDetran,
  type FrotaRegistroVelocidade,
  type FrotaVeiculoPosicao,
} from '../../api/client';
import { colors } from '../../theme/tokens';
import { getUsuario, temPermissao } from '../../lib/auth';
import { rotuloStatusVeiculoMapa, statusVeiculoMapa, textoAtualizadoRelativo } from '../frota/frotaMapaVeiculo';
import type { PassagemLojaResumo } from '../../utils/frotaPassagensLoja';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

export type AbaConsultaVeiculo = 'trajeto' | 'multas' | 'combustivel' | 'manutencao';

function fmtBRL(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function podeConsultarOperacaoFrota() {
  const u = getUsuario();
  return (
    temPermissao('frota.gerenciar', u) ||
    temPermissao('lojas.todas', u) ||
    temPermissao('frota.regioes', u)
  );
}

function corStatusMulta(status: FrotaMultaDetran['status']) {
  if (status === 'Paga') return { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803d' };
  if (status === 'Vencida') return { bg: 'rgba(220, 38, 38, 0.12)', fg: '#b91c1c' };
  return { bg: 'rgba(232, 82, 10, 0.12)', fg: colors.orange };
}

type Props = {
  titulo: string;
  subtitulo?: string;
  veiculoAoVivo?: FrotaVeiculoPosicao | null;
  idVeiculo: number;
  excessos: FrotaRegistroVelocidade[];
  passagensLoja: PassagemLojaResumo[];
  limiteKmh: number;
  consultouTrajeto: boolean;
  onClose: () => void;
};

export default function MapaVeiculoConsultasPainel({
  titulo,
  subtitulo,
  veiculoAoVivo,
  idVeiculo,
  excessos,
  passagensLoja,
  limiteKmh,
  consultouTrajeto,
  onClose,
}: Props) {
  const podeOperacao = podeConsultarOperacaoFrota();
  const [aba, setAba] = useState<AbaConsultaVeiculo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [multas, setMultas] = useState<FrotaMultaDetran[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<FrotaAbastecimentoPortal[]>([]);
  const [manutencoes, setManutencoes] = useState<FrotaManutencaoPortal[]>([]);

  const statusAoVivo = veiculoAoVivo
    ? rotuloStatusVeiculoMapa(statusVeiculoMapa(veiculoAoVivo, veiculoAoVivo.rastreamento_disponivel !== false))
    : null;

  useEffect(() => {
    setAba(null);
    setErro('');
    setMultas([]);
    setAbastecimentos([]);
    setManutencoes([]);
  }, [idVeiculo]);

  useEffect(() => {
    if (!aba || aba === 'trajeto' || !podeOperacao) return;
    let cancelado = false;
    setCarregando(true);
    setErro('');

    const job =
      aba === 'multas'
        ? api.frotaMultasDetran(idVeiculo).then((r) => {
            if (!cancelado) setMultas(r.multas ?? []);
          })
        : aba === 'combustivel'
          ? api.frotaAbastecimentosPortal().then((lista) => {
              if (!cancelado) {
                setAbastecimentos(lista.filter((a) => Number(a.id_veiculo) === idVeiculo).slice(0, 40));
              }
            })
          : api.frotaManutencoesPortal().then((lista) => {
              if (!cancelado) {
                setManutencoes(lista.filter((m) => Number(m.id_veiculo) === idVeiculo).slice(0, 40));
              }
            });

    void job
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aba, idVeiculo, podeOperacao]);

  const abas = useMemo(
    () =>
      [
        { id: 'trajeto' as const, rotulo: 'Trajeto', icon: <AltRouteOutlinedIcon /> },
        { id: 'multas' as const, rotulo: 'Multas', icon: <GavelOutlinedIcon /> },
        { id: 'combustivel' as const, rotulo: 'Combustível', icon: <LocalGasStationOutlinedIcon /> },
        { id: 'manutencao' as const, rotulo: 'Manutenção', icon: <BuildOutlinedIcon /> },
      ].filter((item) => item.id === 'trajeto' || podeOperacao),
    [podeOperacao],
  );

  return (
    <div className={`ck-mapa__ficha${aba ? ' is-aberto' : ''}`}>
      <div className="ck-mapa__ficha-handle" aria-hidden />
      <div className="ck-mapa__ficha-head">
        <div className="ck-mapa__ficha-avatar" aria-hidden>
          <DirectionsCarFilledOutlinedIcon />
        </div>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: colors.navy, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {[
              statusAoVivo,
              veiculoAoVivo?.velocidade != null ? `${veiculoAoVivo.velocidade} km/h` : null,
              veiculoAoVivo?.atualizado_em ? textoAtualizadoRelativo(veiculoAoVivo.atualizado_em) : subtitulo,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Fechar veículo">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      <div className="ck-mapa__ficha-acoes">
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ck-mapa__ficha-acao${aba === item.id ? ' is-on' : ''}`}
            onClick={() => setAba((atual) => (atual === item.id ? null : item.id))}
          >
            <span className="ck-mapa__ficha-acao-ico">{item.icon}</span>
            <span>{item.rotulo}</span>
          </button>
        ))}
      </div>

      {aba && (
        <div className="ck-mapa__ficha-body">
          {carregando && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={26} />
            </Box>
          )}
          {!carregando && erro && (
            <Typography variant="body2" color="error" sx={{ px: 0.5, py: 2, textAlign: 'center' }}>
              {erro}
            </Typography>
          )}
          {!carregando && !erro && aba === 'trajeto' && (
            <TrajetoBloco
              excessos={excessos}
              passagensLoja={passagensLoja}
              limiteKmh={limiteKmh}
              consultou={consultouTrajeto}
            />
          )}
          {!carregando && !erro && aba === 'multas' && <ListaMultas itens={multas} />}
          {!carregando && !erro && aba === 'combustivel' && <ListaAbastecimentos itens={abastecimentos} />}
          {!carregando && !erro && aba === 'manutencao' && <ListaManutencoes itens={manutencoes} />}
        </div>
      )}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2.5, px: 1 }}>
      {texto}
    </Typography>
  );
}

function Cartao({ children }: { children: ReactNode }) {
  return <div className="ck-mapa__ficha-card">{children}</div>;
}

function TrajetoBloco({
  excessos,
  passagensLoja,
  limiteKmh,
  consultou,
}: {
  excessos: FrotaRegistroVelocidade[];
  passagensLoja: PassagemLojaResumo[];
  limiteKmh: number;
  consultou: boolean;
}) {
  return (
    <>
      <p className="ck-mapa__resumo-sec-title">Excessos · acima de {limiteKmh} km/h</p>
      {excessos.length ? (
        excessos.slice(0, 12).map((r, idx) => (
          <div key={`${r.atualizado_em ?? idx}-${r.velocidade}`} className="ck-mapa__resumo-linha">
            <span>{r.atualizado_em ? formatDataHoraBrasilia(r.atualizado_em).split(',').pop()?.trim() : '—'}</span>
            <strong>
              {r.velocidade} km/h <span style={{ color: colors.orange }}>+{r.velocidade - r.limite}</span>
            </strong>
          </div>
        ))
      ) : (
        <Vazio texto={consultou ? 'Nenhum excesso neste período.' : 'Consulte o histórico para ver o trajeto.'} />
      )}
      <p className="ck-mapa__resumo-sec-title" style={{ marginTop: 12 }}>
        Lojas visitadas
      </p>
      {passagensLoja.length ? (
        passagensLoja.map((item) => (
          <div key={item.id_loja} className="ck-mapa__resumo-loja">
            <img src={iconeMarcaLojaPorNome({ name: item.nome })} alt="" width={28} height={28} />
            <span>{item.nome}</span>
            <strong>{item.passagens}x</strong>
          </div>
        ))
      ) : (
        <Vazio texto={consultou ? 'Nenhuma passagem perto de lojas.' : 'As lojas aparecem após consultar o trajeto.'} />
      )}
    </>
  );
}

function ListaMultas({ itens }: { itens: FrotaMultaDetran[] }) {
  if (!itens.length) return <Vazio texto="Nenhuma multa no cache DETRAN para este veículo." />;
  return (
    <>
      {itens.map((m) => {
        const tom = corStatusMulta(m.status);
        return (
          <Cartao key={m.id_multa_detran}>
            <div className="ck-mapa__ficha-card-top">
              <strong>{fmtData(m.data_multa)}</strong>
              <span className="ck-mapa__ficha-badge" style={{ background: tom.bg, color: tom.fg }}>
                {m.status}
              </span>
            </div>
            <p className="ck-mapa__ficha-card-title">{m.descricao || m.auto || 'Infração'}</p>
            <p className="ck-mapa__ficha-card-meta">
              {[m.local_infracao, m.pontos != null ? `${m.pontos} pts` : null, m.natureza]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="ck-mapa__ficha-card-valor">{fmtBRL(m.valor)}</p>
          </Cartao>
        );
      })}
    </>
  );
}

function ListaAbastecimentos({ itens }: { itens: FrotaAbastecimentoPortal[] }) {
  if (!itens.length) return <Vazio texto="Nenhum abastecimento registrado neste veículo." />;
  return (
    <>
      {itens.map((a) => (
        <Cartao key={a.id_abastecimento}>
          <div className="ck-mapa__ficha-card-top">
            <strong>{fmtData(a.data_abastecimento)}</strong>
            <span className="ck-mapa__ficha-badge" style={{ background: 'rgba(27, 42, 107, 0.08)', color: colors.navy }}>
              {a.km_atual.toLocaleString('pt-BR')} km
            </span>
          </div>
          <p className="ck-mapa__ficha-card-title">{a.nome_usuario}</p>
          <p className="ck-mapa__ficha-card-valor">{fmtBRL(a.valor_abastecido)}</p>
        </Cartao>
      ))}
    </>
  );
}

function ListaManutencoes({ itens }: { itens: FrotaManutencaoPortal[] }) {
  if (!itens.length) return <Vazio texto="Nenhuma manutenção registrada neste veículo." />;
  return (
    <>
      {itens.map((m) => (
        <Cartao key={m.id_manutencao}>
          <div className="ck-mapa__ficha-card-top">
            <strong>{fmtData(m.data_manutencao)}</strong>
            {m.km != null && (
              <span className="ck-mapa__ficha-badge" style={{ background: 'rgba(27, 42, 107, 0.08)', color: colors.navy }}>
                {m.km.toLocaleString('pt-BR')} km
              </span>
            )}
          </div>
          <p className="ck-mapa__ficha-card-title">{m.descricao || 'Serviço'}</p>
          <p className="ck-mapa__ficha-card-meta">{m.nome_usuario}</p>
          <p className="ck-mapa__ficha-card-valor">{fmtBRL(m.valor)}</p>
        </Cartao>
      ))}
    </>
  );
}
