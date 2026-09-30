import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LinearProgress from '@mui/material/LinearProgress';
import { api, type EnergiaChamado, type Loja } from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile, podeAbrirEnergia } from '../../lib/auth';
import { EnergiaLojaHead, EnergiaMobileChrome, EnergiaMobileStage } from './EnergiaMobileShell';
import {
  idLojaInicialStorage,
  preferenciaLojaInicial,
  persistirLoja,
  travarScrollPagina,
} from './energiaMobileLoja';
import { rotuloStatusEnergia, rotuloTipoOcorrencia } from './energiaConstants';

type Filtro = 'todas' | 'abertos' | 'finalizados';

function classeStatus(status: string) {
  if (status === 'finalizado') return 'is-ok';
  if (status === 'em_andamento') return 'is-andamento';
  if (status === 'cancelado') return 'is-cancelado';
  return 'is-aberta';
}

function dataCurta(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function EnergiaMobileListaPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const podeAbrir = podeAbrirEnergia(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(idLojaInicialStorage);
  const [lista, setLista] = useState<EnergiaChamado[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);

  const carregarLista = useCallback(async (lojaId: number) => {
    const res = await api.energiaChamados({ loja: lojaId });
    setLista(res.items);
    return res.items;
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await api.lojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        const preferida = preferenciaLojaInicial(rows);
        if (!preferida) return;
        if (!idLoja || !rows.some((l) => l.id_loja === idLoja)) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        } else if (lojaTravada && preferida !== idLoja) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!idLoja) return;
    let cancel = false;
    setLoading(true);
    setErr('');
    carregarLista(idLoja)
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar protocolos');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [idLoja, carregarLista]);

  useEffect(() => {
    if (!dlgLoja) {
      travarScrollPagina(false);
      return;
    }
    travarScrollPagina(true);
    return () => travarScrollPagina(false);
  }, [dlgLoja]);

  const filtrada = useMemo(() => {
    if (filtro === 'todas') return lista;
    if (filtro === 'abertos') {
      return lista.filter((c) => c.status === 'aberto' || c.status === 'em_andamento');
    }
    return lista.filter((c) => c.status === 'finalizado' || c.status === 'cancelado');
  }, [lista, filtro]);

  const kpiAberto = lista.filter((c) => c.status === 'aberto').length;
  const kpiAndamento = lista.filter((c) => c.status === 'em_andamento').length;
  const kpiFinalizado = lista.filter((c) => c.status === 'finalizado').length;
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;

  return (
    <EnergiaMobileChrome
      plusLabel="Registrar protocolo"
      plusDisabled={!idLoja || !podeAbrir}
      onPlus={idLoja && podeAbrir ? () => navigate('/energia/mobile/novo') : undefined}
    >
      <EnergiaMobileStage
        title="Energia"
        sub="Protocolo da concessionária, fotos e status. Evidência se queimar equipamento."
        tabs={
          <nav className="ck-estoque-hub__tabs" aria-label="Filtro de protocolos">
            {(
              [
                ['todas', 'Todas'],
                ['abertos', 'Abertos'],
                ['finalizados', 'Finalizados'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`ck-estoque-hub__tab${filtro === value ? ' is-on' : ''}`}
                onClick={() => setFiltro(value)}
              >
                {label}
              </button>
            ))}
          </nav>
        }
        kpis={
          <div className="ck-energia-hub__kpis" aria-live="polite">
            <div className="ck-energia-hub__kpi is-on">
              <strong>{loading ? '—' : kpiAberto}</strong>
              <span>Abertos</span>
            </div>
            <div className="ck-energia-hub__kpi">
              <strong>{loading ? '—' : kpiAndamento}</strong>
              <span>Andamento</span>
            </div>
            <div className="ck-energia-hub__kpi">
              <strong>{loading ? '—' : kpiFinalizado}</strong>
              <span>Finalizados</span>
            </div>
          </div>
        }
      />

      <div className="ck-estoque-hub__scroll ck-energia-hub__scroll">
        {err ? <p className="ck-energia-hub__err">{err}</p> : null}

        <EnergiaLojaHead
          lojas={lojas}
          idLoja={idLoja}
          onChangeLoja={setIdLoja}
          podeTrocarLoja={podeTrocarLoja}
          lojaAtual={lojaAtual}
          dlgLoja={dlgLoja}
          setDlgLoja={setDlgLoja}
        />

        {loading ? (
          <LinearProgress
            sx={{
              my: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : null}

        {!loading && !filtrada.length ? (
          <div className="ck-energia-hub__empty">
            {lojaAtual
              ? filtro !== 'todas' && lista.length > 0
                ? 'Nenhum protocolo neste filtro.'
                : 'Nenhum protocolo nesta loja. Toque no + para registrar.'
              : 'Selecione a loja para começar.'}
          </div>
        ) : null}

        {filtrada.map((c) => {
          const aberto = c.status === 'aberto' || c.status === 'em_andamento';
          const quando = dataCurta(c.ocorrido_em);
          return (
            <button
              key={c.id_chamado}
              type="button"
              className={`ck-energia-hub__card${aberto ? ' is-aberta' : ''}${
                c.status === 'em_andamento' ? ' is-andamento' : ''
              }`}
              onClick={() => navigate(`/energia/mobile/${c.id_chamado}`)}
            >
              <div className="ck-energia-hub__card-top">
                <div>
                  <strong>Protocolo {c.protocolo}</strong>
                  <small>
                    {rotuloTipoOcorrencia(c.tipo_ocorrencia)}
                    {quando ? ` · ${quando}` : ''}
                  </small>
                </div>
                <span className={`ck-energia-hub__status ${classeStatus(c.status)}`}>
                  {rotuloStatusEnergia(c.status)}
                </span>
              </div>

              <div className="ck-energia-hub__card-mid">
                <strong>#{c.numero}</strong>
                <span>{c.concessionaria}</span>
              </div>

              <div className="ck-energia-hub__card-foot">
                <span className="ck-energia-hub__who">
                  <PersonOutlinedIcon sx={{ fontSize: 16 }} />
                  {c.nome_abriu || 'Não informado'}
                </span>
                {c.qtd_fotos > 0 ? (
                  <span className="ck-energia-hub__badge is-ok">
                    {c.qtd_fotos} foto{c.qtd_fotos === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="ck-energia-hub__badge is-pend">Sem fotos</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </EnergiaMobileChrome>
  );
}
