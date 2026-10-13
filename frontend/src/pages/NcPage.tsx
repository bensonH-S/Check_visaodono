import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import PageLoading from '../components/PageLoading';
import { api, fmtData, fmtNota } from '../api/client';
import type { NcItem, NcResponse } from '../api/client';
import { agruparNcsPorVisita, lojasQueFecharam, parseNcDescricao, type NcVisitaGrupo } from '../components/nc/ncPageUtils';
import { formatDataHoraBalaoMapa } from '../utils/dateBr';
import { gerarPdfNaoConformidades } from '../utils/gerarPdfNcs';
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
  finBtnContainedSx,
  finCampoSx,
  finChipSx,
  finPageSx,
  finPaperSx,
  finSelectMenu,
} from '../financeiro/temaFinanceiroEscuro';

type FiltroStatus = 'aberto' | 'fechado' | 'todas';
type Visao = 'lojas' | 'visitas' | 'criticas';

type GrupoLoja = {
  loja: string;
  itens: NcItem[];
  abertas: number;
  fechadas: number;
  criticas: number;
};

const FILTROS: { id: FiltroStatus; label: string }[] = [
  { id: 'aberto', label: 'Em aberto' },
  { id: 'fechado', label: 'Fechados' },
  { id: 'todas', label: 'Todas' },
];

const TOM_STATUS: Record<string, { color: string; border: string; bg: string; label: string }> = {
  'Em aberto': { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)', label: 'Em aberto' },
  'Em andamento': { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)', label: 'Em andamento' },
  Resolvida: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)', label: 'Fechada' },
};

const TOM_GRAV: Record<string, { color: string; border: string; bg: string }> = {
  Crítica: { color: '#B91C1C', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)' },
  Moderada: { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)' },
  Baixa: { color: '#64748B', border: '#E2E8F0', bg: 'transparent' },
};

function chipTom(tom: { color: string; border: string; bg: string }) {
  return {
    height: 20,
    fontSize: 11,
    fontWeight: 500,
    color: tom.color,
    borderColor: tom.border,
    bgcolor: tom.bg,
  };
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  cor,
  alerta = false,
  ativo = false,
  onClick,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  cor: string;
  alerta?: boolean;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const faixa = alerta ? '#EF4444' : cor;
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        position: 'relative',
        px: 1.35,
        py: 0.75,
        pl: 1.6,
        minWidth: 120,
        flex: 1,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: alerta ? 'rgba(239,68,68,0.12)' : FIN_SURFACE,
        borderColor: ativo ? '#1B6EF3' : FIN_BORDER,
        boxShadow: ativo ? 'inset 0 0 0 1px #1B6EF3' : 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: faixa,
        },
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? '#B91C1C' : FIN_MUTED }}>
        {rotulo}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? '#B91C1C' : FIN_TEXT }}>
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 11, color: alerta ? '#B91C1C' : FIN_MUTED }}>{detalhe}</Typography>
    </Paper>
  );
}

function agruparPorLoja(itens: NcItem[]): GrupoLoja[] {
  const map = new Map<string, NcItem[]>();
  for (const nc of itens) {
    const nome = nc.name?.trim() || 'Loja';
    const lista = map.get(nome) || [];
    lista.push(nc);
    map.set(nome, lista);
  }
  return [...map.entries()]
    .map(([loja, lista]) => ({
      loja,
      itens: lista,
      abertas: lista.filter((i) => i.status === 'Em aberto').length,
      fechadas: lista.filter((i) => i.status === 'Resolvida').length,
      criticas: lista.filter((i) => i.status === 'Em aberto' && i.gravidade === 'Crítica').length,
    }))
    .sort((a, b) => b.fechadas - a.fechadas || b.abertas - a.abertas || a.loja.localeCompare(b.loja, 'pt-BR'));
}

export default function NcPage() {
  const [data, setData] = useState<NcResponse | null>(null);
  const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState<FiltroStatus>('aberto');
  const [visao, setVisao] = useState<Visao>('lojas');
  const [loja, setLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .naoConformidades()
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  const lojas = useMemo(() => {
    if (!data) return [];
    const base =
      filtro === 'fechado'
        ? data.items.filter((i) => i.status === 'Resolvida')
        : filtro === 'aberto'
          ? data.items.filter((i) => i.status === 'Em aberto')
          : data.items;
    const nomes = new Set(base.map((i) => i.name).filter(Boolean));
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data, filtro]);

  const lojasFechadas = useMemo(() => (data ? lojasQueFecharam(data.items) : []), [data]);
  const totalFechado = useMemo(
    () => (data ? data.items.filter((i) => i.status === 'Resolvida').length : 0),
    [data],
  );

  const grupos = useMemo(() => {
    if (!data) return [];
    const q = busca.trim().toLowerCase();
    const lista = data.items.filter((nc) => {
      if (filtro === 'aberto' && nc.status !== 'Em aberto') return false;
      if (filtro === 'fechado' && nc.status !== 'Resolvida') return false;
      if (loja && nc.name !== loja) return false;
      if (!q) return true;
      const { texto } = parseNcDescricao(nc.descricao);
      const alvo = [nc.name, nc.area, texto, nc.descricao, nc.nome_resolvido_por, nc.observacao_resolucao]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return alvo.includes(q);
    });
    return agruparPorLoja(lista);
  }, [data, filtro, loja, busca]);

  const visitas = useMemo(() => agruparNcsPorVisita(grupos.flatMap((g) => g.itens)), [grupos]);
  const visitasCriticas = useMemo(() => visitas.filter((v) => v.criticas > 0), [visitas]);

  function focarLista() {
    window.setTimeout(() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function aplicarFiltro(id: FiltroStatus) {
    setVisao('lojas');
    setFiltro(id);
    setAberta(null);
    if (id === 'fechado') setLoja('');
    else if (data && loja) {
      const aindaExiste = data.items.some((i) => {
        if (i.name !== loja) return false;
        if (id === 'aberto') return i.status === 'Em aberto';
        return true;
      });
      if (!aindaExiste) setLoja('');
    }
    focarLista();
  }

  function verVisitas() {
    setVisao('visitas');
    setFiltro('aberto');
    setLoja('');
    setAberta(null);
    focarLista();
  }

  function verCriticas() {
    setVisao('criticas');
    setFiltro('aberto');
    setLoja('');
    setAberta(null);
    focarLista();
  }

  function escolherLoja(nome: string) {
    setLoja(nome);
    setAberta(nome || null);
  }

  if (err) {
    return (
      <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>
        {err}
      </Alert>
    );
  }
  if (!data) return <PageLoading />;

  const visitasPendentes = Number(data.stats.visitas_pendentes ?? 0);
  const criticas = Number(data.stats.criticas ?? 0);

  return (
    <Stack spacing={1} sx={finPageSx}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder="Buscar item, loja ou quem fechou"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0, ...finCampoSx }}
        />
        <TextField
          select
          size="small"
          label="Loja"
          value={loja}
          onChange={(ev) => escolherLoja(ev.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0, ...finCampoSx }}
          {...finSelectMenu}
        >
          <MenuItem value="">Todas as lojas</MenuItem>
          {lojas.map((nome) => (
            <MenuItem key={nome} value={nome}>
              {nome}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
        <Resumo
          cor="#1B6EF3"
          rotulo="Visitas"
          valor={String(visitasPendentes)}
          detalhe="com pendência"
          ativo={visao === 'visitas'}
          onClick={verVisitas}
        />
        <Resumo
          cor="#F59E0B"
          rotulo="Em aberto"
          valor={String(data.stats.total_aberto)}
          detalhe="itens"
          ativo={visao === 'lojas' && filtro === 'aberto'}
          onClick={() => aplicarFiltro('aberto')}
        />
        <Resumo
          cor="#EF4444"
          rotulo="Críticas"
          valor={String(criticas)}
          detalhe="em aberto"
          alerta={criticas > 0 && visao !== 'criticas'}
          ativo={visao === 'criticas'}
          onClick={verCriticas}
        />
        <Resumo
          cor="#10B981"
          rotulo="Fechados"
          valor={String(totalFechado)}
          detalhe={`${lojasFechadas.length} loja${lojasFechadas.length === 1 ? '' : 's'}`}
          ativo={visao === 'lojas' && filtro === 'fechado'}
          onClick={() => aplicarFiltro('fechado')}
        />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTROS.map((item) => (
          <Chip
            key={item.id}
            size="small"
            label={item.label}
            variant="outlined"
            onClick={() => aplicarFiltro(item.id)}
            sx={finChipSx(filtro === item.id)}
          />
        ))}
        <Typography sx={{ fontSize: 12, color: FIN_MUTED, ml: 0.5 }}>
          {visao === 'visitas'
            ? `${visitas.length} visita${visitas.length === 1 ? '' : 's'}`
            : visao === 'criticas'
              ? `${visitasCriticas.length} visita${visitasCriticas.length === 1 ? '' : 's'} com crítica`
              : `${grupos.length} loja${grupos.length === 1 ? '' : 's'}`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={gerando || !data?.items.length}
          onClick={() => {
            if (!data) return;
            setGerando(true);
            const q = busca.trim().toLowerCase();
            const itens = data.items.filter((nc) => {
              if (loja && nc.name !== loja) return false;
              if (!q) return true;
              const { texto } = parseNcDescricao(nc.descricao);
              const alvo = [nc.name, nc.area, texto, nc.descricao, nc.nome_resolvido_por, nc.observacao_resolucao]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return alvo.includes(q);
            });
            const titulo = loja || 'Lojas com NCs em aberto e fechados';
            void gerarPdfNaoConformidades(itens, { titulo }).finally(() => setGerando(false));
          }}
          sx={{ ...finBtnContainedSx, textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 1.5 }}
        >
          {gerando ? 'Gerando…' : 'Gerar relatório'}
        </Button>
      </Stack>

      <Paper
        ref={listaRef}
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...finPaperSx }}
      >
        <Box sx={{ px: 1.75, py: 1, borderBottom: `1px solid ${FIN_BORDER}`, bgcolor: FIN_SURFACE_ALT }}>
          <Typography sx={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: FIN_MUTED }}>
            {visao === 'visitas'
              ? 'Visitas com pendência'
              : visao === 'criticas'
                ? 'Visitas com NC crítica'
                : filtro === 'fechado'
                ? 'Lojas que fecharam NCs'
                : filtro === 'aberto'
                  ? 'Lojas com NCs em aberto'
                  : 'Lojas'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {visao === 'visitas' || visao === 'criticas' ? (
            (visao === 'criticas' ? visitasCriticas : visitas).length === 0 ? (
              <ListaVazia titulo={visao === 'criticas' ? 'Nenhuma visita com NC crítica' : 'Nenhuma visita com pendência'} />
            ) : (
              (visao === 'criticas' ? visitasCriticas : visitas).map((visita) => (
                <VisitaPainel
                  key={visita.id_visita}
                  visita={visita}
                  somenteCriticas={visao === 'criticas'}
                  aberto={aberta === `v:${visita.id_visita}`}
                  onToggle={() =>
                    setAberta((atual) => (atual === `v:${visita.id_visita}` ? null : `v:${visita.id_visita}`))
                  }
                />
              ))
            )
          ) : grupos.length === 0 ? (
            <ListaVazia titulo="Nenhuma loja neste filtro" />
          ) : (
            grupos.map((grupo) => (
              <LojaPainel
                key={grupo.loja}
                grupo={grupo}
                filtro={filtro}
                aberto={aberta === grupo.loja}
                onToggle={() => setAberta((atual) => (atual === grupo.loja ? null : grupo.loja))}
              />
            ))
          )}
        </Box>
      </Paper>
    </Stack>
  );
}

function ListaVazia({ titulo }: { titulo: string }) {
  return (
    <Box sx={{ py: 5.5, px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1 }}>
      <WarningAmberOutlinedIcon sx={{ fontSize: 40, color: 'rgba(100,116,139,0.7)' }} />
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: FIN_TEXT, letterSpacing: '-0.02em' }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 13, color: FIN_MUTED, maxWidth: 460, lineHeight: 1.55 }}>
        Ajuste a loja, a busca ou o filtro acima.
      </Typography>
    </Box>
  );
}

function VisitaPainel({
  visita,
  aberto,
  onToggle,
  somenteCriticas = false,
}: {
  visita: NcVisitaGrupo;
  aberto: boolean;
  onToggle: () => void;
  somenteCriticas?: boolean;
}) {
  return (
    <Box sx={{ borderBottom: `1px solid ${FIN_BORDER}` }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={aberto}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.75,
          py: 1.15,
          bgcolor: aberto ? 'rgba(27, 110, 243, 0.06)' : FIN_SURFACE,
          color: FIN_TEXT,
          textAlign: 'left',
          cursor: 'pointer',
          '&:hover': { bgcolor: aberto ? 'rgba(27, 110, 243, 0.08)' : FIN_SURFACE_ALT },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: FIN_TEXT }}>{visita.loja}</Typography>
          <Typography sx={{ fontSize: 12, color: FIN_MUTED, mt: 0.2 }}>
            {fmtData(visita.data_visita)} · Visita #{visita.id_visita}
            {visita.nota_final != null ? ` · Nota ${fmtNota(visita.nota_final)}` : ''}
            {somenteCriticas
              ? ` · ${visita.criticas} crítica${visita.criticas === 1 ? '' : 's'}`
              : ` · ${visita.abertas} em aberto`}
          </Typography>
        </Box>
        {visita.criticas > 0 && (
          <Chip size="small" label={`${visita.criticas} crítica${visita.criticas === 1 ? '' : 's'}`} variant="outlined" sx={chipTom(TOM_GRAV.Crítica)} />
        )}
        <Tooltip title="Relatório">
          <IconButton
            component={Link}
            to={`/relatorio/visita/${visita.id_visita}`}
            size="small"
            aria-label="Abrir relatório da visita"
            onClick={(e) => e.stopPropagation()}
            sx={{ color: FIN_MUTED }}
          >
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: FIN_MUTED,
            transform: aberto ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </Box>
      <Collapse in={aberto} unmountOnExit>
        <Box sx={{ bgcolor: FIN_SURFACE_ALT, borderTop: `1px solid ${FIN_BORDER}` }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Item', 'Gravidade'].map((h) => (
                  <TableCell key={h} align={h === 'Gravidade' ? 'center' : 'left'}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visita.itens
                .filter(
                  (nc) =>
                    nc.status === 'Em aberto' &&
                    nc.area !== 'Resultado geral' &&
                    (!somenteCriticas || nc.gravidade === 'Crítica'),
                )
                .map((nc) => (
                  <LinhaNc key={nc.id_nc} nc={nc} modo="visita" />
                ))}
            </TableBody>
          </Table>
        </Box>
      </Collapse>
    </Box>
  );
}

function LojaPainel({
  grupo,
  filtro,
  aberto,
  onToggle,
}: {
  grupo: GrupoLoja;
  filtro: FiltroStatus;
  aberto: boolean;
  onToggle: () => void;
}) {
  const resumo =
    filtro === 'fechado'
      ? `${grupo.fechadas} fechado${grupo.fechadas === 1 ? '' : 's'}`
      : filtro === 'aberto'
        ? `${grupo.abertas} em aberto`
        : `${grupo.abertas} em aberto · ${grupo.fechadas} fechado${grupo.fechadas === 1 ? '' : 's'}`;

  return (
    <Box sx={{ borderBottom: `1px solid ${FIN_BORDER}` }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.75,
          py: 1.15,
          border: 0,
          bgcolor: aberto ? 'rgba(27, 110, 243, 0.06)' : FIN_SURFACE,
          color: FIN_TEXT,
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
          '&:hover': { bgcolor: aberto ? 'rgba(27, 110, 243, 0.08)' : FIN_SURFACE_ALT },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: FIN_TEXT }}>{grupo.loja}</Typography>
          <Typography sx={{ fontSize: 12, color: FIN_MUTED, mt: 0.2 }}>{resumo}</Typography>
        </Box>
        {grupo.criticas > 0 && filtro !== 'fechado' && (
          <Chip size="small" label={`${grupo.criticas} crítica${grupo.criticas === 1 ? '' : 's'}`} variant="outlined" sx={chipTom(TOM_GRAV.Crítica)} />
        )}
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: FIN_MUTED,
            transform: aberto ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </Box>
      <Collapse in={aberto} unmountOnExit>
        <Box sx={{ bgcolor: FIN_SURFACE_ALT, borderTop: `1px solid ${FIN_BORDER}` }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {(filtro === 'fechado'
                  ? ['Loja', 'Quem fechou', 'Quando', 'Correção', 'Item', 'Gravidade', '']
                  : ['Status', 'Visita', 'Item', 'Gravidade', 'Quem fechou', 'Quando', '']
                ).map((h) => (
                  <TableCell key={h || 'acao'} align={h === 'Gravidade' || h === 'Status' ? 'center' : 'left'}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {grupo.itens.map((nc) => (
                <LinhaNc key={nc.id_nc} nc={nc} modo={filtro} />
              ))}
            </TableBody>
          </Table>
        </Box>
      </Collapse>
    </Box>
  );
}

function CelulaItem({ nc }: { nc: NcItem }) {
  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);
  return (
    <TableCell sx={{ verticalAlign: 'middle', maxWidth: 420 }}>
      <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.3 }}>{nc.area}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, color: FIN_TEXT }}>
        {codigo ? `${codigo} ` : ''}
        {texto}
      </Typography>
      {obs && <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.35 }}>{obs}</Typography>}
    </TableCell>
  );
}

function CelulaRelatorio({ idVisita }: { idVisita: number | null }) {
  if (idVisita == null) return <TableCell />;
  return (
    <TableCell align="center" sx={{ verticalAlign: 'middle', width: 48, px: 0.5 }}>
      <Tooltip title="Relatório">
        <IconButton
          component={Link}
          to={`/relatorio/visita/${idVisita}`}
          size="small"
          aria-label="Abrir relatório"
          sx={{ color: FIN_MUTED }}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </TableCell>
  );
}

function LinhaNc({ nc, modo }: { nc: NcItem; modo: FiltroStatus | 'visita' }) {
  const status = TOM_STATUS[nc.status] || TOM_STATUS['Em aberto'];
  const grav = TOM_GRAV[nc.gravidade] || TOM_GRAV.Baixa;
  const resolvida = nc.status === 'Resolvida';

  if (modo === 'visita') {
    return (
      <TableRow hover>
        <CelulaItem nc={nc} />
        <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
          <Chip size="small" label={nc.gravidade} variant="outlined" sx={chipTom(grav)} />
        </TableCell>
      </TableRow>
    );
  }

  if (modo === 'fechado') {
    return (
      <TableRow hover>
        <TableCell sx={{ verticalAlign: 'middle' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: FIN_TEXT }}>{nc.name || '—'}</Typography>
        </TableCell>
        <TableCell sx={{ verticalAlign: 'middle' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: FIN_TEXT }}>{nc.nome_resolvido_por || '—'}</Typography>
        </TableCell>
        <TableCell sx={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <Typography sx={{ fontSize: 12, color: FIN_TEXT }}>
            {nc.data_resolucao ? formatDataHoraBalaoMapa(nc.data_resolucao) : '—'}
          </Typography>
        </TableCell>
        <TableCell sx={{ verticalAlign: 'middle', maxWidth: 260 }}>
          <Typography sx={{ fontSize: 12, color: FIN_TEXT, lineHeight: 1.35 }}>{nc.observacao_resolucao || '—'}</Typography>
        </TableCell>
        <CelulaItem nc={nc} />
        <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
          <Chip size="small" label={nc.gravidade} variant="outlined" sx={chipTom(grav)} />
        </TableCell>
        <CelulaRelatorio idVisita={nc.id_visita} />
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
        <Chip size="small" label={status.label} variant="outlined" sx={chipTom(status)} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        <Typography sx={{ fontSize: 12, color: FIN_TEXT }}>{fmtData(nc.data_visita || nc.data_cadastro)}</Typography>
        <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>
          #{nc.id_visita ?? '—'}
          {nc.nota_final != null ? ` · ${fmtNota(nc.nota_final)}` : ''}
        </Typography>
      </TableCell>
      <CelulaItem nc={nc} />
      <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
        <Chip size="small" label={nc.gravidade} variant="outlined" sx={chipTom(grav)} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle' }}>
        <Typography sx={{ fontSize: 12, color: resolvida ? FIN_TEXT : FIN_MUTED }}>
          {resolvida ? nc.nome_resolvido_por || '—' : '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        <Typography sx={{ fontSize: 12, color: resolvida ? FIN_TEXT : FIN_MUTED }}>
          {resolvida && nc.data_resolucao ? formatDataHoraBalaoMapa(nc.data_resolucao) : '—'}
        </Typography>
      </TableCell>
      <CelulaRelatorio idVisita={nc.id_visita} />
    </TableRow>
  );
}
