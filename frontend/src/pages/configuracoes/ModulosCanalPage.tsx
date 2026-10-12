import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { api } from '../../api/client';
import {
  CATALOGO_MODULOS,
  gravarModulosCanalCache,
  MODULOS_CANAL_PADRAO,
  normalizarModulosCanal,
  type CanalApp,
  type ModuloCanalCodigo,
  type ModulosCanalMapa,
} from '../../config/modulosCanal';
import { showToast } from '../../utils/toast';
import { configPageSx, configPaperSx, FIN_BORDER, FIN_MUTED, FIN_SURFACE_ALT, FIN_TEXT } from './configPageSx';

const SECOES = [...new Set(CATALOGO_MODULOS.map((m) => m.secao))];

export default function ModulosCanalPage() {
  const [modulos, setModulos] = useState<ModulosCanalMapa>(MODULOS_CANAL_PADRAO);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const porSecao = useMemo(
    () =>
      SECOES.map((secao) => ({
        secao,
        itens: CATALOGO_MODULOS.filter((m) => m.secao === secao),
      })),
    [],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = normalizarModulosCanal(await api.modulosCanalObter());
      setModulos(data);
      gravarModulosCanalCache(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alterar(codigo: ModuloCanalCodigo, canal: CanalApp, valor: boolean) {
    const anterior = modulos;
    const proximo = {
      ...modulos,
      [codigo]: { ...modulos[codigo], [canal]: valor },
    };
    setModulos(proximo);
    setSalvando(`${codigo}.${canal}`);
    try {
      const salvo = normalizarModulosCanal(await api.modulosCanalSalvar({ [codigo]: proximo[codigo] }));
      setModulos(salvo);
      gravarModulosCanalCache(salvo);
      showToast('Canais atualizados', 'success', { toastId: 'modulos-canal' });
    } catch (e) {
      setModulos(anterior);
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Box sx={{ ...configPageSx, maxWidth: 920, overflowY: 'auto' }}>
      {loading ? <LinearProgress /> : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      {porSecao.map(({ secao, itens }) => (
        <Paper key={secao} elevation={0} sx={{ ...configPaperSx, flex: 'none', minHeight: 0 }}>
          <Typography
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: FIN_SURFACE_ALT,
              color: FIN_MUTED,
              borderBottom: `1px solid ${FIN_BORDER}`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {secao}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 650, color: FIN_MUTED }}>Função</TableCell>
                <TableCell align="center" sx={{ fontWeight: 650, color: FIN_MUTED, width: 110 }}>
                  Portal
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 650, color: FIN_MUTED, width: 110 }}>
                  App
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((cat) => {
                const item = modulos[cat.codigo];
                return (
                  <TableRow key={cat.codigo} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: FIN_TEXT }}>{cat.nome}</Typography>
                      <Typography variant="caption" sx={{ color: FIN_MUTED }}>
                        {cat.descricao}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {cat.temPortal ? (
                        <Switch
                          size="small"
                          checked={item.portal}
                          disabled={loading || salvando != null}
                          onChange={(_, v) => void alterar(cat.codigo, 'portal', v)}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {cat.temMobile ? (
                        <Switch
                          size="small"
                          checked={item.mobile}
                          disabled={loading || salvando != null}
                          onChange={(_, v) => void alterar(cat.codigo, 'mobile', v)}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      ))}
    </Box>
  );
}
