import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { showToast } from '../../utils/toast';
import AddIcon from '@mui/icons-material/Add';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconeMenuTresTracos from '../../components/IconeMenuTresTracos';
import { api } from '../../api/client';
import type { ManutChamado } from '../../api/client';
import {
  getUsuario,
  filtraChamadosPorLojaMobile,
  tecnicoCampoSemRegiao,
  temPermissao,
} from '../../lib/auth';
import { NOTIFICACOES_REFRESH } from '../../utils/notificacoesEvent';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { parseDataApi } from '../../utils/dateBr';
import ChamadoCardResumo from '../../components/manutencao/ChamadoCardResumo';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import '../../components/visitas/visitas-mobile.css';
import '../../components/manutencao/chamados-mobile.css';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';
const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);

type AbaLista = 'abertos' | 'fechados';

export default function ChamadosMobileHistoricoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessao = getUsuario();
  const { idLoja, setIdLoja } = useChamadosMobileLoja();
  const [lista, setLista] = useState<ManutChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<AbaLista>('abertos');
  const [modoLista, setModoLista] = useState(false);
  const [assumindoId, setAssumindoId] = useState<number | null>(null);
  const [filtroLojaAberto, setFiltroLojaAberto] = useState(false);

  function recarregar() {
    return api
      .manutChamados({ mobile: true })
      .then(setLista)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar';
        if (/internal|500|fetch|network|proxy|refused/i.test(msg)) {
          setErro('Não foi possível conectar ao servidor. Verifique se a API está rodando (npm run dev).');
        } else {
          setErro(msg);
        }
      });
  }

  useEffect(() => {
    recarregar().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onRefresh() {
      recarregar();
    }
    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    return () => window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
  }, []);

  useEffect(() => {
    const fromState = (location.state as { chamadoCriado?: number } | null)?.chamadoCriado;
    const fromStorage = sessionStorage.getItem('chamado_criado_numero');
    const numero = fromState ?? (fromStorage ? Number(fromStorage) : null);
    if (!numero || Number.isNaN(numero)) return;
    sessionStorage.removeItem('chamado_criado_numero');
    showToast(`Chamado #${numero} aberto com sucesso!`, 'success');
    setAba('abertos');
    if (fromState) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    recarregar();
  }, [location.state, location.pathname, navigate]);

  const semRegiaoVinculada = tecnicoCampoSemRegiao(sessao);

  const multiplasLojas = (sessao?.lojas?.length ?? 0) > 1;
  const filtrarPorLoja = filtraChamadosPorLojaMobile(sessao);

  const listaFiltrada = useMemo(() => {
    const aplicarFiltroLoja = filtrarPorLoja && multiplasLojas && idLoja != null;
    const base = aplicarFiltroLoja ? lista.filter((c) => c.id_loja === idLoja) : lista;
    return [...base].sort(
      (a, b) =>
        parseDataApi(b.aberto_em || b.prazo_sla).getTime() -
        parseDataApi(a.aberto_em || a.prazo_sla).getTime(),
    );
  }, [lista, multiplasLojas, idLoja, filtrarPorLoja]);

  const emAberto = useMemo(
    () => listaFiltrada.filter((c) => ABERTOS.has(c.status)),
    [listaFiltrada],
  );

  const fechados = useMemo(
    () =>
      [...listaFiltrada.filter((c) => !ABERTOS.has(c.status))].sort(
        (a, b) =>
          parseDataApi(b.fechado_em || b.aberto_em || b.prazo_sla).getTime() -
          parseDataApi(a.fechado_em || a.aberto_em || a.prazo_sla).getTime(),
      ),
    [listaFiltrada],
  );

  const listaAba = aba === 'abertos' ? emAberto : fechados;

  const urgentes = useMemo(
    () => emAberto.filter((c) => c.urgencia === 'alta' || c.urgencia === 'critica').length,
    [emAberto],
  );

  const qtdEmAberto = useMemo(
    () => emAberto.filter((c) => c.status === 'aberto').length,
    [emAberto],
  );

  const qtdEmTratamento = useMemo(
    () => emAberto.filter((c) => c.status === 'em_atendimento').length,
    [emAberto],
  );

  const lojasUsuario = sessao?.lojas ?? [];

  async function assumirTicket(e: MouseEvent, c: ManutChamado) {
    e.stopPropagation();
    if (assumindoId != null) return;
    setAssumindoId(c.id_chamado);
    try {
      await api.manutAssumirChamado(c.id_chamado);
      showToast('Ticket assumido!', 'success');
      window.dispatchEvent(new CustomEvent(NOTIFICACOES_REFRESH));
      await recarregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao assumir ticket', 'error');
    } finally {
      setAssumindoId(null);
    }
  }

  if (loading) {
    return (
      <div className="ck-visitas ck-chamados ck-chamados--page">
        <div className="ck-visitas__loading" style={{ flex: 1 }}>
          <CircularProgress size={28} sx={{ color: ORANGE }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ck-visitas ck-chamados ck-chamados--page">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-chamados__title">Chamados</h1>
            </div>
            <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Acompanhe abertos e fechados, assuma tickets e abra novas solicitações.
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{qtdEmAberto}</strong>
              <span>em aberto</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{qtdEmTratamento}</strong>
              <span>andamento</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{fechados.length}</strong>
              <span>fechados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-chamados__sheet--fill ck-visitas__anim ck-visitas__anim--4">
        {erro ? <p className="ck-visitas__erro">{erro}</p> : null}

        {urgentes > 0 ? (
          <p className="ck-chamados__prio">
            {urgentes === 1
              ? '1 chamado precisa de atenção prioritária'
              : `${urgentes} chamados precisam de atenção prioritária`}
          </p>
        ) : null}

        <div className="ck-chamados__filtro-row">
          <div className="ck-visitas__seg" role="tablist" aria-label="Status">
            {(
              [
                { id: 'abertos' as const, label: 'Em aberto' },
                { id: 'fechados' as const, label: 'Fechados' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={`ck-visitas__seg-btn${aba === id ? ' is-on' : ''}`}
                onClick={() => setAba(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ck-chamados__lista-btn"
            aria-label={modoLista ? 'Ver em cards' : 'Ver em lista'}
            aria-pressed={modoLista}
            onClick={() => setModoLista((v) => !v)}
          >
            <IconeMenuTresTracos ativo={modoLista} />
          </button>
          {multiplasLojas && filtrarPorLoja ? (
            <button
              type="button"
              className={`ck-chamados__filtro-btn${idLoja ? ' is-on' : ''}`}
              aria-label="Filtrar loja"
              onClick={() => setFiltroLojaAberto(true)}
            >
              <FilterListIcon sx={{ fontSize: 20 }} />
            </button>
          ) : null}
        </div>

        {!listaAba.length && !erro ? (
          <div className="ck-chamados__empty">
            {aba === 'abertos' ? (
              <InboxOutlinedIcon sx={{ fontSize: 36, color: ORANGE, mb: 0.5, opacity: 0.85 }} />
            ) : (
              <ArchiveOutlinedIcon sx={{ fontSize: 36, color: NAVY, mb: 0.5, opacity: 0.5 }} />
            )}
            <strong>{aba === 'abertos' ? 'Nenhum chamado aberto' : 'Nenhum chamado fechado'}</strong>
            <p style={{ margin: '0 0 12px' }}>
              {semRegiaoVinculada
                ? 'Você não está vinculado a nenhuma região. Peça ao administrador para associar sua região de atuação.'
                : aba === 'abertos'
                  ? 'Quando houver uma solicitação de manutenção, ela aparecerá aqui.'
                  : 'Chamados concluídos ou cancelados aparecem na aba Fechados.'}
            </p>
            {aba === 'abertos' && sessao && temPermissao('chamados.abrir', sessao) && !semRegiaoVinculada ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/chamados/mobile/novo')}
                sx={{
                  fontWeight: 800,
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#FF7A3D' : '#1B2A6B'),
                  color: '#fff',
                  '&:hover': {
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#d04809' : '#152255'),
                  },
                }}
              >
                Abrir chamado
              </Button>
            ) : null}
          </div>
        ) : modoLista ? (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: '#fff',
              border: '1px solid rgba(27, 42, 107, 0.08)',
              boxShadow: '0 4px 18px rgba(27, 42, 107, 0.06)',
            }}
          >
            {listaAba.map((c, i) => (
              <ChamadoCardResumo
                key={c.id_chamado}
                chamado={c}
                variant="mobile"
                mobileLayout="lista"
                isLast={i === listaAba.length - 1}
                showLoja
                showSla={aba === 'abertos'}
                onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}
              />
            ))}
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
            {listaAba.map((c) => (
              <ChamadoCardResumo
                key={c.id_chamado}
                chamado={c}
                variant="mobile"
                compact={aba === 'fechados'}
                showLoja
                showSla={aba === 'abertos'}
                showDataEncerramento={aba === 'fechados'}
                mostrarAssumir={aba === 'abertos'}
                onAssumir={(e) => void assumirTicket(e, c)}
                assumindo={assumindoId === c.id_chamado}
                onClick={() => navigate(`/chamados/mobile/${c.id_chamado}`)}
              />
            ))}
          </Box>
        )}
      </div>

      <Dialog open={filtroLojaAberto} onClose={() => setFiltroLojaAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY }}>
          Filtrar por loja
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          {lojasUsuario.map((loja) => {
            const ativa = loja.id_loja === idLoja;
            return (
              <ListItemButton
                key={loja.id_loja}
                selected={ativa}
                onClick={() => {
                  setIdLoja(loja.id_loja);
                  setFiltroLojaAberto(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE }} />
                </ListItemIcon>
                <ListItemText
                  primary={loja.nome}
                  slotProps={{
                    primary: {
                      sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>
    </div>
  );
}
