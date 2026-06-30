import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useMapaTecnicosMobile } from '../../pages/mapa/MapaTecnicosMobileContext';
import { colors } from '../../theme/tokens';

export default function MapaTecnicosListaLojas() {
  const { lojasComCoordenadas, lojaSelecionada, selecionarLoja, limparLoja } = useMapaTecnicosMobile();
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState('');

  const lojasOrdenadas = useMemo(
    () => [...lojasComCoordenadas].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [lojasComCoordenadas],
  );

  const lojasFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return lojasOrdenadas;
    return lojasOrdenadas.filter((l) => {
      const texto = `${l.name} ${l.bk_number ?? ''} ${l.city ?? ''} ${l.neighborhood ?? ''}`.toLowerCase();
      return texto.includes(q);
    });
  }, [lojasOrdenadas, filtro]);

  function escolher(idLoja: number) {
    const loja = lojasComCoordenadas.find((l) => l.id_loja === idLoja);
    if (loja) {
      selecionarLoja(loja);
      setAberto(false);
      setFiltro('');
    }
  }

  return (
    <>
      <Box
        sx={{
          mb: 1.25,
          p: 1.25,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 10px rgba(0,0,0,.06)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: colors.navy, display: 'block', mb: 0.75 }}>
          Escolha a unidade ou toque no mapa
        </Typography>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setAberto(true)}
          startIcon={<StorefrontOutlinedIcon />}
          endIcon={<ExpandMoreIcon />}
          sx={{
            justifyContent: 'space-between',
            textAlign: 'left',
            py: 1.1,
            px: 1.5,
            borderRadius: 1.5,
            borderColor: 'divider',
            color: lojaSelecionada ? colors.navy : 'text.secondary',
            fontWeight: lojaSelecionada ? 700 : 500,
            textTransform: 'none',
            '& .MuiButton-endIcon': { ml: 'auto' },
          }}
        >
          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {lojaSelecionada
              ? lojaSelecionada.name
              : `Ver lista de unidades (${lojasComCoordenadas.length})`}
          </Box>
        </Button>
        {lojaSelecionada && (
          <Button
            size="small"
            onClick={limparLoja}
            sx={{ mt: 0.75, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Limpar seleção
          </Button>
        )}
      </Box>

      <Drawer
        anchor="bottom"
        open={aberto}
        onClose={() => setAberto(false)}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '82vh',
              pb: 'env(safe-area-inset-bottom, 0px)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colors.navy }}>
                Unidades no mapa
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lojasFiltradas.length} de {lojasComCoordenadas.length} lojas
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setAberto(false)} aria-label="Fechar lista">
              <CloseIcon />
            </IconButton>
          </Box>

          <TextField
            size="small"
            fullWidth
            placeholder="Filtrar por nome, BKN ou cidade..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <List
            dense
            sx={{
              maxHeight: 'calc(82vh - 160px)',
              overflowY: 'auto',
              mx: -1,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {lojasFiltradas.map((loja) => {
              const selecionada = lojaSelecionada?.id_loja === loja.id_loja;
              return (
                <ListItemButton
                  key={loja.id_loja}
                  selected={selecionada}
                  onClick={() => escolher(loja.id_loja)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.25,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(232, 82, 10, 0.1)',
                      borderLeft: `3px solid ${colors.orange}`,
                    },
                  }}
                >
                  <ListItemText
                    primary={loja.name}
                    secondary={[loja.bk_number ? `BKN ${loja.bk_number}` : null, loja.city, loja.state]
                      .filter(Boolean)
                      .join(' · ')}
                    slotProps={{
                      primary: { sx: { fontWeight: 700, fontSize: '0.875rem' } },
                      secondary: { sx: { fontSize: '0.75rem' } },
                    }}
                  />
                </ListItemButton>
              );
            })}
            {lojasFiltradas.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Nenhuma unidade encontrada
              </Typography>
            )}
          </List>
        </Box>
      </Drawer>
    </>
  );
}
