import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';

export const corEstoque = {
  azul: '#1B6EF3',
  laranja: '#C47A2A',
  vermelho: '#C4452D',
  verde: '#2E7D5B',
  roxo: '#7C5CC4',
  cinza: '#64748B',
} as const;

export const cartaoSx = {
  border: '1px solid var(--ga-border)',
  borderRadius: '10px',
  bgcolor: 'var(--ga-surface)',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
} as const;

export const rotuloSx = {
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const;

export const cabecaTabelaSx = {
  '& th': {
    fontSize: 11,
    fontWeight: 650,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    bgcolor: 'var(--ga-surface)',
    borderBottom: '1px solid var(--ga-border)',
    py: 1,
    whiteSpace: 'nowrap',
  },
} as const;

export const linhasTabelaSx = {
  '& td': { borderColor: 'var(--ga-border)', py: 1, fontSize: 13 },
} as const;

export type Indicador = {
  rotulo: string;
  valor: ReactNode;
  sub?: ReactNode;
  cor?: string;
  /** 0..1 — barra fina abaixo do valor. */
  barra?: number | null;
  corBarra?: string;
};

/** Faixa de indicadores no topo da aba: o primeiro é o destaque. */
export function PainelIndicadores({ itens, aviso }: { itens: Indicador[]; aviso?: ReactNode }) {
  const [principal, ...resto] = itens;
  if (!principal) return null;
  return (
    <Paper
      variant="outlined"
      sx={{
        ...cartaoSx,
        flexShrink: 0,
        px: 2.25,
        py: 1.75,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr 1fr',
          md: `minmax(260px, 1.3fr) repeat(${Math.max(1, resto.length)}, minmax(0, 1fr))`,
        },
        columnGap: 2.5,
        rowGap: 1.5,
        alignItems: 'center',
      }}
    >
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}>
        <Typography sx={rotuloSx}>{principal.rotulo}</Typography>
        <Typography
          noWrap
          sx={{
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: principal.cor || 'text.primary',
            mt: 0.25,
          }}
        >
          {principal.valor}
        </Typography>
        {principal.barra != null ? (
          <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: 'var(--ga-border)', mt: 1, overflow: 'hidden' }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                width: `${Math.max(0, Math.min(1, principal.barra)) * 100}%`,
                borderRadius: 3,
                bgcolor: principal.corBarra || corEstoque.azul,
              }}
            />
          </Box>
        ) : null}
        {principal.sub ? (
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
            {principal.sub}
          </Typography>
        ) : null}
      </Box>
      {resto.map((s) => (
        <Box key={s.rotulo} sx={{ borderLeft: { md: '1px solid var(--ga-border)' }, pl: { md: 2.5 }, minWidth: 0 }}>
          <Typography sx={rotuloSx}>{s.rotulo}</Typography>
          <Typography
            noWrap
            sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: s.cor || 'text.primary', mt: 0.25 }}
          >
            {s.valor}
          </Typography>
          {s.sub ? (
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
              {s.sub}
            </Typography>
          ) : null}
        </Box>
      ))}
      {aviso ? (
        <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(196, 69, 45, 0.07)' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: corEstoque.vermelho, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, color: '#8F2F1D' }}>{aviso}</Typography>
        </Box>
      ) : null}
    </Paper>
  );
}

/** Topo do cartão: título + subtítulo à esquerda, controles à direita. */
export function CabecalhoCartao({ titulo, sub, children }: { titulo: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderBottom: '1px solid var(--ga-border)', flexShrink: 0, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>{titulo}</Typography>
        {sub ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography> : null}
      </Box>
      {children ? (
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', ml: 'auto', flexWrap: 'wrap' }}>{children}</Box>
      ) : null}
    </Box>
  );
}

export type OpcaoFiltro = { id: string; label: string; qtd?: number };

/** Filtro discreto: um seletor só. Opção zerada não aparece. */
export function SeletorFiltro({
  valor,
  onChange,
  opcoes,
  largura = 168,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoFiltro[];
  largura?: number;
}) {
  const visiveis = opcoes.filter((o, i) => i === 0 || o.qtd == null || o.qtd > 0 || o.id === valor);
  return (
    <TextField
      select
      size="small"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      sx={{ width: largura, flexShrink: 0, '& .MuiOutlinedInput-root': { height: 32, fontSize: 13 } }}
    >
      {visiveis.map((o) => (
        <MenuItem key={o.id} value={o.id} sx={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          {o.label}
          {o.qtd != null ? (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {o.qtd}
            </Typography>
          ) : null}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function CampoBusca({
  valor,
  onChange,
  placeholder,
  largura = 220,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  largura?: number;
}) {
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        },
      }}
      sx={{ width: { xs: 160, sm: largura }, '& .MuiOutlinedInput-root': { height: 32, fontSize: 13 } }}
    />
  );
}

/** Selo de situação: ponto colorido + texto. */
export function Selo({ label, cor, fundo }: { label: string; cor: string; fundo?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        px: 1,
        height: 22,
        borderRadius: '999px',
        bgcolor: fundo || 'var(--ga-canvas-alt)',
        color: cor,
        fontSize: 11.5,
        fontWeight: 650,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cor }} />
      {label}
    </Box>
  );
}
