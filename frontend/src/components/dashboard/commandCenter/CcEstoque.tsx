import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api, type EstoqueContagemRedeItem, type EstoqueSaudeBaixaProblema } from '../../../api/client';
import { useCommandCenterFilters } from '../../../context/CommandCenterFiltersContext';
import { fmtInt, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_OK, CC_ORANGE, CC_RADIUS, CC_SURFACE } from './ccTheme';

type Tab = 'contagem' | 'baixo' | 'pendencias';

type ItemBaixo = {
  id_loja: number;
  loja: string;
  codigo: string;
  descricao: string;
  quantidade: number;
};

function statusOrdem(s: EstoqueContagemRedeItem['status']) {
  if (s === 'faltou') return 0;
  if (s === 'aberta') return 1;
  return 2;
}

function statusCor(s: EstoqueContagemRedeItem['status']) {
  if (s === 'faltou') return CC_CRITICO;
  if (s === 'aberta') return CC_ORANGE;
  return CC_OK;
}

function dataCurta(iso: string | null) {
  if (!iso) return '—';
  const p = iso.slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}`;
}

export default function CcEstoque() {
  const { data: dataFiltro } = useCommandCenterFilters();
  const [tab, setTab] = useState<Tab>('contagem');
  const [lojas, setLojas] = useState<EstoqueContagemRedeItem[]>([]);
  const [baixos, setBaixos] = useState<ItemBaixo[]>([]);
  const [problemas, setProblemas] = useState<EstoqueSaudeBaixaProblema[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.estoqueContagensRede({ tipo: 'diaria', data: dataFiltro }).catch(() => null),
      api.estoqueSaldosRedeBaixo().catch(() => null),
      api.estoqueSaudeBaixa({ escopo: 'rede' }).catch(() => null),
    ]).then(([rede, baixo, saude]) => {
      if (cancel) return;
      if (!rede) {
        setErr('Sem acesso ao estoque da rede.');
        setLojas([]);
        return;
      }
      setErr('');
      setLojas(rede.lojas || []);
      setBaixos(baixo?.itens || []);
      setProblemas(saude?.problemas || []);
    });
    return () => {
      cancel = true;
    };
  }, [dataFiltro]);

  const totais = useMemo(() => {
    const faltou = lojas.filter((l) => l.status === 'faltou').length;
    const aberta = lojas.filter((l) => l.status === 'aberta').length;
    const contou = lojas.filter((l) => l.status === 'contou').length;
    return { faltou, aberta, contou, total: lojas.length };
  }, [lojas]);

  const listaContagem = useMemo(
    () =>
      [...lojas]
        .sort((a, b) => {
          const d = statusOrdem(a.status) - statusOrdem(b.status);
          if (d !== 0) return d;
          return (a.name || '').localeCompare(b.name || '', 'pt-BR');
        })
        .slice(0, 5),
    [lojas],
  );

  const listaBaixo = useMemo(() => baixos.slice(0, 5), [baixos]);
  const listaPend = useMemo(
    () => [...problemas].sort((a, b) => (b.vezes || 0) - (a.vezes || 0)).slice(0, 5),
    [problemas],
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'contagem', label: 'Contagem', count: totais.faltou + totais.aberta },
    { id: 'baixo', label: 'Zerados', count: baixos.length },
    { id: 'pendencias', label: 'Baixa', count: problemas.length },
  ];

  const subtitulo =
    tab === 'contagem'
      ? totais.total
        ? `${fmtInt(totais.contou)} de ${fmtInt(totais.total)} já contaram`
        : 'Contagem diária'
      : tab === 'baixo'
        ? baixos.length
          ? `${fmtInt(baixos.length)} itens da diária em zero`
          : 'Itens da diária zerados'
        : problemas.length
          ? `${fmtInt(problemas.length)} SKUs com problema na baixa`
          : 'Pendências da baixa automática';

  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.5,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: 'var(--ga-text-primary)' }}>
            ESTOQUE DA REDE
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            {subtitulo}
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/estoque"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Ver estoque
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.75, mb: 1, borderBottom: `1px solid ${CC_BORDER}` }}>
        {tabs.map((t) => {
          const ativo = tab === t.id;
          return (
            <Box
              key={t.id}
              component="button"
              type="button"
              onClick={() => setTab(t.id)}
              sx={{
                border: 0,
                cursor: 'pointer',
                bgcolor: 'transparent',
                px: 0,
                pb: 0.65,
                mb: '-1px',
                fontSize: '0.72rem',
                fontWeight: ativo ? 650 : 500,
                color: ativo ? CC_ORANGE : CC_MUTED,
                borderBottom: '2px solid',
                borderColor: ativo ? CC_ORANGE : 'transparent',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                '&:hover': { color: ativo ? CC_ORANGE : 'var(--ga-text-primary)' },
              }}
            >
              {t.label}
              {t.count > 0 ? ` ${t.count}` : ''}
            </Box>
          );
        })}
      </Box>

      {err ? (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 2 }}>{err}</Typography>
      ) : tab === 'contagem' ? (
        !listaContagem.length ? (
          <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 1.5 }}>
            Nenhuma loja na rede de estoque.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, flex: 1, minHeight: 0 }}>
            {listaContagem.map((l, i) => (
              <Box key={l.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography sx={{ width: 14, fontSize: '0.75rem', fontWeight: 750, color: statusCor(l.status), flexShrink: 0 }}>
                  {i + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--ga-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lojaLabel(l.name)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: statusCor(l.status), flexShrink: 0 }}>
                      {l.status_label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: 'var(--ga-text-muted)' }}>
                    Última: {dataCurta(l.ultima_data)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )
      ) : tab === 'baixo' ? (
        !listaBaixo.length ? (
          <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 1.5 }}>
            Nenhum item da diária zerado.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, flex: 1, minHeight: 0 }}>
            {listaBaixo.map((item, i) => (
              <Box key={`${item.id_loja}-${item.codigo}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography sx={{ width: 14, fontSize: '0.75rem', fontWeight: 750, color: CC_CRITICO, flexShrink: 0 }}>
                  {i + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--ga-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.descricao}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: CC_CRITICO, flexShrink: 0 }}>
                      {Number(item.quantidade).toLocaleString('pt-BR')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: 'var(--ga-text-muted)' }}>
                    {lojaLabel(item.loja)} · {item.codigo}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )
      ) : !listaPend.length ? (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 1.5 }}>
          Nenhuma pendência na baixa.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, flex: 1, minHeight: 0 }}>
          {listaPend.map((p, i) => (
            <Box key={`${p.codigo}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography sx={{ width: 14, fontSize: '0.75rem', fontWeight: 750, color: CC_ORANGE, flexShrink: 0 }}>
                {i + 1}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--ga-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.nome || p.codigo}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: CC_ORANGE, flexShrink: 0 }}>
                    {fmtInt(p.vezes)}x
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.62rem', color: 'var(--ga-text-muted)' }}>
                  {p.problema || p.motivo} · {fmtInt(p.lojas)} lojas
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
