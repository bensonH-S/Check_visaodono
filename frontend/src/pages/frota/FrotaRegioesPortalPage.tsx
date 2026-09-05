import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EngineeringIcon from '@mui/icons-material/Engineering';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import {
  api,
  type FrotaRegiaoCatalogo,
  type FrotaRegiaoDetalhe,
  type FrotaRegiaoLoja,
  type FrotaRegiaoResumo,
  type FrotaRegiaoTecnico,
  type FrotaRegiaoVeiculo,
  type FrotaTecnicoPosicao,
  type FrotaVeiculoHistoricoPonto,
  type FrotaVeiculoPosicao,
} from '../../api/client';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import { useAppConfig } from '../../hooks/useAppConfig';
import { labelFixo } from '../../constants/frotaVeiculo';
import { colors } from '../../theme/tokens';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';
import { pageFillLayoutSx } from '../../utils/pageFillLayout';

const CATALOGO_VAZIO: FrotaRegiaoCatalogo = {
  lojas: [],
  tecnicos: [],
  regionais: [],
  veiculos: [],
};

const gridCardsVinculoSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
  gap: { xs: 0.75, md: 1 },
} as const;

const paperCardVinculoSx = {
  px: { xs: 1, md: 1.25 },
  py: { xs: 0.75, md: 1 },
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  borderColor: colors.border,
} as const;

function pluralizar(qtd: number, singular: string, plural: string) {
  return qtd === 1 ? singular : plural;
}

function textoContagem(qtd: number, singular: string, plural: string) {
  return `${qtd} ${pluralizar(qtd, singular, plural)}`;
}

function textoVinculados(qtd: number, singular: string, plural: string, genero: 'f' | 'm' = 'm') {
  const adj = genero === 'f' ? (qtd === 1 ? 'vinculada' : 'vinculadas') : qtd === 1 ? 'vinculado' : 'vinculados';
  return `${textoContagem(qtd, singular, plural)} ${adj}`;
}

function ChipContagem({
  qtd,
  singular,
  plural,
  icon,
  compacto = false,
}: {
  qtd: number;
  singular: string;
  plural: string;
  icon: ReactElement;
  compacto?: boolean;
}) {
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={icon}
      label={textoContagem(qtd, singular, plural)}
      sx={{
        height: compacto ? 22 : 24,
        fontSize: compacto ? '0.65rem' : '0.72rem',
        borderColor: colors.border,
        bgcolor: 'rgba(232, 82, 10, 0.08)',
        maxWidth: compacto ? '100%' : undefined,
        '& .MuiChip-label': compacto ? { px: 0.75 } : undefined,
        '& .MuiChip-icon': { fontSize: compacto ? '0.8rem' : '0.9rem', ml: compacto ? 0.35 : 0.5 },
      }}
    />
  );
}

function cidadeUfLoja(l: FrotaRegiaoLoja) {
  return [l.city, l.state].filter(Boolean).join(' / ');
}

function ordenarLojas(a: FrotaRegiaoLoja, b: FrotaRegiaoLoja) {
  const bknA = a.bk_number?.replace(/\D/g, '') || '';
  const bknB = b.bk_number?.replace(/\D/g, '') || '';
  if (bknA && bknB && bknA !== bknB) {
    return Number(bknA) - Number(bknB) || bknA.localeCompare(bknB, 'pt-BR', { numeric: true });
  }
  if (bknA && !bknB) return -1;
  if (!bknA && bknB) return 1;
  return a.name.localeCompare(b.name, 'pt-BR');
}

function LojaLinhaMenu({ loja, compacto = false }: { loja: FrotaRegiaoLoja; compacto?: boolean }) {
  const cidade = cidadeUfLoja(loja);
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: compacto ? 1 : 1.5, width: '100%', py: 0.25 }}>
      <Box
        sx={{
          minWidth: compacto ? 52 : 64,
          px: compacto ? 0.75 : 1,
          py: compacto ? 0.5 : 0.75,
          borderRadius: 1,
          bgcolor: 'rgba(232, 82, 10, 0.08)',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.6rem' }}>
          BKN
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: compacto ? '0.72rem' : '0.8rem' }}>
          {loja.bk_number || '—'}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: 'normal',
            fontSize: compacto ? '0.78rem' : '0.85rem',
          }}
        >
          {loja.name}
        </Typography>
        {cidade && !compacto ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
            {cidade}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function parseIdsMultiSelect(value: unknown): number[] {
  const lista = (typeof value === 'string' ? value.split(',') : value) as string[];
  return [...new Set((lista || []).map(Number).filter(Boolean))];
}

function renderPlaceholder(texto: string) {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      {texto}
    </Box>
  );
}

function SelecaoLojasRegiao({
  lojas,
  selecionados,
  onChange,
}: {
  lojas: FrotaRegiaoLoja[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
}) {
  const [pick, setPick] = useState<string[]>([]);

  const mapa = useMemo(() => new Map(lojas.map((l) => [l.id_loja, l])), [lojas]);

  const disponiveis = useMemo(
    () => [...lojas].filter((l) => !selecionados.includes(l.id_loja)).sort(ordenarLojas),
    [lojas, selecionados],
  );

  function confirmarPick() {
    const novos = pick.map(Number).filter(Boolean);
    if (novos.length) {
      onChange([...new Set([...selecionados, ...novos])]);
    }
    setPick([]);
  }

  function remover(id: number) {
    onChange(selecionados.filter((x) => x !== id));
  }

  const selecionadasOrdenadas = useMemo(
    () =>
      selecionados
        .map((id) => mapa.get(id))
        .filter((l): l is FrotaRegiaoLoja => !!l)
        .sort(ordenarLojas),
    [selecionados, mapa],
  );

  return (
    <Box>
      <TextField
        select
        fullWidth
        size="small"
        label="Adicionar lojas"
        value={pick}
        onChange={(e) => setPick(parseIdsMultiSelect(e.target.value).map(String))}
        helperText="Selecione uma ou mais lojas. As já vinculadas aparecem somente na lista abaixo."
        slotProps={{
          inputLabel: labelFixo.inputLabel,
          select: {
            multiple: true,
            displayEmpty: true,
            renderValue: () => renderPlaceholder('Selecione as lojas'),
            onClose: confirmarPick,
            ...selectMenuScrollProps,
            MenuProps: {
              ...selectMenuScrollProps.MenuProps,
              slotProps: {
                paper: {
                  sx: {
                    maxHeight: 360,
                    minWidth: 320,
                    maxWidth: 420,
                    overflowY: 'auto',
                  },
                },
              },
            },
          },
        }}
      >
        {disponiveis.length === 0 ? (
          <MenuItem value="" disabled>
            Todas as lojas já foram adicionadas
          </MenuItem>
        ) : (
          disponiveis.map((l) => (
            <MenuItem key={l.id_loja} value={String(l.id_loja)} sx={{ py: 0.75, alignItems: 'stretch' }}>
              <Checkbox
                size="small"
                checked={pick.includes(String(l.id_loja))}
                sx={{ p: 0.5, mr: 1, alignSelf: 'center' }}
              />
              <LojaLinhaMenu loja={l} />
            </MenuItem>
          ))
        )}
      </TextField>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 1, fontWeight: 600 }}>
        {textoVinculados(selecionados.length, 'loja', 'lojas', 'f')}
      </Typography>

      {selecionadasOrdenadas.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma loja vinculada a esta região.
        </Typography>
      ) : (
        <Box sx={gridCardsVinculoSx}>
          {selecionadasOrdenadas.map((l) => (
            <Paper
              key={l.id_loja}
              variant="outlined"
              sx={paperCardVinculoSx}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LojaLinhaMenu loja={l} compacto />
              </Box>
              <IconButton
                size="small"
                aria-label={`Remover ${l.name}`}
                onClick={() => remover(l.id_loja)}
                sx={{ flexShrink: 0 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ordenarTecnicos(a: FrotaRegiaoTecnico, b: FrotaRegiaoTecnico) {
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

function ordenarVeiculos(a: FrotaRegiaoVeiculo, b: FrotaRegiaoVeiculo) {
  return a.placa.localeCompare(b.placa, 'pt-BR');
}

function TecnicoLinhaMenu({
  tecnico,
  compacto = false,
  ocultarEmail = false,
}: {
  tecnico: FrotaRegiaoTecnico;
  compacto?: boolean;
  ocultarEmail?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0, flex: 1, py: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, fontSize: compacto ? '0.78rem' : '0.85rem' }}>
        {tecnico.nome}
      </Typography>
      {tecnico.email && !ocultarEmail ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25, lineHeight: 1.3, fontSize: compacto ? '0.68rem' : undefined }}
        >
          {tecnico.email}
        </Typography>
      ) : null}
    </Box>
  );
}

function DivisorVerticalCabecalho() {
  return (
    <Box
      role="separator"
      sx={{
        display: { xs: 'none', md: 'block' },
        alignSelf: 'stretch',
        width: '1px',
        minHeight: 40,
        bgcolor: 'divider',
        flexShrink: 0,
        mx: 1,
      }}
    />
  );
}

function SupervisoresRegionaisCabecalho({
  supervisores,
  compact = false,
  varianteLista = false,
}: {
  supervisores: FrotaRegiaoTecnico[];
  compact?: boolean;
  varianteLista?: boolean;
}) {
  if (!supervisores.length) return null;
  const nomes = supervisores.map((s) => s.nome).join(', ');
  return (
    <SupervisorRegionalBloco nome={nomes} compact={compact} ocultarEmail varianteLista={varianteLista} />
  );
}

function SupervisorRegionalBloco({
  nome,
  email,
  compact = false,
  ocultarEmail = false,
  varianteLista = false,
}: {
  nome: string;
  email?: string | null;
  compact?: boolean;
  ocultarEmail?: boolean;
  varianteLista?: boolean;
}) {
  const iconSize = compact ? '0.95rem' : '1rem';
  const corRotulo = varianteLista ? 'text.disabled' : 'text.secondary';
  const corNome = varianteLista ? 'text.secondary' : colors.textPrimary;
  const pesoNome = varianteLista ? 500 : 700;
  return (
    <Box sx={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 0.4, alignItems: 'flex-start', textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        <PersonIcon
          sx={{
            fontSize: iconSize,
            color: varianteLista ? 'text.disabled' : compact ? 'text.secondary' : colors.textPrimary,
            mt: '2px',
            flexShrink: 0,
          }}
        />
        <Typography
          variant={compact ? 'caption' : 'body2'}
          sx={{ lineHeight: 1.4, minWidth: 0, fontSize: compact ? '0.68rem' : '0.8125rem' }}
        >
          <Box component="span" sx={{ fontWeight: 500, color: corRotulo }}>
            Supervisor Regional:{' '}
          </Box>
          <Box component="span" sx={{ fontWeight: pesoNome, color: corNome }}>
            {nome}
          </Box>
        </Typography>
      </Box>
      {email && !ocultarEmail ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <EmailOutlinedIcon
            sx={{ fontSize: iconSize, color: 'text.secondary', mt: '2px', flexShrink: 0 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1.35, minWidth: 0, wordBreak: 'break-word' }}
          >
            {email}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function corParaHex(nome?: string | null): string | null {
  if (!nome) return null;
  const mapa: Record<string, string> = {
    branco: '#f5f5f5',
    branca: '#f5f5f5',
    preto: '#212121',
    preta: '#212121',
    prata: '#bdbdbd',
    cinza: '#9e9e9e',
    cinza_escuro: '#616161',
    vermelho: '#d32f2f',
    vermelha: '#d32f2f',
    azul: '#1976d2',
    verde: '#388e3c',
    amarelo: '#fbc02d',
    amarela: '#fbc02d',
    bege: '#d7ccc8',
    marrom: '#795548',
    laranja: '#f57c00',
    vinho: '#880e4f',
    dourado: '#c9a227',
    dourada: '#c9a227',
  };
  const chave = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return mapa[chave] ?? null;
}

function VeiculoLinhaMenu({
  veiculo,
  compacto = false,
  mostrarRegiao = false,
  modoCard = false,
}: {
  veiculo: FrotaRegiaoVeiculo;
  compacto?: boolean;
  mostrarRegiao?: boolean;
  modoCard?: boolean;
}) {
  const modelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ');
  const hexCor = corParaHex(veiculo.cor);
  const detalhes = [
    veiculo.ano ? `Ano ${veiculo.ano}` : null,
    veiculo.combustivel || null,
  ].filter(Boolean);
  const mini = compacto || modoCard;

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: mini ? 1 : 1.5, width: '100%', py: 0.25 }}>
      <Box
        sx={{
          minWidth: mini ? 52 : 80,
          px: mini ? 0.75 : 1,
          py: mini ? 0.5 : 0.75,
          borderRadius: 1,
          bgcolor: 'rgba(232, 82, 10, 0.08)',
          textAlign: 'center',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.6rem' }}>
          Placa
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: mini ? '0.72rem' : '0.8rem', letterSpacing: 0.5 }}
        >
          {veiculo.placa}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.35 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, fontSize: mini ? '0.78rem' : '0.85rem' }}>
          {modelo || 'Veículo sem marca/modelo'}
        </Typography>
        {!modoCard && veiculo.cor ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: hexCor || 'transparent',
                border: '1.5px solid',
                borderColor: hexCor ? 'divider' : 'text.disabled',
                boxShadow: hexCor ? 'inset 0 0 0 1px rgba(0,0,0,0.06)' : 'none',
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {veiculo.cor}
            </Typography>
          </Box>
        ) : null}
        {!modoCard && detalhes.length > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
            {detalhes.join(' · ')}
          </Typography>
        ) : null}
        {mostrarRegiao && veiculo.nome_regiao ? (
          <Typography variant="caption" color="warning.main" sx={{ lineHeight: 1.3 }}>
            Em outra região: {veiculo.nome_regiao}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function SelecaoPickerMultiplo<T extends { id: number }>({
  label,
  placeholder,
  helperText,
  vazioTexto,
  itemSingular,
  itemPlural,
  itens,
  selecionados,
  onChange,
  renderItem,
  renderLista,
  menuMinWidth = 300,
}: {
  label: string;
  placeholder: string;
  helperText: string;
  vazioTexto: string;
  itemSingular: string;
  itemPlural: string;
  itens: T[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
  renderItem: (item: T) => ReactNode;
  renderLista: (lista: T[], remover: (id: number) => void) => ReactNode;
  menuMinWidth?: number;
}) {
  const [pick, setPick] = useState<string[]>([]);

  const mapa = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  const disponiveis = useMemo(
    () => itens.filter((i) => !selecionados.includes(i.id)),
    [itens, selecionados],
  );

  function confirmarPick() {
    const novos = pick.map(Number).filter(Boolean);
    if (novos.length) {
      onChange([...new Set([...selecionados, ...novos])]);
    }
    setPick([]);
  }

  function remover(id: number) {
    onChange(selecionados.filter((x) => x !== id));
  }

  const selecionadosItens = useMemo(
    () =>
      selecionados
        .map((id) => mapa.get(id))
        .filter((i): i is T => !!i),
    [selecionados, mapa],
  );

  return (
    <Box>
      <TextField
        select
        fullWidth
        size="small"
        label={label}
        value={pick}
        onChange={(e) => setPick(parseIdsMultiSelect(e.target.value).map(String))}
        helperText={helperText}
        slotProps={{
          inputLabel: labelFixo.inputLabel,
          select: {
            multiple: true,
            displayEmpty: true,
            renderValue: () => renderPlaceholder(placeholder),
            onClose: confirmarPick,
            ...selectMenuScrollProps,
            MenuProps: {
              ...selectMenuScrollProps.MenuProps,
              slotProps: {
                paper: {
                  sx: {
                    maxHeight: 360,
                    minWidth: menuMinWidth,
                    maxWidth: 420,
                    overflowY: 'auto',
                  },
                },
              },
            },
          },
        }}
      >
        {disponiveis.length === 0 ? (
          <MenuItem value="" disabled>
            {`Todos os ${itemPlural} já foram adicionados`}
          </MenuItem>
        ) : (
          disponiveis.map((item) => (
            <MenuItem key={item.id} value={String(item.id)} sx={{ py: 0.75, alignItems: 'stretch' }}>
              <Checkbox
                size="small"
                checked={pick.includes(String(item.id))}
                sx={{ p: 0.5, mr: 1, alignSelf: 'flex-start', mt: 0.25 }}
              />
              {renderItem(item)}
            </MenuItem>
          ))
        )}
      </TextField>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 1, fontWeight: 600 }}>
        {textoVinculados(selecionados.length, itemSingular, itemPlural, itemSingular === 'loja' ? 'f' : 'm')}
      </Typography>

      {selecionadosItens.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {vazioTexto}
        </Typography>
      ) : (
        renderLista(selecionadosItens, remover)
      )}
    </Box>
  );
}

function SelecaoTecnicosRegiao({
  tecnicos,
  selecionados,
  gpsPorTecnico,
  onChange,
  onGpsChange,
}: {
  tecnicos: FrotaRegiaoTecnico[];
  selecionados: number[];
  gpsPorTecnico: Record<number, boolean>;
  onChange: (ids: number[]) => void;
  onGpsChange: (idUsuario: number, habilitado: boolean) => void;
}) {
  const itens = useMemo(
    () =>
      tecnicos
        .map((t) => ({ ...t, id: t.id_usuario }))
        .sort(ordenarTecnicos),
    [tecnicos],
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <MyLocationIcon sx={{ fontSize: 18, color: colors.textPrimary }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          Ative o GPS no celular de cada técnico vinculado. Desligado, o app não envia localização.
        </Typography>
      </Box>
      <SelecaoPickerMultiplo
        label="Adicionar técnicos"
        placeholder="Selecione os técnicos"
        helperText="Selecione um ou mais técnicos. Os já vinculados aparecem somente na lista abaixo."
        vazioTexto="Nenhum técnico vinculado a esta região."
        itemSingular="técnico"
        itemPlural="técnicos"
        itens={itens}
        selecionados={selecionados}
        onChange={onChange}
        renderItem={(t) => <TecnicoLinhaMenu tecnico={t} />}
        renderLista={(lista, remover) => (
          <Box sx={gridCardsVinculoSx}>
            {lista.map((t) => (
              <Paper
                key={t.id_usuario}
                variant="outlined"
                sx={{ ...paperCardVinculoSx, alignItems: 'flex-start' }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: 'rgba(232, 82, 10, 0.08)',
                    color: colors.textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    flexShrink: 0,
                  }}
                >
                  {t.nome
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <TecnicoLinhaMenu tecnico={t} compacto />
                  <FormControlLabel
                    sx={{ m: 0, mt: 0.5, alignItems: 'center' }}
                    control={
                      <Switch
                        size="small"
                        checked={gpsPorTecnico[t.id_usuario] !== false}
                        onChange={(_, checked) => onGpsChange(t.id_usuario, checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" color="text.secondary">
                        GPS no celular
                      </Typography>
                    }
                  />
                </Box>
                <IconButton
                  size="small"
                  aria-label={`Remover ${t.nome}`}
                  onClick={() => remover(t.id_usuario)}
                  sx={{ flexShrink: 0, mt: -0.25 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Paper>
            ))}
          </Box>
        )}
      />
    </Box>
  );
}

function SelecaoRegionaisRegiao({
  regionais,
  selecionados,
  onChange,
}: {
  regionais: FrotaRegiaoTecnico[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
}) {
  const itens = useMemo(
    () =>
      regionais
        .map((r) => ({ ...r, id: r.id_usuario }))
        .sort(ordenarTecnicos),
    [regionais],
  );

  return (
    <SelecaoPickerMultiplo
      label="Adicionar supervisores regionais"
      placeholder="Selecione os supervisores"
      helperText="Selecione um ou mais supervisores regionais. Os já vinculados aparecem somente na lista abaixo."
      vazioTexto="Nenhum supervisor regional vinculado a esta região."
      itemSingular="supervisor"
      itemPlural="supervisores"
      itens={itens}
      selecionados={selecionados}
      onChange={onChange}
      renderItem={(r) => <TecnicoLinhaMenu tecnico={r} />}
      renderLista={(lista, remover) => (
        <Box sx={gridCardsVinculoSx}>
          {lista.map((r) => (
            <Paper
              key={r.id_usuario}
              variant="outlined"
              sx={{ ...paperCardVinculoSx, alignItems: 'flex-start' }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: 'rgba(232, 82, 10, 0.08)',
                  color: colors.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  flexShrink: 0,
                }}
              >
                {r.nome
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TecnicoLinhaMenu tecnico={r} compacto />
              </Box>
              <IconButton
                size="small"
                aria-label={`Remover ${r.nome}`}
                onClick={() => remover(r.id_usuario)}
                sx={{ flexShrink: 0, mt: -0.25 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    />
  );
}

function VeiculosRegiaoLeitura({ veiculos }: { veiculos: FrotaRegiaoVeiculo[] }) {
  const ordenados = useMemo(() => [...veiculos].sort(ordenarVeiculos), [veiculos]);

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Aparecem aqui somente veículos sob responsabilidade de um técnico vinculado a esta região.
        Ao devolver o veículo ou quando o responsável não pertence à região, o veículo sai da lista.
      </Alert>
      {ordenados.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Nenhum veículo vinculado a esta região no momento.
        </Typography>
      ) : (
        <Box sx={gridCardsVinculoSx}>
          {ordenados.map((v) => (
            <Paper key={v.id_veiculo} variant="outlined" sx={{ ...paperCardVinculoSx, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <VeiculoLinhaMenu veiculo={v} modoCard />
                {v.nome_responsavel ? (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Responsável: {v.nome_responsavel}
                  </Typography>
                ) : null}
                {(v.odometro_km != null || v.combustivel_litros != null) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.35, display: 'block' }}>
                    {v.odometro_km != null ? `KM rastreador: ${v.odometro_km.toLocaleString('pt-BR')}` : null}
                    {v.odometro_km != null && v.combustivel_litros != null ? ' · ' : null}
                    {v.combustivel_litros != null
                      ? `Combustível: ${v.combustivel_litros.toLocaleString('pt-BR')} L`
                      : null}
                  </Typography>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </>
  );
}

function RegiaoCabecalhoEditavel({
  nome,
  descricao,
  onChangeNome,
  onChangeDescricao,
  onSalvar,
  semMargem = false,
}: {
  nome: string;
  descricao: string;
  onChangeNome: (v: string) => void;
  onChangeDescricao: (v: string) => void;
  onSalvar: (patch: { nome?: string; descricao?: string }) => Promise<void>;
  semMargem?: boolean;
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [nomeDraft, setNomeDraft] = useState(nome);
  const [descDraft, setDescDraft] = useState(descricao);
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  useEffect(() => {
    if (!editandoNome) setNomeDraft(nome);
  }, [nome, editandoNome]);

  useEffect(() => {
    if (!editandoDescricao) setDescDraft(descricao);
  }, [descricao, editandoDescricao]);

  async function confirmarNome() {
    setEditandoNome(false);
    const trimmed = nomeDraft.trim();
    if (!trimmed) {
      showToast('Informe o nome da região', 'warning');
      setNomeDraft(nome);
      return;
    }
    if (trimmed === nome.trim()) return;
    onChangeNome(trimmed);
    setSalvandoMeta(true);
    try {
      await onSalvar({ nome: trimmed });
    } catch {
      setNomeDraft(nome);
      onChangeNome(nome);
    } finally {
      setSalvandoMeta(false);
    }
  }

  async function confirmarDescricao() {
    setEditandoDescricao(false);
    const trimmed = descDraft.trim();
    if (trimmed === descricao.trim()) return;
    onChangeDescricao(trimmed);
    setSalvandoMeta(true);
    try {
      await onSalvar({ descricao: trimmed });
    } catch {
      setDescDraft(descricao);
      onChangeDescricao(descricao);
    } finally {
      setSalvandoMeta(false);
    }
  }

  const hoverEditavel = {
    cursor: 'text',
    borderRadius: 1,
    px: 0.75,
    py: 0.25,
    mx: -0.75,
    transition: 'background-color 0.15s',
    '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.08)' },
  };

  return (
    <Box sx={{ mb: semMargem ? 0 : 1.5 }}>
      {editandoNome ? (
        <TextField
          fullWidth
          size="small"
          value={nomeDraft}
          onChange={(e) => setNomeDraft(e.target.value)}
          onBlur={() => void confirmarNome()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void confirmarNome();
            }
            if (e.key === 'Escape') {
              setNomeDraft(nome);
              setEditandoNome(false);
            }
          }}
          autoFocus
          disabled={salvandoMeta}
          slotProps={{ inputLabel: labelFixo.inputLabel }}
          sx={{
            mt: 0.5,
            mb: 0.75,
            '& .MuiInputBase-input': { fontWeight: 800, fontSize: '1.35rem', color: colors.textPrimary },
          }}
        />
      ) : (
        <Typography
          variant="h5"
          onClick={() => setEditandoNome(true)}
          title="Clique para editar o nome"
          sx={{
            fontWeight: 800,
            color: colors.textPrimary,
            mt: 0.25,
            mb: 0.5,
            lineHeight: 1.25,
            ...hoverEditavel,
          }}
        >
          {nome || 'Sem nome'}
        </Typography>
      )}

      {editandoDescricao ? (
        <TextField
          fullWidth
          size="small"
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={() => void confirmarDescricao()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void confirmarDescricao();
            }
            if (e.key === 'Escape') {
              setDescDraft(descricao);
              setEditandoDescricao(false);
            }
          }}
          autoFocus
          disabled={salvandoMeta}
          placeholder="Descrição da região"
          slotProps={{ inputLabel: labelFixo.inputLabel }}
        />
      ) : (
        <Typography
          variant="body2"
          onClick={() => setEditandoDescricao(true)}
          title="Clique para editar a descrição"
          sx={{
            color: descricao.trim() ? 'text.secondary' : 'text.disabled',
            fontStyle: descricao.trim() ? 'normal' : 'italic',
            lineHeight: 1.45,
            ...hoverEditavel,
          }}
        >
          {descricao.trim() || 'Clique para adicionar uma descrição'}
        </Typography>
      )}
    </Box>
  );
}

export default function FrotaRegioesPortalPage({ embedded = false }: { embedded?: boolean }) {
  const [regioes, setRegioes] = useState<FrotaRegiaoResumo[]>([]);
  const [catalogo, setCatalogo] = useState<FrotaRegiaoCatalogo>(CATALOGO_VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [aba, setAba] = useState(0);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [idsRegionais, setIdsRegionais] = useState<number[]>([]);
  const [idsLojas, setIdsLojas] = useState<number[]>([]);
  const [idsTecnicos, setIdsTecnicos] = useState<number[]>([]);
  const [gpsPorTecnico, setGpsPorTecnico] = useState<Record<number, boolean>>({});
  const [regionaisDetalhe, setRegionaisDetalhe] = useState<FrotaRegiaoTecnico[]>([]);
  const [lojasDetalhe, setLojasDetalhe] = useState<FrotaRegiaoLoja[]>([]);
  const [tecnicosDetalhe, setTecnicosDetalhe] = useState<FrotaRegiaoTecnico[]>([]);
  const [veiculosDetalhe, setVeiculosDetalhe] = useState<FrotaRegiaoVeiculo[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogNova, setDialogNova] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [criando, setCriando] = useState(false);
  const [posicoes, setPosicoes] = useState<FrotaTecnicoPosicao[]>([]);
  const [veiculosRastreamento, setVeiculosRastreamento] = useState<FrotaVeiculoPosicao[]>([]);
  const [historicoVeiculo, setHistoricoVeiculo] = useState<FrotaVeiculoHistoricoPonto[]>([]);
  const [veiculoDestaqueId, setVeiculoDestaqueId] = useState<number | null>(null);
  const [rastreamentoAtivo, setRastreamentoAtivo] = useState(true);
  const [carregandoPosicoes, setCarregandoPosicoes] = useState(false);
  const appConfig = useAppConfig();

  const carregarLista = useCallback(() => {
    setLoading(true);
    return Promise.all([api.frotaRegioes(), api.frotaRegiaoCatalogo()])
      .then(([r, c]) => {
        setRegioes(r);
        setCatalogo(c);
        setErro('');
        return { regioes: r, catalogo: c };
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar';
        setErro(msg);
        throw e;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  const lojasOrdenadas = useMemo(() => {
    const mapa = new Map<number, FrotaRegiaoLoja>();
    for (const l of catalogo.lojas) mapa.set(l.id_loja, l);
    for (const l of lojasDetalhe) {
      if (!mapa.has(l.id_loja)) mapa.set(l.id_loja, l);
      else mapa.set(l.id_loja, { ...mapa.get(l.id_loja)!, ...l });
    }
    return [...mapa.values()].sort(ordenarLojas);
  }, [catalogo.lojas, lojasDetalhe]);

  const lojasNoMapa = useMemo(
    () => lojasOrdenadas.filter((l) => idsLojas.includes(l.id_loja)),
    [lojasOrdenadas, idsLojas],
  );

  const regionaisMapa = useMemo(() => {
    const mapa = new Map(catalogo.regionais.map((r) => [r.id_usuario, r]));
    return mapa;
  }, [catalogo.regionais]);

  const regionaisOrdenados = useMemo(() => {
    const mapa = new Map<number, FrotaRegiaoTecnico>();
    for (const r of catalogo.regionais) mapa.set(r.id_usuario, r);
    for (const r of regionaisDetalhe) {
      if (!mapa.has(r.id_usuario)) mapa.set(r.id_usuario, r);
    }
    return [...mapa.values()].sort(ordenarTecnicos);
  }, [catalogo.regionais, regionaisDetalhe]);

  const supervisoresAtuais = useMemo(() => {
    return idsRegionais
      .map((id) => regionaisMapa.get(id) ?? regionaisDetalhe.find((r) => r.id_usuario === id))
      .filter((r): r is FrotaRegiaoTecnico => !!r);
  }, [idsRegionais, regionaisMapa, regionaisDetalhe]);

  const tecnicosOrdenados = useMemo(() => {
    const mapa = new Map<number, FrotaRegiaoTecnico>();
    for (const t of catalogo.tecnicos) mapa.set(t.id_usuario, t);
    for (const t of tecnicosDetalhe) {
      if (!mapa.has(t.id_usuario)) mapa.set(t.id_usuario, t);
    }
    return [...mapa.values()].sort(ordenarTecnicos);
  }, [catalogo.tecnicos, tecnicosDetalhe]);

  const regiaoSelecionada = useMemo(
    () => regioes.find((r) => r.id_regiao === selecionadaId) ?? null,
    [regioes, selecionadaId],
  );

  const montarTecnicosSalvar = useCallback(
    () =>
      idsTecnicos.map((id) => ({
        id_usuario: id,
        gps_habilitado: gpsPorTecnico[id] !== false,
      })),
    [idsTecnicos, gpsPorTecnico],
  );

  const alterarTecnicosVinculados = useCallback((ids: number[]) => {
    setIdsTecnicos(ids);
    setGpsPorTecnico((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (!(id in next)) next[id] = true;
      }
      for (const key of Object.keys(next)) {
        if (!ids.includes(Number(key))) delete next[Number(key)];
      }
      return next;
    });
  }, []);

  const aplicarDetalhe = useCallback((detalhe: FrotaRegiaoDetalhe) => {
    setNome(detalhe.nome);
    setDescricao(detalhe.descricao || '');
    setIdsRegionais((detalhe.regionais ?? []).map((r) => r.id_usuario));
    setRegionaisDetalhe(detalhe.regionais ?? []);
    setIdsLojas(detalhe.lojas.map((l) => l.id_loja));
    setLojasDetalhe(detalhe.lojas);
    setIdsTecnicos(detalhe.tecnicos.map((t) => t.id_usuario));
    setGpsPorTecnico(
      Object.fromEntries(detalhe.tecnicos.map((t) => [t.id_usuario, t.gps_habilitado !== false])),
    );
    setTecnicosDetalhe(detalhe.tecnicos);
    setVeiculosDetalhe(detalhe.veiculos);
  }, []);

  const carregarDetalhe = useCallback(
    async (idRegiao: number) => {
      setCarregandoDetalhe(true);
      try {
        const detalhe = await api.frotaRegiao(idRegiao);
        aplicarDetalhe(detalhe);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Erro ao carregar região', 'error');
      } finally {
        setCarregandoDetalhe(false);
      }
    },
    [aplicarDetalhe],
  );

  useEffect(() => {
    if (selecionadaId == null) return;
    void carregarDetalhe(selecionadaId);
  }, [selecionadaId, carregarDetalhe]);

  const carregarPosicoes = useCallback(async (idRegiao?: number | null) => {
    const id = idRegiao ?? selecionadaId;
    if (id == null) return;
    setCarregandoPosicoes(true);
    try {
      const data = await api.frotaRegiaoPosicoes(id);
      setPosicoes(data.tecnicos);
      setVeiculosRastreamento(data.veiculos);
      setRastreamentoAtivo(data.rastreamento_ativo !== false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar localizações', 'error');
    } finally {
      setCarregandoPosicoes(false);
    }
  }, [selecionadaId]);

  const carregarHistoricoVeiculo = useCallback(async (idVeiculo: number) => {
    try {
      const fim = Math.floor(Date.now() / 1000);
      const inicio = fim - 24 * 60 * 60;
      const data = await api.frotaVeiculoHistoricoRastreamento(idVeiculo, { inicio, fim });
      setHistoricoVeiculo(data.pontos);
    } catch {
      setHistoricoVeiculo([]);
    }
  }, []);

  const selecionarVeiculoMapa = useCallback(
    (veiculo: FrotaVeiculoPosicao) => {
      setVeiculoDestaqueId(veiculo.id_veiculo);
      void carregarHistoricoVeiculo(veiculo.id_veiculo);
    },
    [carregarHistoricoVeiculo],
  );

  useEffect(() => {
    if (selecionadaId == null || aba !== 3) return;
    setVeiculoDestaqueId(null);
    setHistoricoVeiculo([]);
    void carregarPosicoes(selecionadaId);
  }, [selecionadaId, aba, carregarPosicoes, idsTecnicos]);

  useEffect(() => {
    if (selecionadaId == null || aba !== 4) return;
    void carregarDetalhe(selecionadaId);
  }, [selecionadaId, aba, carregarDetalhe]);

  function selecionarRegiao(id: number) {
    setSelecionadaId(id);
    setAba(0);
  }

  async function criarRegiao() {
    if (!nomeNova.trim()) {
      showToast('Informe o nome da região', 'warning');
      return;
    }
    setCriando(true);
    const nomeCriar = nomeNova.trim();
    try {
      const criada = await api.frotaCriarRegiao({
        nome: nomeCriar,
      });
      showToast('Região criada!');
      setDialogNova(false);
      setNomeNova('');
      const { regioes: lista } = await carregarLista();
      const id =
        criada?.id_regiao ??
        lista.find((r) => r.nome.localeCompare(nomeCriar, 'pt-BR', { sensitivity: 'accent' }) === 0)
          ?.id_regiao;
      if (id != null) {
        selecionarRegiao(id);
        setNome(nomeCriar);
        setDescricao('');
        setIdsRegionais([]);
        setRegionaisDetalhe([]);
        setIdsLojas([]);
        setLojasDetalhe([]);
        setIdsTecnicos([]);
        setGpsPorTecnico({});
        setTecnicosDetalhe([]);
        setVeiculosDetalhe([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao criar região', 'error');
    } finally {
      setCriando(false);
    }
  }

  async function salvarMetadados(patch: { nome?: string; descricao?: string }) {
    if (selecionadaId == null) return;
    const nomeSalvar = (patch.nome ?? nome).trim();
    if (!nomeSalvar) {
      showToast('Informe o nome da região', 'warning');
      throw new Error('nome vazio');
    }
    const descSalvar = patch.descricao !== undefined ? patch.descricao : descricao;
    await api.frotaAtualizarRegiao(selecionadaId, {
      nome: nomeSalvar,
      descricao: descSalvar.trim() || undefined,
      id_regionais: idsRegionais,
      id_lojas: idsLojas,
      tecnicos: montarTecnicosSalvar(),
    });
    if (patch.nome) setNome(nomeSalvar);
    if (patch.descricao !== undefined) setDescricao(descSalvar);
    showToast('Região atualizada!');
    await carregarLista();
  }

  async function salvar() {
    if (selecionadaId == null) return;
    if (!nome.trim()) {
      showToast('Informe o nome da região', 'warning');
      return;
    }
    setSalvando(true);
    try {
      await api.frotaAtualizarRegiao(selecionadaId, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        id_regionais: idsRegionais,
        id_lojas: idsLojas,
        tecnicos: montarTecnicosSalvar(),
      });
      showToast('Região atualizada!');
      await carregarLista();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Box
      sx={{
        ...(embedded ? { pb: 0 } : pageFillLayoutSx),
        fontSize: { md: '0.8125rem' },
        '& .MuiTypography-h5': { fontSize: { md: '1.2rem !important' } },
        '& .MuiTypography-overline': { fontSize: { md: '0.65rem' } },
        '& .MuiTab-root': { minHeight: 40, fontSize: '0.8rem', py: 1 },
        '& .MuiButton-sizeSmall': { fontSize: '0.78rem' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Defina o supervisor regional, lojas, técnicos e veículos de cada região de atuação.
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDialogNova(true)}>
          Nova região
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <LinearProgress sx={{ flexShrink: 0 }} />
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'max-content minmax(0, 1fr)' },
            gap: { xs: 2, md: 1.5 },
            overflow: { md: 'hidden' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: colors.border,
              borderRadius: 2,
              overflow: 'hidden',
              display: { md: 'flex' },
              flexDirection: { md: 'column' },
              minHeight: { md: 0 },
              maxHeight: { md: '100%' },
              alignSelf: { md: 'stretch' },
              width: { md: 'max-content' },
              minWidth: { md: 200 },
              maxWidth: { md: 'min(40vw, 380px)' },
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: colors.border,
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Regiões ({regioes.length})
              </Typography>
            </Box>
            <List
              dense
              disablePadding
              sx={{
                flex: { md: 1 },
                minHeight: { md: 0 },
                overflow: { md: 'auto' },
                maxHeight: { xs: 420 },
              }}
            >
              {regioes.map((r) => (
                <ListItemButton
                  key={r.id_regiao}
                  selected={selecionadaId === r.id_regiao}
                  onClick={() => selecionarRegiao(r.id_regiao)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    alignItems: 'flex-start',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(232, 82, 10, 0.1)',
                      borderLeft: `3px solid #E8520A`,
                      pl: '13px',
                    },
                    '&.Mui-selected:hover': {
                      bgcolor: 'rgba(232, 82, 10, 0.16)',
                    },
                  }}
                >
                  <ListItemText
                    disableTypography
                    primary={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, lineHeight: 1.35, color: colors.textPrimary, fontSize: '0.875rem' }}
                        >
                          {r.nome}
                        </Typography>
                        {r.descricao?.trim() ? (
                          <Typography
                            variant="caption"
                            sx={{
                              lineHeight: 1.35,
                              display: 'block',
                              whiteSpace: 'normal',
                              fontSize: '0.68rem',
                              color: 'text.disabled',
                            }}
                          >
                            {r.descricao}
                          </Typography>
                        ) : null}
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                        {(() => {
                          const listaSupervisores: FrotaRegiaoTecnico[] = r.regionais?.length
                            ? r.regionais
                            : r.nome_regional
                              ? [{ id_usuario: r.id_regional ?? 0, nome: r.nome_regional, email: r.email_regional ?? null }]
                              : [];
                          return listaSupervisores.length > 0 ? (
                            <SupervisoresRegionaisCabecalho supervisores={listaSupervisores} compact varianteLista />
                          ) : (
                            <Typography component="span" variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                              Sem supervisor regional definido
                            </Typography>
                          );
                        })()}
                        <Box
                          component="span"
                          sx={{
                            display: 'flex',
                            gap: 0.4,
                            flexWrap: 'nowrap',
                            alignItems: 'center',
                            width: '100%',
                            overflow: 'hidden',
                          }}
                        >
                          <ChipContagem
                            qtd={r.qtd_lojas}
                            singular="loja"
                            plural="lojas"
                            icon={<StorefrontIcon />}
                            compacto
                          />
                          <ChipContagem
                            qtd={r.qtd_tecnicos}
                            singular="técnico"
                            plural="técnicos"
                            icon={<EngineeringIcon />}
                            compacto
                          />
                          <ChipContagem
                            qtd={r.qtd_veiculos}
                            singular="veículo"
                            plural="veículos"
                            icon={<DirectionsCarIcon />}
                            compacto
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              ))}
              {regioes.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  Nenhuma região cadastrada.
                </Box>
              )}
            </List>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: colors.border,
              borderLeft: { md: `4px solid #E8520A` },
              borderRadius: 2,
              minHeight: { xs: 400, md: 0 },
              maxHeight: { md: '100%' },
              overflow: aba === 3 ? { md: 'hidden' } : { md: 'auto' },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {!regiaoSelecionada ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                Selecione uma região na lista ou crie uma nova para vincular supervisor, lojas, técnicos e veículos.
              </Box>
            ) : carregandoDetalhe ? (
              <LinearProgress />
            ) : (
              <Box
                sx={{
                  p: { xs: 1.75, sm: 2.25 },
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: aba === 3 ? { md: 'hidden' } : undefined,
                }}
              >
                <Box
                  sx={{
                    mb: 1.5,
                    pb: 1.25,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      alignItems: { xs: 'stretch', md: 'flex-start' },
                      justifyContent: 'flex-start',
                      flexWrap: { md: 'wrap' },
                      gap: { xs: 1.5, md: 2 },
                    }}
                  >
                    <Box sx={{ flex: '0 1 auto', minWidth: 0, maxWidth: { md: 360, lg: 400 } }}>
                      <RegiaoCabecalhoEditavel
                        nome={nome || regiaoSelecionada.nome}
                        descricao={descricao}
                        onChangeNome={setNome}
                        onChangeDescricao={setDescricao}
                        onSalvar={salvarMetadados}
                        semMargem
                      />
                    </Box>

                    <DivisorVerticalCabecalho />

                    <Box
                      sx={{
                        flex: '0 0 auto',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        alignSelf: 'flex-start',
                        textAlign: 'left',
                        borderTop: { xs: '1px solid', md: 'none' },
                        borderColor: 'divider',
                        pt: { xs: 1.5, md: 0 },
                      }}
                    >
                      {supervisoresAtuais.length > 0 ? (
                        <SupervisoresRegionaisCabecalho supervisores={supervisoresAtuais} />
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8125rem', textAlign: 'left' }}>
                          Nenhum supervisor regional vinculado
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start', width: '100%', mt: 1.25 }}>
                        <ChipContagem qtd={idsLojas.length} singular="loja" plural="lojas" icon={<StorefrontIcon />} />
                        <ChipContagem
                          qtd={idsTecnicos.length}
                          singular="técnico"
                          plural="técnicos"
                          icon={<EngineeringIcon />}
                        />
                        <ChipContagem
                          qtd={veiculosDetalhe.length}
                          singular="veículo"
                          plural="veículos"
                          icon={<DirectionsCarIcon />}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Box>

                <Tabs
                  value={aba}
                  onChange={(_, v) => setAba(v)}
                  sx={{
                    mb: 0,
                    mt: 1.25,
                    minHeight: 36,
                    flexShrink: 0,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '& .MuiTab-root': {
                      minHeight: 36,
                      py: 0.5,
                      px: 1.25,
                      textTransform: 'none',
                      color: colors.textSecondary,
                    },
                    '& .Mui-selected': { color: '#E8520A !important' },
                    '& .MuiTabs-indicator': { bgcolor: '#E8520A', height: 2.5 },
                  }}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Supervisores" />
                  <Tab icon={<StorefrontIcon fontSize="small" />} iconPosition="start" label="Lojas" />
                  <Tab icon={<EngineeringIcon fontSize="small" />} iconPosition="start" label="Técnicos" />
                  <Tab icon={<MyLocationIcon fontSize="small" />} iconPosition="start" label="Localização" />
                  <Tab icon={<DirectionsCarIcon fontSize="small" />} iconPosition="start" label="Veículos" />
                </Tabs>

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: aba === 3 ? 'hidden' : 'auto',
                    pt: 2,
                    pb: aba === 3 ? 0 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                {regiaoSelecionada ? (
                  <Box
                    sx={{
                      flex: aba === 3 ? 1 : 0,
                      minHeight: aba === 3 ? 0 : 0,
                      display: aba === 3 ? 'flex' : 'none',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <FrotaLocalizacaoMap
                      posicoes={posicoes}
                      lojas={lojasNoMapa}
                      veiculos={veiculosRastreamento}
                      historicoVeiculo={historicoVeiculo}
                      carregando={carregandoPosicoes}
                      gpsAtivo={appConfig.gpsTecnicosEnabled !== false}
                      rastreamentoAtivo={rastreamentoAtivo}
                      onAtualizar={() => void carregarPosicoes()}
                      autoRefreshIntervalMs={appConfig.gpsTecnicosIntervalMs ?? 120_000}
                      preencherAltura
                      visivel={aba === 3}
                      veiculoDestaqueId={veiculoDestaqueId}
                      onVeiculoClick={selecionarVeiculoMapa}
                    />
                  </Box>
                ) : null}

                {aba === 0 && (
                  <Box>
                    {catalogo.regionais.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Nenhum usuário com perfil Supervisor Regional encontrado.
                      </Alert>
                    ) : (
                      <SelecaoRegionaisRegiao
                        regionais={regionaisOrdenados}
                        selecionados={idsRegionais}
                        onChange={setIdsRegionais}
                      />
                    )}
                  </Box>
                )}

                {aba === 1 && (
                  <Box>
                    {lojasOrdenadas.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Nenhuma loja ativa cadastrada no sistema.
                      </Alert>
                    ) : (
                      <SelecaoLojasRegiao
                        lojas={lojasOrdenadas}
                        selecionados={idsLojas}
                        onChange={setIdsLojas}
                      />
                    )}
                  </Box>
                )}

                {aba === 2 && (
                  <Box>
                    {catalogo.tecnicos.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Nenhum usuário com perfil Técnico encontrado.
                      </Alert>
                    ) : (
                      <SelecaoTecnicosRegiao
                        tecnicos={tecnicosOrdenados}
                        selecionados={idsTecnicos}
                        gpsPorTecnico={gpsPorTecnico}
                        onChange={alterarTecnicosVinculados}
                        onGpsChange={(idUsuario, habilitado) =>
                          setGpsPorTecnico((prev) => ({ ...prev, [idUsuario]: habilitado }))
                        }
                      />
                    )}
                  </Box>
                )}

                {aba === 4 && (
                  <Box>
                    <VeiculosRegiaoLeitura veiculos={veiculosDetalhe} />
                  </Box>
                )}

                </Box>

                {aba !== 3 && (
                  <Box
                    sx={{
                      flexShrink: 0,
                      pt: 1.25,
                      mt: 'auto',
                      borderTop: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
                      {salvando ? 'Salvando…' : 'Salvar alterações'}
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog open={dialogNova} onClose={() => !criando && setDialogNova(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nova região de atuação</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <TextField
            label="Nome da região"
            value={nomeNova}
            onChange={(e) => setNomeNova(e.target.value)}
            placeholder="Ex.: Norte, Capital, Interior"
            required
            autoFocus
            fullWidth
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void criarRegiao();
              }
            }}
            slotProps={{ inputLabel: labelFixo.inputLabel }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogNova(false)} disabled={criando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void criarRegiao()} disabled={criando}>
            {criando ? 'Criando…' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
