import { useEffect, useMemo, useState, type ReactNode } from 'react';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { api, type FrotaVeiculo, type FrotaVeiculoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { rotuloStatusVeiculoMapa, statusVeiculoMapa } from '../frota/frotaMapaVeiculo';

export function posicaoParaVeiculoCatalogo(v: FrotaVeiculoPosicao): FrotaVeiculo {
  return {
    id_veiculo: v.id_veiculo,
    placa: v.placa,
    marca: v.marca ?? null,
    modelo: v.modelo ?? null,
    ano: null,
    cor: null,
    km_atual: null,
    assuncao_em: null,
    id_regiao: v.id_regiao ?? null,
    nome_regiao: v.nome_regiao ?? null,
    id_usuario_responsavel: v.id_usuario_responsavel ?? null,
    nome_responsavel: v.nome_responsavel ?? null,
    rastreamento_disponivel: v.rastreamento_disponivel,
    id_rastreamento: v.id_rastreamento ?? null,
    gps_instalado: v.id_rastreamento != null,
  };
}

type Props = {
  veiculoId: number | null;
  regiaoFiltro: number | '';
  onSelect: (veiculo: FrotaVeiculo) => void;
  /** Botão sobre fundo navy (stage immersive). */
  tomEscuro?: boolean;
  /** Campo largo com placa visível, no estilo do portal. */
  variante?: 'icone' | 'campo';
  /** Catálogo do mapa ao vivo — usado se a API de veículos falhar. */
  veiculosMapa?: FrotaVeiculoPosicao[];
  veiculoMeta?: FrotaVeiculo | null;
};

function rotuloVeiculo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo ? `${v.placa} · ${modelo}` : v.placa;
}

function rotuloModelo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo || 'Modelo não informado';
}

function conectadoFulltrack(v: FrotaVeiculo, aoVivo?: FrotaVeiculoPosicao) {
  return (
    v.gps_instalado === true ||
    v.id_rastreamento != null ||
    aoVivo?.id_rastreamento != null
  );
}

function ListaVeiculos({
  veiculos,
  veiculoId,
  carregando,
  posicaoPorId,
  onSelect,
  escuro = false,
}: {
  veiculos: FrotaVeiculo[];
  veiculoId: number | null;
  carregando: boolean;
  posicaoPorId: Map<number, FrotaVeiculoPosicao>;
  onSelect: (veiculo: FrotaVeiculo) => void;
  escuro?: boolean;
}): ReactNode {
  if (carregando) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} sx={{ color: escuro ? '#fe6c22' : undefined }} />
      </Box>
    );
  }
  if (veiculos.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{ px: 2, py: 2.5, color: escuro ? '#8d8d8d' : 'text.secondary' }}
      >
        Nenhum veículo encontrado nesta região.
      </Typography>
    );
  }
  return (
    <List dense sx={{ maxHeight: '55vh', overflowY: 'auto', py: 0.75, WebkitOverflowScrolling: 'touch' }}>
      {veiculos.map((v) => {
        const selecionado = v.id_veiculo === veiculoId;
        const aoVivo = posicaoPorId.get(v.id_veiculo);
        const temGps =
          aoVivo != null &&
          Number.isFinite(Number(aoVivo.latitude)) &&
          Number.isFinite(Number(aoVivo.longitude));
        const statusKey = aoVivo
          ? statusVeiculoMapa(aoVivo, aoVivo.rastreamento_disponivel !== false)
          : null;
        const status = statusKey ? rotuloStatusVeiculoMapa(statusKey) : null;
        const muted = escuro ? '#8d8d8d' : colors.textMuted;
        const primary = escuro ? '#f5f5f5' : 'text.primary';
        return (
          <ListItemButton
            key={v.id_veiculo}
            selected={selecionado}
            onClick={() => onSelect(v)}
            sx={{
              mx: 0.75,
              mb: 0.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selecionado
                ? 'rgba(254, 108, 34, 0.4)'
                : escuro
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(27, 42, 107, 0.08)',
              bgcolor: selecionado
                ? 'rgba(254, 108, 34, 0.14)'
                : escuro
                  ? 'rgba(255,255,255,0.03)'
                  : 'transparent',
              '&.Mui-selected': {
                bgcolor: 'rgba(254, 108, 34, 0.16)',
                '&:hover': { bgcolor: 'rgba(254, 108, 34, 0.22)' },
              },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35, width: '100%', py: 0.15, minWidth: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <DirectionsCarFilledOutlinedIcon
                  sx={{
                    fontSize: 18,
                    flexShrink: 0,
                    color: selecionado ? '#fe6c22' : escuro ? '#ff9a5c' : colors.navy,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: primary,
                    lineHeight: 1.2,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.placa}
                  <Typography
                    component="span"
                    sx={{ mx: 0.6, fontWeight: 700, color: muted, fontSize: '0.78rem' }}
                  >
                    ·
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontWeight: 600, color: muted, fontSize: '0.78rem' }}
                  >
                    {rotuloModelo(v)}
                    {v.ano ? ` · ${v.ano}` : ''}
                  </Typography>
                  {!conectadoFulltrack(v, aoVivo) && (
                    <Typography
                      component="span"
                      sx={{ ml: 0.75, fontSize: '0.7rem', fontWeight: 700, color: muted }}
                    >
                      (sem gps)
                    </Typography>
                  )}
                </Typography>
              </Box>
              {conectadoFulltrack(v, aoVivo) && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 700,
                    color: temGps ? (escuro ? '#ff9a5c' : colors.navy) : muted,
                    pl: '26px',
                  }}
                >
                  {temGps && status && statusKey ? (
                    <span className="ck-mapa__status-live">
                      <span className={`ck-mapa__status-dot is-${statusKey}`} aria-hidden />
                      {status}
                    </span>
                  ) : (
                    'Sem sinal no mapa'
                  )}
                </Typography>
              )}
              {(v.nome_regiao || v.nome_responsavel) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, pl: '26px' }}>
                  {v.nome_regiao ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, minWidth: 0 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 13, color: '#ff9a5c', opacity: 0.9, flexShrink: 0 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          lineHeight: 1.2,
                          color: muted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.nome_regiao}
                      </Typography>
                    </Box>
                  ) : null}
                  {v.nome_responsavel ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, minWidth: 0 }}>
                      <PersonOutlineOutlinedIcon sx={{ fontSize: 13, color: muted, opacity: 0.9, flexShrink: 0 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          lineHeight: 1.2,
                          color: muted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.nome_responsavel}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              )}
            </Box>
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default function MapaFiltroTrajetoVeiculo({
  veiculoId,
  regiaoFiltro,
  onSelect,
  tomEscuro = false,
  variante = 'icone',
  veiculosMapa = [],
  veiculoMeta = null,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [abertoCampo, setAbertoCampo] = useState(false);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const campo = variante === 'campo';
  const aberto = campo ? abertoCampo : Boolean(anchorEl);
  const fallback = useMemo(
    () => veiculosMapa.map(posicaoParaVeiculoCatalogo),
    [veiculosMapa],
  );

  const catalogo = useMemo(() => {
    const byId = new Map<number, FrotaVeiculo>();
    for (const v of fallback) byId.set(v.id_veiculo, v);
    for (const v of veiculos) {
      const prev = byId.get(v.id_veiculo);
      byId.set(v.id_veiculo, prev ? { ...prev, ...v } : v);
    }
    return [...byId.values()];
  }, [veiculos, fallback]);

  const veiculosFiltrados = useMemo(() => {
    let lista = catalogo;
    if (regiaoFiltro !== '') {
      const id = Number(regiaoFiltro);
      lista = lista.filter((v) => v.id_regiao != null && Number(v.id_regiao) === id);
    }
    return [...lista].sort((a, b) => {
      const ga = conectadoFulltrack(a) ? 0 : 1;
      const gb = conectadoFulltrack(b) ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return a.placa.localeCompare(b.placa, 'pt-BR');
    });
  }, [catalogo, regiaoFiltro]);

  const veiculoSelecionado = useMemo(
    () => catalogo.find((v) => v.id_veiculo === veiculoId) ?? veiculoMeta ?? null,
    [catalogo, veiculoId, veiculoMeta],
  );

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    void api
      .frotaVeiculos()
      .then((lista) => {
        if (!cancelado) setVeiculos(lista);
      })
      .catch(() => {
        if (!cancelado) setVeiculos(fallback);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  const tooltip = veiculoSelecionado
    ? `Veículo: ${rotuloVeiculo(veiculoSelecionado)}`
    : 'Selecionar veículo para o trajeto';

  const rotuloCampo = veiculoSelecionado
    ? conectadoFulltrack(veiculoSelecionado)
      ? rotuloVeiculo(veiculoSelecionado)
      : `${veiculoSelecionado.placa} (sem gps)`
    : 'Toque para escolher';
  const posicaoPorId = useMemo(() => {
    const map = new Map<number, FrotaVeiculoPosicao>();
    for (const v of veiculosMapa) map.set(v.id_veiculo, v);
    return map;
  }, [veiculosMapa]);

  function fechar() {
    setAnchorEl(null);
    setAbertoCampo(false);
  }

  function escolher(v: FrotaVeiculo) {
    onSelect(v);
    fechar();
  }

  const cabecalho = (
    <Box
      sx={{
        px: 1.5,
        pt: 1.25,
        pb: 0.75,
        borderBottom: '1px solid',
        borderColor: tomEscuro ? 'rgba(255,255,255,0.1)' : 'divider',
      }}
    >
      {campo && (
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: tomEscuro ? 'rgba(255,255,255,0.2)' : 'rgba(27, 42, 107, 0.18)',
            mx: 'auto',
            mb: 1,
          }}
        />
      )}
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 800, color: tomEscuro ? '#f5f5f5' : (theme) => (theme.palette.mode === 'dark' ? '#F8FAFC' : '#1B2A6B') }}
      >
        Escolher veículo
      </Typography>
      <Typography variant="caption" sx={{ color: tomEscuro ? '#8d8d8d' : 'text.secondary' }}>
        {veiculosFiltrados.length} {veiculosFiltrados.length === 1 ? 'veículo' : 'veículos'} · toque para
        selecionar
      </Typography>
    </Box>
  );

  const lista = (
    <ListaVeiculos
      veiculos={veiculosFiltrados}
      veiculoId={veiculoId}
      carregando={carregando && catalogo.length === 0}
      posicaoPorId={posicaoPorId}
      onSelect={escolher}
      escuro={tomEscuro}
    />
  );

  return (
    <>
      {campo ? (
        <button
          type="button"
          className="ck-mapa__consulta-field"
          onClick={() => setAbertoCampo(true)}
          aria-haspopup="listbox"
          aria-expanded={abertoCampo}
          aria-label="Selecionar veículo para trajeto"
        >
          <span className="ck-mapa__consulta-label">Veículo</span>
          <span className="ck-mapa__consulta-value">
            <DirectionsCarFilledOutlinedIcon
              sx={{ fontSize: 18, color: tomEscuro ? '#ff9a5c' : colors.navy, flexShrink: 0 }}
            />
            <span className="ck-mapa__consulta-value-txt">{rotuloCampo}</span>
            <KeyboardArrowDownIcon
              sx={{ fontSize: 20, color: tomEscuro ? '#8d8d8d' : '#6b7280', ml: 'auto', flexShrink: 0 }}
            />
          </span>
        </button>
      ) : (
        <Tooltip title={tooltip} arrow>
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="Selecionar veículo para trajeto"
            sx={{
              flexShrink: 0,
              width: 36,
              height: 36,
              bgcolor: veiculoId
                ? colors.orange
                : tomEscuro
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(27, 42, 107, 0.06)',
              color: veiculoId || tomEscuro ? '#fff' : colors.navy,
              boxShadow: veiculoId ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
              '&:hover': {
                bgcolor: veiculoId
                  ? colors.orange
                  : tomEscuro
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(27, 42, 107, 0.1)',
              },
            }}
          >
            <DirectionsCarFilledOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      )}
      {campo ? (
        <Drawer
          anchor="bottom"
          open={abertoCampo}
          onClose={fechar}
          disableAutoFocus
          disableEnforceFocus
          disableRestoreFocus
          ModalProps={{ keepMounted: false }}
          className={tomEscuro ? 'ck-mapa__veiculo-drawer-root is-dark' : 'ck-mapa__veiculo-drawer-root'}
          sx={{
            zIndex: 1600,
            '& .MuiBackdrop-root': {
              bottom: 'var(--app-tabbar-offset, 58px)',
            },
          }}
          slotProps={{
            root: { sx: { zIndex: 1600 } },
            paper: {
              className: tomEscuro ? 'ck-mapa__veiculo-drawer is-dark' : 'ck-mapa__veiculo-drawer',
              sx: {
                zIndex: 1601,
                bottom: 'var(--app-tabbar-offset, 58px) !important',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                maxHeight: 'calc(100dvh - var(--app-tabbar-offset, 58px))',
                pb: '12px',
                ...(tomEscuro
                  ? {
                      bgcolor: '#1a222c !important',
                      color: '#f5f5f5',
                      backgroundImage: 'none',
                      borderTop: '1px solid rgba(255,255,255,0.12)',
                    }
                  : null),
              },
            },
          }}
        >
          {cabecalho}
          {lista}
        </Drawer>
      ) : (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={fechar}
          disableAutoFocus
          disableEnforceFocus
          disableRestoreFocus
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2.5, width: 320, maxWidth: '92vw' } } }}
        >
          {cabecalho}
          {lista}
        </Popover>
      )}
    </>
  );
}
