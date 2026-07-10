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
import { api, type FrotaVeiculo } from '../../api/client';
import { colors } from '../../theme/tokens';

type Props = {
  veiculoId: number | null;
  regiaoFiltro: number | '';
  onSelect: (veiculo: FrotaVeiculo) => void;
};

function rotuloVeiculo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo ? `${v.placa} · ${modelo}` : v.placa;
}

function rotuloModelo(v: FrotaVeiculo) {
  const modelo = [v.marca, v.modelo].filter(Boolean).join(' ');
  return modelo || 'Modelo não informado';
}

export default function MapaFiltroTrajetoVeiculo({ veiculoId, regiaoFiltro, onSelect }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const aberto = Boolean(anchorEl);

  const veiculosFiltrados = useMemo(() => {
    if (regiaoFiltro === '') return veiculos;
    const id = Number(regiaoFiltro);
    return veiculos.filter((v) => v.id_regiao != null && Number(v.id_regiao) === id);
  }, [veiculos, regiaoFiltro]);

  const veiculoSelecionado = useMemo(
    () => veiculos.find((v) => v.id_veiculo === veiculoId) ?? null,
    [veiculos, veiculoId],
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
        if (!cancelado) setVeiculos([]);
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

  return (
    <>
      <Tooltip title={tooltip} arrow>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Selecionar veículo para trajeto"
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            bgcolor: veiculoId ? colors.orange : 'rgba(27, 42, 107, 0.06)',
            color: veiculoId ? '#fff' : colors.navy,
            boxShadow: veiculoId ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
            '&:hover': {
              bgcolor: veiculoId ? colors.orange : 'rgba(27, 42, 107, 0.1)',
            },
          }}
        >
          <DirectionsCarFilledOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 2.5, width: 320, maxWidth: '92vw' } } }}
      >
        <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.navy }}>
            Veículo do trajeto
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {veiculosFiltrados.length}{' '}
            {veiculosFiltrados.length === 1 ? 'veículo disponível' : 'veículos disponíveis'}
          </Typography>
        </Box>
        {carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : veiculosFiltrados.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2.5 }}>
            Nenhum veículo encontrado nesta região.
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 320, overflowY: 'auto', py: 0.75 }}>
            {veiculosFiltrados.map((v) => {
              const selecionado = v.id_veiculo === veiculoId;
              return (
                <ListItemButton
                  key={v.id_veiculo}
                  selected={selecionado}
                  onClick={() => {
                    onSelect(v);
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
