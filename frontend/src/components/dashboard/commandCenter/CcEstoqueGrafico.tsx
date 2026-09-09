import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../../api/client';
import { fmtBrl, fmtInt, lojaLabel } from './ccFormat';
import { CC_CRITICO, CC_MUTED, CC_ORANGE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSectionTitle, CcSkeleton } from './CcPanel';

type ItemZerado = {
  id_loja: number;
  loja: string;
  codigo: string;
};

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

export default function CcEstoqueGrafico() {
  const [zerados, setZerados] = useState<ItemZerado[]>([]);
  const [problemas, setProblemas] = useState(0);
  const [valorAtual, setValorAtual] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.estoqueSaldosRedeBaixo().catch(() => null),
      api.estoqueSaudeBaixa({ escopo: 'rede' }).catch(() => null),
      api.estoqueSaldosRedeValor().catch(() => null),
    ]).then(([baixo, saude, valor]) => {
      if (cancel) return;
      if (!baixo && !saude && !valor) {
        setErr('Sem acesso ao estoque da rede.');
        setZerados([]);
        setProblemas(0);
        setValorAtual(null);
        setLoading(false);
        return;
      }
      setErr('');
      setZerados((baixo?.itens ?? []) as ItemZerado[]);
      setProblemas(saude?.problemas?.length ?? 0);
      setValorAtual(valor?.valor_atual ?? null);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const porLoja = useMemo(() => {
    const map = new Map<number, { loja: string; n: number }>();
    for (const z of zerados) {
      const cur = map.get(z.id_loja) || { loja: lojaCurta(z.loja), n: 0 };
      cur.n += 1;
      map.set(z.id_loja, cur);
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  }, [zerados]);

  const fatias = useMemo(
    () =>
      [
        { name: 'Zerados', value: zerados.length, cor: CC_ORANGE },
        { name: 'Baixa', value: problemas, cor: CC_WARN },
      ].filter((f) => f.value > 0),
    [zerados.length, problemas],
  );

  const maxBar = Math.max(1, ...porLoja.map((l) => l.n));

  return (
    <Box sx={{ flexShrink: 0 }}>
      <CcSectionTitle title="Estoque" action="Ver estoque" actionTo="/estoque" />
      {loading ? (
        <CcSkeleton height={168} />
      ) : err ? (
        <CcEmpty>{err}</CcEmpty>
      ) : (
        <>
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: CC_TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {fmtBrl(valorAtual)}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: CC_MUTED, fontWeight: 600, mt: 0.3 }}>
              valor atual na rede · {fmtInt(zerados.length)} zerados · {fmtInt(problemas)} baixa
            </Typography>
          </Box>
          {!zerados.length && !problemas ? (
            <CcEmpty>Nenhum SKU zerado ou supercrítico agora.</CcEmpty>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.25, minHeight: 128, minWidth: 0 }}>
              <Box sx={{ width: 84, height: 128, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fatias.length ? fatias : [{ name: '—', value: 1, cor: CC_MUTED }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={fatias.length > 1 ? 3 : 0}
                      stroke="none"
                    >
                      {(fatias.length ? fatias : [{ name: '—', value: 1, cor: CC_MUTED }]).map((f) => (
                        <Cell key={f.name} fill={f.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [fmtInt(Number(value)), 'itens']}
                      contentStyle={{
                        background: '#111110',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#F4F1EC',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: CC_CRITICO, lineHeight: 1 }}>
                    {fmtInt(zerados.length)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.52rem', color: CC_MUTED, fontWeight: 600, mt: 0.15 }}>
                    zerados
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                {porLoja.length ? (
                  <ResponsiveContainer width="100%" height={128}>
                    <BarChart data={porLoja} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide domain={[0, maxBar]} />
                      <YAxis
                        type="category"
                        dataKey="loja"
                        width={78}
                        tick={{ fill: '#9A958E', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [fmtInt(Number(value)), 'SKUs zerados']}
                        contentStyle={{
                          background: '#111110',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#F4F1EC',
                        }}
                      />
                      <Bar dataKey="n" radius={[0, 4, 4, 0]} barSize={9}>
                        {porLoja.map((l) => (
                          <Cell key={l.loja} fill={l.n >= 4 ? CC_CRITICO : CC_ORANGE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography sx={{ fontSize: '0.72rem', color: CC_MUTED, py: 2 }}>
                    {fmtInt(problemas)} itens supercríticos de baixa
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
