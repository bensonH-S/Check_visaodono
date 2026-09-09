import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../../api/client';
import { fmtBrl, fmtInt, lojaLabel } from './ccFormat';
import { CC_CRITICO, CC_BRAND_ORANGE, CC_TEXT, CC_TEXT_2, CC_TOOLTIP_STYLE } from './ccTheme';
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

  /** Donut só de zerados — sem fatia amarela de “baixa”. */
  const fatias = useMemo(() => {
    const n = Math.max(zerados.length, 0);
    if (!n) return [];
    return [{ name: 'Zerados', value: n, cor: CC_BRAND_ORANGE }];
  }, [zerados.length]);

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
            <Typography sx={{ fontSize: '0.65rem', color: CC_TEXT_2, fontWeight: 600, mt: 0.3 }}>
              valor atual na rede · {fmtInt(zerados.length)} zerados
              {problemas > 0 ? ` · ${fmtInt(problemas)} baixa` : ''}
            </Typography>
          </Box>
          {!zerados.length && !problemas ? (
            <CcEmpty>Nenhum SKU zerado ou supercrítico agora.</CcEmpty>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.25, minHeight: 128, minWidth: 0 }}>
              <Box
                sx={{
                  width: 84,
                  height: 128,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {fatias.length ? (
                  <Box sx={{ width: 84, height: 84, position: 'relative', flexShrink: 0 }}>
                    <PieChart width={84} height={84} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={fatias}
                        dataKey="value"
                        nameKey="name"
                        cx={42}
                        cy={42}
                        innerRadius={27}
                        outerRadius={38}
                        paddingAngle={0}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {fatias.map((f) => (
                          <Cell key={f.name} fill={f.cor} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                            const cx = Number(viewBox.cx);
                            const cy = Number(viewBox.cy);
                            return (
                              <g>
                                <text
                                  x={cx}
                                  y={cy - 5}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="var(--ga-text-primary)"
                                  style={{ fontSize: 15, fontWeight: 800 }}
                                >
                                  {fmtInt(zerados.length)}
                                </text>
                                <text
                                  x={cx}
                                  y={cy + 11}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="var(--ga-text-secondary)"
                                  style={{ fontSize: 9, fontWeight: 700 }}
                                >
                                  zerados
                                </text>
                              </g>
                            );
                          }}
                        />
                      </Pie>
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value) => [fmtInt(Number(value)), 'itens']}
                        {...CC_TOOLTIP_STYLE}
                      />
                    </PieChart>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 84,
                      height: 84,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: 0.5,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.68rem', color: CC_TEXT_2, textAlign: 'center', fontWeight: 600 }}>
                      Sem zerados
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0, height: 128 }}>
                {porLoja.length ? (
                  <ResponsiveContainer width="100%" height={128} minWidth={0} minHeight={128}>
                    <BarChart data={porLoja} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide domain={[0, maxBar]} />
                      <YAxis
                        type="category"
                        dataKey="loja"
                        width={78}
                        tick={{ fill: 'var(--ga-text-primary)', fontSize: 10, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value) => [fmtInt(Number(value)), 'SKUs zerados']}
                        {...CC_TOOLTIP_STYLE}
                      />
                      <Bar dataKey="n" radius={[0, 4, 4, 0]} barSize={9}>
                        {porLoja.map((l) => (
                          <Cell key={l.loja} fill={l.n >= 4 ? CC_CRITICO : CC_BRAND_ORANGE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography sx={{ fontSize: '0.72rem', color: CC_TEXT_2, py: 2, fontWeight: 600 }}>
                    {problemas > 0
                      ? `${fmtInt(problemas)} itens supercríticos de baixa`
                      : 'Sem lojas com SKU zerado'}
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
