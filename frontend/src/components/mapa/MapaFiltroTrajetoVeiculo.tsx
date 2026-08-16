import { useEffect, useMemo, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { api, type FrotaVeiculo, type FrotaVeiculoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { rotuloStatusVeiculoMapa, statusVeiculoMapa } from '../frota/frotaMapaVeiculo';
import TextField from '@mui/material/TextField';

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
    rastreamento_disponivel: v.rastreamento_disponivel,
    id_rastreamento: v.id_rastreamento ?? null,
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
  /** Lista os veículos que já estão no mapa (ao vivo), sem esperar a API. */
  preferirMapa?: boolean;
};

function rotuloVeiculo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo ? `${v.placa} · ${modelo}` : v.placa;
}

function rotuloModelo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo || 'Modelo não informado';
}

export default function MapaFiltroTrajetoVeiculo({
  veiculoId,
  regiaoFiltro,
  onSelect,
  tomEscuro = false,
  variante = 'icone',
  veiculosMapa = [],
  veiculoMeta = null,
  preferirMapa = false,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const aberto = Boolean(anchorEl);
  const campo = variante === 'campo';
  const fallback = useMemo(
    () => veiculosMapa.map(posicaoParaVeiculoCatalogo),
    [veiculosMapa],
  );

  const catalogo = preferirMapa && fallback.length ? fallback : veiculos.length ? veiculos : fallback;

  const veiculosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = catalogo;
    if (regiaoFiltro !== '') {
      const id = Number(regiaoFiltro);
      lista = lista.filter((v) => v.id_regiao != null && Number(v.id_regiao) === id);
    }
    if (q) {
      lista = lista.filter((v) => {
        const texto = [v.placa, v.marca, v.modelo, v.nome_regiao, v.nome_responsavel]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return texto.includes(q);
      });
    }
    return [...lista].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR'));
  }, [catalogo, regiaoFiltro, busca]);

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
        if (!cancelado) setVeiculos(lista.length ? lista : fallback);
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

  const rotuloCampo = veiculoSelecionado ? rotuloVeiculo(veiculoSelecionado) : 'Buscar veículo';
  const posicaoPorId = useMemo(() => {
    const map = new Map<number, FrotaVeiculoPosicao>();
    for (const v of veiculosMapa) map.set(v.id_veiculo, v);
    return map;
  }, [veiculosMapa]);

  return (
    <>
      {campo ? (
        <button
          type="button"
          className="ck-mapa__consulta-field"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Selecionar veículo para trajeto"
        >
          <span className="ck-mapa__consulta-label">Veículo</span>
          <span className="ck-mapa__consulta-value">
            <DirectionsCarFilledOutlinedIcon sx={{ fontSize: 18, color: colors.navy, flexShrink: 0 }} />
            <span className="ck-mapa__consulta-value-txt">{rotuloCampo}</span>
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
      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setBusca('');
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: campo ? 'left' : 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: campo ? 'left' : 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2.5, width: 320, maxWidth: '92vw' } } }}
      >
        <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.navy }}>
            Escolher veículo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {veiculosFiltrados.length}{' '}
            {veiculosFiltrados.length === 1 ? 'veículo' : 'veículos'} · o mapa vai até ele
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Placa, modelo ou região"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ mt: 1 }}
          />
        </Box>
        {carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : veiculosFiltrados.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2.5 }}>
            {busca.trim() ? 'Nenhum veículo com esse filtro.' : 'Nenhum veículo encontrado nesta região.'}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 320, overflowY: 'auto', py: 0.75 }}>
            {veiculosFiltrados.map((v) => {
              const selecionado = v.id_veiculo === veiculoId;
              const aoVivo = posicaoPorId.get(v.id_veiculo);
              const temGps =
                aoVivo != null &&
                Number.isFinite(Number(aoVivo.latitude)) &&
                Number.isFinite(Number(aoVivo.longitude));
              const status = aoVivo
                ? rotuloStatusVeiculoMapa(statusVeiculoMapa(aoVivo, aoVivo.rastreamento_disponivel !== false))
                : null;
              return (
                <ListItemButton
                  key={v.id_veiculo}
                  selected={selecionado}
                  onClick={() => {
                    onSelect(v);
                    setBusca('');
                    setAnchorEl(null);
                  }}
                  sx={{
                    mx: 0.75,
                    mb: 0.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: selecionado ? 'rgba(232, 82, 10, 0.35)' : 'rgba(27, 42, 107, 0.08)',
                    bgcolor: selecionado ? 'rgba(232, 82, 10, 0.08)' : 'transparent',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(232, 82, 10, 0.1)',
                      '&:hover': { bgcolor: 'rgba(232, 82, 10, 0.14)' },
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'flex-start', width: '100%', py: 0.25 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 1.5,
                        bgcolor: selecionado ? colors.orange : 'rgba(27, 42, 107, 0.07)',
                        color: selecionado ? '#fff' : colors.navy,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <DirectionsCarFilledOutlinedIcon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: colors.navy, lineHeight: 1.2 }}>
                        {v.placa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                        {rotuloModelo(v)}
                        {v.ano ? ` · ${v.ano}` : ''}
                      </Typography>
                      {status && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mt: 0.2, fontWeight: 700, color: temGps ? colors.navy : colors.textMuted }}
                        >
                          {temGps ? status : 'Sem sinal no mapa'}
                        </Typography>
                      )}
                      {v.nome_regiao && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.35 }}>
                          <LocationOnOutlinedIcon sx={{ fontSize: 13, color: colors.orange, opacity: 0.9 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                            {v.nome_regiao}
                          </Typography>
                        </Box>
                      )}
                      {v.nome_responsavel && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                          <PersonOutlineOutlinedIcon sx={{ fontSize: 13, opacity: 0.75 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                            {v.nome_responsavel}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}
