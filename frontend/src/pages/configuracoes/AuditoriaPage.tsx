import { useCallback, useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  api,
  type AuditoriaEvento,
  type AuditoriaNavegacaoItem,
  type AuditoriaSessao,
  type AuditoriaUsuarioFiltro,
} from '../../api/client';
import {
  Barra,
  Erro,
  PainelLateral,
  Resumo,
  Resumos,
  Secao,
  Selo,
  TabelaConfig,
  Titulo,
  type Coluna,
} from '../../financeiro/components/ConfigUi';
import { PrefsProvider } from '../../financeiro/prefs';
import { FIN_MUTED, finCampoSx, finMenuSx } from '../../financeiro/temaFinanceiroEscuro';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { configPageSx } from './configPageSx';

const POR_PAGINA = 30;

type FiltroStatus = 'todas' | 'abertas' | 'encerradas';
type FiltroTipoTimeline = 'todas' | 'download' | 'acoes' | 'telas';

const MODULOS_FILTRO: { value: string; label: string }[] = [
  { value: '', label: 'Todos os módulos' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'frota', label: 'Frota' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'escalas', label: 'Escalas' },
  { value: 'visitas', label: 'Visitas' },
  { value: 'indicadores', label: 'Indicadores' },
  { value: 'ti', label: 'TI' },
  { value: 'chamados', label: 'Chamados' },
  { value: 'metas', label: 'Metas' },
  { value: 'usuarios', label: 'Usuários' },
  { value: 'auth', label: 'Acesso' },
  { value: 'sistema', label: 'Sistema' },
];

type AtividadeLinha =
  | { kind: 'nav'; at: string; item: AuditoriaNavegacaoItem }
  | { kind: 'acao'; at: string; item: AuditoriaEvento };

function formatDuracao(segundos: number | null | undefined) {
  const s = Math.max(0, Number(segundos) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return mr ? `${h}h ${mr}m` : `${h}h`;
}

function tomAcao(tipo?: string): 'ok' | 'alerta' | 'erro' | 'info' | 'neutro' {
  switch (tipo) {
    case 'exclusao':
      return 'erro';
    case 'acesso':
      return 'alerta';
    case 'criacao':
      return 'ok';
    case 'download':
    case 'upload':
    case 'operacao':
      return 'info';
    default:
      return 'neutro';
  }
}

function rotuloSeloAcao(item: AuditoriaEvento) {
  if (item.tipo_acao === 'download' || item.acao === 'download') return 'Download';
  return item.acao_label || item.acao;
}

function iniciaisUsuario(nome?: string | null, inicial?: string | null) {
  const pronta = (inicial || '').trim().slice(0, 2).toUpperCase();
  if (pronta) return pronta;
  const letras = (nome || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return letras || '?';
}

function AvatarUsuario({
  nome,
  inicial,
  url,
  size = 28,
}: {
  nome?: string | null;
  inicial?: string | null;
  url?: string | null;
  size?: number;
}) {
  return (
    <Avatar
      src={url || undefined}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontWeight: 700,
        bgcolor: url ? undefined : '#1B6EF3',
        color: '#fff',
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(15,23,42,0.12)',
        flexShrink: 0,
      }}
    >
      {iniciaisUsuario(nome, inicial)}
    </Avatar>
  );
}

function dispositivoLabel(d: string | null | undefined) {
  if (!d) return '—';
  if (d === 'desktop') return 'Desktop';
  if (d === 'mobile') return 'Mobile';
  if (d === 'tablet') return 'Tablet';
  return d;
}

export default function AuditoriaPage() {
  const [sessoes, setSessoes] = useState<AuditoriaSessao[]>([]);
  const [total, setTotal] = useState(0);
  const [usuarios, setUsuarios] = useState<AuditoriaUsuarioFiltro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('todas');
  const [pagina, setPagina] = useState(0);
  const [selecionada, setSelecionada] = useState<AuditoriaSessao | null>(null);
  const [navSessao, setNavSessao] = useState<AuditoriaNavegacaoItem[]>([]);
  const [acoesSessao, setAcoesSessao] = useState<AuditoriaEvento[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroTipoTimeline, setFiltroTipoTimeline] = useState<FiltroTipoTimeline>('todas');

  useEffect(() => {
    api
      .auditoriaUsuariosFiltro()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api
      .auditoriaSessoes({
        page: pagina + 1,
        pageSize: POR_PAGINA,
        id_usuario: idUsuario ? Number(idUsuario) : undefined,
        abertas: status === 'abertas' || undefined,
      })
      .then((r) => {
        let items = r.items || [];
        if (status === 'encerradas') items = items.filter((s) => !s.aberta);
        setSessoes(items);
        setTotal(r.total || 0);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar auditoria'))
      .finally(() => setLoading(false));
  }, [pagina, idUsuario, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setPagina(0);
  }, [idUsuario, status, busca]);

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR')),
    [usuarios],
  );

  const usuarioSelecionado = useMemo(
    () => usuariosOrdenados.find((u) => String(u.id_usuario) === idUsuario) || null,
    [usuariosOrdenados, idUsuario],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return sessoes;
    return sessoes.filter((s) => {
      const alvo = `${s.usuario_nome || ''} ${s.usuario_email || ''} ${s.ip || ''} ${s.dispositivo || ''}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [sessoes, busca]);

  const abertas = useMemo(() => sessoes.filter((s) => s.aberta).length, [sessoes]);
  const tempoMedio = useMemo(() => {
    if (!sessoes.length) return 0;
    const soma = sessoes.reduce((acc, s) => acc + (Number(s.duracao_segundos) || 0), 0);
    return Math.round(soma / sessoes.length);
  }, [sessoes]);
  const abasTotal = useMemo(() => sessoes.reduce((acc, s) => acc + (Number(s.navegacoes) || 0), 0), [sessoes]);

  const abrirDetalhe = useCallback(async (sessao: AuditoriaSessao) => {
    setSelecionada(sessao);
    setCarregandoDetalhe(true);
    setNavSessao([]);
    setAcoesSessao([]);
    setFiltroModulo('');
    setFiltroTipoTimeline('todas');
    try {
      const [nav, eventos] = await Promise.all([
        api.auditoriaNavegacoes({ id_sessao: sessao.id_sessao, pageSize: 150 }),
        api.auditoriaEventos({ id_usuario: sessao.id_usuario, limite: 200 }),
      ]);
      setNavSessao(nav.items || []);

      const inicio = new Date(sessao.iniciada_em).getTime();
      const fim = new Date(sessao.encerrada_em || sessao.ultimo_ping_em || Date.now()).getTime() + 60_000;
      setAcoesSessao(
        (eventos || []).filter((ev) => {
          const t = new Date(ev.created_at).getTime();
          return t >= inicio && t <= fim;
        }),
      );
    } catch {
      setNavSessao([]);
      setAcoesSessao([]);
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  const timeline = useMemo<AtividadeLinha[]>(() => {
    const navOk = filtroTipoTimeline === 'todas' || filtroTipoTimeline === 'telas';
    const acoesOk = filtroTipoTimeline === 'todas' || filtroTipoTimeline === 'acoes' || filtroTipoTimeline === 'download';
    const linhas: AtividadeLinha[] = [
      ...(navOk ? navSessao.map((item) => ({ kind: 'nav' as const, at: item.entrou_em, item })) : []),
      ...(acoesOk
        ? acoesSessao
            .filter((item) => {
              if (filtroModulo && String(item.modulo || '').toLowerCase() !== filtroModulo) return false;
              if (filtroTipoTimeline === 'download') {
                return item.tipo_acao === 'download' || item.acao === 'download';
              }
              return true;
            })
            .map((item) => ({ kind: 'acao' as const, at: item.created_at, item }))
        : []),
    ];
    return linhas.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [navSessao, acoesSessao, filtroModulo, filtroTipoTimeline]);

  const colunas: Coluna<AuditoriaSessao>[] = [
    {
      titulo: 'Quando',
      largura: 120,
      render: (s) => (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatDataHoraBrasilia(s.iniciada_em)}
        </Typography>
      ),
    },
    {
      titulo: 'Usuário',
      render: (s) => <Titulo texto={s.usuario_nome || `Usuário #${s.id_usuario}`} sub={s.usuario_email || undefined} />,
    },
    {
      titulo: 'Tempo',
      largura: 90,
      render: (s) => (
        <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {formatDuracao(s.duracao_segundos)}
        </Typography>
      ),
    },
    {
      titulo: 'Situação',
      largura: 110,
      render: (s) => <Selo texto={s.aberta ? 'Conectado' : 'Encerrada'} tom={s.aberta ? 'ok' : 'neutro'} />,
    },
    {
      titulo: 'Atividade',
      largura: 120,
      render: (s) => (
        <Typography sx={{ fontSize: 13 }}>
          {s.navegacoes} {s.navegacoes === 1 ? 'tela' : 'telas'}
        </Typography>
      ),
    },
    {
      titulo: 'Dispositivo',
      render: (s) => (
        <Titulo
          texto={`${dispositivoLabel(s.dispositivo)}${s.ip ? ` · ${s.ip}` : ''}`}
          sub={`último ping ${formatDataHoraBrasilia(s.ultimo_ping_em)}`}
        />
      ),
    },
  ];

  return (
    <PrefsProvider>
    <Box sx={configPageSx}>
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Resumos>
          <Resumo
            rotulo="Conectados agora"
            valor={String(abertas)}
            detalhe={abertas === 1 ? 'sessão aberta nesta página' : 'sessões abertas nesta página'}
          />
          <Resumo
            rotulo="Sessões listadas"
            valor={String(total || sessoes.length)}
            detalhe="acessos registrados no filtro"
          />
          <Resumo
            rotulo="Telas abertas"
            valor={String(abasTotal)}
            detalhe="navegações nestas sessões"
          />
          <Resumo
            rotulo="Tempo médio"
            valor={formatDuracao(tempoMedio)}
            detalhe="por sessão nesta lista"
          />
        </Resumos>

        <Barra busca={busca} onBusca={setBusca} placeholder="Buscar usuário, e-mail ou IP">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
            <AvatarUsuario
              nome={usuarioSelecionado?.nome}
              inicial={usuarioSelecionado?.avatar_inicial}
              url={usuarioSelecionado?.avatar_url}
              size={30}
            />
            <Autocomplete
              size="small"
              fullWidth
              options={usuariosOrdenados}
              value={usuarioSelecionado}
              onChange={(_, u) => setIdUsuario(u ? String(u.id_usuario) : '')}
              getOptionLabel={(u) => u.nome}
              isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
              noOptionsText="Nenhum usuário"
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase();
                if (!q) return options;
                return options.filter(
                  (u) =>
                    u.nome.toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q),
                );
              }}
              slotProps={{
                listbox: { sx: { maxHeight: 280 } },
                paper: { sx: finMenuSx },
              }}
              renderOption={(props, u) => {
                const { key, ...rest } = props;
                return (
                  <Box
                    component="li"
                    key={key ?? u.id_usuario}
                    {...rest}
                    sx={{ display: 'flex !important', alignItems: 'center', gap: 1, py: 0.75 }}
                  >
                    <AvatarUsuario
                      nome={u.nome}
                      inicial={u.avatar_inicial}
                      url={u.avatar_url}
                      size={28}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }} noWrap>
                        {u.nome}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.2 }} noWrap>
                        {u.email}
                        {!u.ativo ? ' · inativo' : ''}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Usuário"
                  placeholder="Buscar usuário…"
                  sx={finCampoSx}
                />
              )}
            />
          </Box>
          <TextField
            select
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as FiltroStatus)}
            sx={{ minWidth: 150, ...finCampoSx }}
          >
            <MenuItem value="todas">Todas</MenuItem>
            <MenuItem value="abertas">Conectados</MenuItem>
            <MenuItem value="encerradas">Encerradas</MenuItem>
          </TextField>
        </Barra>

        <Erro erro={erro} />

        <TabelaConfig
          colunas={colunas}
          linhas={loading ? [] : filtradas}
          chave={(s) => String(s.id_sessao)}
          vazio={loading ? 'Carregando…' : 'Nenhuma sessão encontrada com esses filtros.'}
          onLinha={abrirDetalhe}
          paginacao={{
            total: Math.max(total, filtradas.length),
            pagina,
            por: POR_PAGINA,
            onPagina: setPagina,
          }}
        />
      </Stack>

      {selecionada ? (
        <PainelLateral
          aberto
          titulo={selecionada.usuario_nome || `Usuário #${selecionada.id_usuario}`}
          subtitulo={`${selecionada.aberta ? 'Conectado' : 'Encerrada'} · ${formatDuracao(selecionada.duracao_segundos)} · ${dispositivoLabel(selecionada.dispositivo)}`}
          onFechar={() => setSelecionada(null)}
        >
          <Secao titulo="Sessão">
            <Stack spacing={0.75}>
              <LinhaDetalhe rotulo="Início" valor={formatDataHoraBrasilia(selecionada.iniciada_em)} />
              <LinhaDetalhe
                rotulo="Fim"
                valor={selecionada.encerrada_em ? formatDataHoraBrasilia(selecionada.encerrada_em) : 'Ainda conectado'}
              />
              <LinhaDetalhe rotulo="Último ping" valor={formatDataHoraBrasilia(selecionada.ultimo_ping_em)} />
              <LinhaDetalhe rotulo="IP" valor={selecionada.ip || '—'} />
              <LinhaDetalhe
                rotulo="Resumo"
                valor={`${navSessao.length} telas · ${acoesSessao.length} ações`}
              />
            </Stack>
          </Secao>

          <Secao titulo="Linha do tempo">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25 }}>
              <TextField
                select
                size="small"
                label="Tipo"
                value={filtroTipoTimeline}
                onChange={(e) => setFiltroTipoTimeline(e.target.value as FiltroTipoTimeline)}
                sx={{ minWidth: 140, ...finCampoSx }}
              >
                <MenuItem value="todas">Tudo</MenuItem>
                <MenuItem value="download">Downloads</MenuItem>
                <MenuItem value="acoes">Ações</MenuItem>
                <MenuItem value="telas">Telas</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Módulo"
                value={filtroModulo}
                onChange={(e) => setFiltroModulo(e.target.value)}
                sx={{ minWidth: 160, ...finCampoSx }}
                disabled={filtroTipoTimeline === 'telas'}
              >
                {MODULOS_FILTRO.map((m) => (
                  <MenuItem key={m.value || 'all'} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {carregandoDetalhe ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Carregando atividade…</Typography>
            ) : timeline.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Nenhuma tela ou ação registrada nesta sessão.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {timeline.map((linha) =>
                  linha.kind === 'nav' ? (
                    <Box
                      key={`nav-${linha.item.id_navegacao}`}
                      sx={{
                        p: 1.25,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Selo texto="Tela" tom="info" />
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {formatDataHoraBrasilia(linha.item.entrou_em)}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {linha.item.duracao_segundos != null ? formatDuracao(linha.item.duracao_segundos) : 'agora'}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {linha.item.titulo || linha.item.rota}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'ui-monospace, monospace' }}>
                        {linha.item.rota}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      key={`acao-${linha.item.created_at}-${linha.item.acao}-${linha.item.id_referencia}`}
                      sx={{
                        p: 1.25,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Selo
                          texto={rotuloSeloAcao(linha.item)}
                          tom={tomAcao(linha.item.tipo_acao)}
                        />
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {formatDataHoraBrasilia(linha.item.created_at)}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45 }}>
                        {linha.item.descricao}
                      </Typography>
                      {linha.item.modulo_label ? (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                          {linha.item.modulo_label}
                        </Typography>
                      ) : null}
                    </Box>
                  )
                )}
              </Stack>
            )}
          </Secao>
        </PainelLateral>
      ) : null}
    </Box>
    </PrefsProvider>
  );
}


function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{valor}</Typography>
    </Stack>
  );
}
