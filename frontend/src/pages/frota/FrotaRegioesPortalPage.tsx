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
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EngineeringIcon from '@mui/icons-material/Engineering';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import {
  api,
  type FrotaRegiaoCatalogo,
  type FrotaRegiaoDetalhe,
  type FrotaRegiaoLoja,
  type FrotaRegiaoResumo,
  type FrotaRegiaoTecnico,
  type FrotaRegiaoVeiculo,
} from '../../api/client';
import { labelFixo } from '../../constants/frotaVeiculo';
import { colors } from '../../theme/tokens';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';

const CATALOGO_VAZIO: FrotaRegiaoCatalogo = {
  lojas: [],
  tecnicos: [],
  regionais: [],
  veiculos: [],
};

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
}: {
  qtd: number;
  singular: string;
  plural: string;
  icon: ReactElement;
}) {
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={icon}
      label={textoContagem(qtd, singular, plural)}
      sx={{
        height: 24,
        fontSize: '0.72rem',
        borderColor: colors.border,
        bgcolor: 'rgba(27, 42, 107, 0.03)',
        '& .MuiChip-icon': { fontSize: '0.9rem', ml: 0.5 },
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

function LojaLinhaMenu({ loja }: { loja: FrotaRegiaoLoja }) {
  const cidade = cidadeUfLoja(loja);
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, width: '100%', py: 0.25 }}>
      <Box
        sx={{
          minWidth: 64,
          px: 1,
          py: 0.75,
          borderRadius: 1,
          bgcolor: 'rgba(27, 42, 107, 0.06)',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.65rem' }}>
          BKN
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: '0.8rem' }}>
          {loja.bk_number || '—'}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, lineHeight: 1.35, whiteSpace: 'normal', fontSize: '0.85rem' }}
        >
          {loja.name}
        </Typography>
        {cidade ? (
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
          }}
        >
          {selecionadasOrdenadas.map((l) => (
            <Paper
              key={l.id_loja}
              variant="outlined"
              sx={{
                px: 1.5,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderColor: colors.border,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LojaLinhaMenu loja={l} />
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

function TecnicoLinhaMenu({ tecnico }: { tecnico: FrotaRegiaoTecnico }) {
  return (
    <Box sx={{ minWidth: 0, flex: 1, py: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35, fontSize: '0.85rem' }}>
        {tecnico.nome}
      </Typography>
      {tecnico.email ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.3 }}>
          {tecnico.email}
        </Typography>
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
}: {
  veiculo: FrotaRegiaoVeiculo;
  compacto?: boolean;
  mostrarRegiao?: boolean;
}) {
  const modelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ');
  const hexCor = corParaHex(veiculo.cor);
  const detalhes = [
    veiculo.ano ? `Ano ${veiculo.ano}` : null,
    veiculo.combustivel || null,
  ].filter(Boolean);

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, width: '100%', py: 0.25 }}>
      <Box
        sx={{
          minWidth: compacto ? 72 : 80,
          px: 1,
          py: 0.75,
          borderRadius: 1,
          bgcolor: 'rgba(27, 42, 107, 0.06)',
          textAlign: 'center',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.65rem' }}>
          Placa
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: compacto ? '0.75rem' : '0.8rem', letterSpacing: 0.5 }}
        >
          {veiculo.placa}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.35 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35, fontSize: '0.85rem' }}>
          {modelo || 'Veículo sem marca/modelo'}
        </Typography>
        {veiculo.cor ? (
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
        {detalhes.length > 0 ? (
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
  renderLista: (item: T, remover: () => void) => ReactNode;
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
  onChange,
}: {
  tecnicos: FrotaRegiaoTecnico[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
}) {
  const itens = useMemo(
    () =>
      tecnicos
        .map((t) => ({ ...t, id: t.id_usuario }))
        .sort(ordenarTecnicos),
    [tecnicos],
  );

  return (
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
          }}
        >
          {lista.map((t) => (
            <Paper
              key={t.id_usuario}
              variant="outlined"
              sx={{
                px: 1.5,
                py: 1.25,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                borderColor: colors.border,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'rgba(27, 42, 107, 0.08)',
                  color: colors.navy,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem',
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
                <TecnicoLinhaMenu tecnico={t} />
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
  );
}

function SelecaoVeiculosRegiao({
  veiculos,
  selecionados,
  onChange,
}: {
  veiculos: FrotaRegiaoVeiculo[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
}) {
  const itens = useMemo(
    () =>
      veiculos
        .map((v) => ({ ...v, id: v.id_veiculo }))
        .sort(ordenarVeiculos),
    [veiculos],
  );

  return (
    <SelecaoPickerMultiplo
      label="Adicionar veículos"
      placeholder="Selecione os veículos"
      helperText="Selecione um ou mais veículos. Os já vinculados aparecem somente na lista abaixo."
      vazioTexto="Nenhum veículo vinculado a esta região."
      itemSingular="veículo"
      itemPlural="veículos"
      itens={itens}
      selecionados={selecionados}
      onChange={onChange}
      menuMinWidth={340}
      renderItem={(v) => (
        <VeiculoLinhaMenu veiculo={v} compacto mostrarRegiao={!!v.id_regiao && !!v.nome_regiao} />
      )}
      renderLista={(lista, remover) => (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
          }}
        >
          {lista.map((v) => (
            <Paper
              key={v.id_veiculo}
              variant="outlined"
              sx={{
                px: 1.5,
                py: 1.25,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                borderColor: colors.border,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <VeiculoLinhaMenu veiculo={v} />
              </Box>
              <IconButton
                size="small"
                aria-label={`Remover ${v.placa}`}
                onClick={() => remover(v.id_veiculo)}
                sx={{ flexShrink: 0 }}
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

function placeholderSelect(texto: string, rotulo?: (valor: string) => ReactNode) {
  return (selected: unknown) => {
    const v = selected as string;
    if (!v) {
      return (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          {texto}
        </Box>
      );
    }
    if (rotulo) return rotulo(v);
    return v;
  };
}

export default function FrotaRegioesPortalPage() {
  const [regioes, setRegioes] = useState<FrotaRegiaoResumo[]>([]);
  const [catalogo, setCatalogo] = useState<FrotaRegiaoCatalogo>(CATALOGO_VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [aba, setAba] = useState(0);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [idRegional, setIdRegional] = useState<number | ''>('');
  const [idsLojas, setIdsLojas] = useState<number[]>([]);
  const [idsTecnicos, setIdsTecnicos] = useState<number[]>([]);
  const [idsVeiculos, setIdsVeiculos] = useState<number[]>([]);
  const [lojasDetalhe, setLojasDetalhe] = useState<FrotaRegiaoLoja[]>([]);
  const [tecnicosDetalhe, setTecnicosDetalhe] = useState<FrotaRegiaoTecnico[]>([]);
  const [veiculosDetalhe, setVeiculosDetalhe] = useState<FrotaRegiaoVeiculo[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogNova, setDialogNova] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [descricaoNova, setDescricaoNova] = useState('');
  const [criando, setCriando] = useState(false);

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
    }
    return [...mapa.values()].sort(ordenarLojas);
  }, [catalogo.lojas, lojasDetalhe]);

  const regionaisMapa = useMemo(() => {
    const mapa = new Map(catalogo.regionais.map((r) => [r.id_usuario, r]));
    return mapa;
  }, [catalogo.regionais]);

  const rotuloSupervisor = useCallback(
    (id: number | '') => {
      if (id === '') return null;
      return regionaisMapa.get(Number(id))?.nome ?? null;
    },
    [regionaisMapa],
  );

  const tecnicosOrdenados = useMemo(() => {
    const mapa = new Map<number, FrotaRegiaoTecnico>();
    for (const t of catalogo.tecnicos) mapa.set(t.id_usuario, t);
    for (const t of tecnicosDetalhe) {
      if (!mapa.has(t.id_usuario)) mapa.set(t.id_usuario, t);
    }
    return [...mapa.values()].sort(ordenarTecnicos);
  }, [catalogo.tecnicos, tecnicosDetalhe]);

  const veiculosOrdenados = useMemo(() => {
    const mapa = new Map<number, FrotaRegiaoVeiculo>();
    for (const v of catalogo.veiculos) mapa.set(v.id_veiculo, v);
    for (const v of veiculosDetalhe) {
      if (!mapa.has(v.id_veiculo)) mapa.set(v.id_veiculo, v);
    }
    return [...mapa.values()].sort(ordenarVeiculos);
  }, [catalogo.veiculos, veiculosDetalhe]);

  const regiaoSelecionada = useMemo(
    () => regioes.find((r) => r.id_regiao === selecionadaId) ?? null,
    [regioes, selecionadaId],
  );

  const aplicarDetalhe = useCallback((detalhe: FrotaRegiaoDetalhe) => {
    setNome(detalhe.nome);
    setDescricao(detalhe.descricao || '');
    setIdRegional(detalhe.id_regional ?? '');
    setIdsLojas(detalhe.lojas.map((l) => l.id_loja));
    setLojasDetalhe(detalhe.lojas);
    setIdsTecnicos(detalhe.tecnicos.map((t) => t.id_usuario));
    setTecnicosDetalhe(detalhe.tecnicos);
    setIdsVeiculos(detalhe.veiculos.map((v) => v.id_veiculo));
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
    const descCriar = descricaoNova.trim();
    try {
      const criada = await api.frotaCriarRegiao({
        nome: nomeCriar,
        descricao: descCriar || undefined,
      });
      showToast('Região criada!');
      setDialogNova(false);
      setNomeNova('');
      setDescricaoNova('');
      const { regioes: lista } = await carregarLista();
      const id =
        criada?.id_regiao ??
        lista.find((r) => r.nome.localeCompare(nomeCriar, 'pt-BR', { sensitivity: 'accent' }) === 0)
          ?.id_regiao;
      if (id != null) {
        selecionarRegiao(id);
        setNome(nomeCriar);
        setDescricao(descCriar);
        setIdRegional('');
        setIdsLojas([]);
        setLojasDetalhe([]);
        setIdsTecnicos([]);
        setTecnicosDetalhe([]);
        setIdsVeiculos([]);
        setVeiculosDetalhe([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao criar região', 'error');
    } finally {
      setCriando(false);
    }
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
        id_regional: idRegional === '' ? null : Number(idRegional),
        id_lojas: idsLojas,
        id_usuarios: idsTecnicos,
        id_veiculos: idsVeiculos,
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
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Defina o supervisor regional, lojas, técnicos e veículos de cada região de atuação.
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDialogNova(true)}>
          Nova região
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: colors.border,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: colors.border }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Regiões ({regioes.length})
              </Typography>
            </Box>
            <List dense disablePadding sx={{ maxHeight: { md: 720 }, overflow: 'auto' }}>
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
                      bgcolor: 'rgba(27, 42, 107, 0.07)',
                      borderLeft: `3px solid ${colors.navy}`,
                      pl: '13px',
                    },
                    '&.Mui-selected:hover': {
                      bgcolor: 'rgba(27, 42, 107, 0.1)',
                    },
                  }}
                >
                  <ListItemText
                    disableTypography
                    primary={
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.35, color: colors.navy }}>
                        {r.nome}
                      </Typography>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.75 }}>
                        {r.nome_regional ? (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                            <PersonIcon sx={{ fontSize: '0.95rem', color: 'text.secondary', mt: '2px' }} />
                            <Typography component="span" variant="caption" sx={{ lineHeight: 1.45 }}>
                              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                Supervisor Regional:{' '}
                              </Box>
                              <Box component="span" sx={{ color: 'text.secondary' }}>
                                {r.nome_regional}
                              </Box>
                            </Typography>
                          </Box>
                        ) : (
                          <Typography component="span" variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                            Sem supervisor regional definido
                          </Typography>
                        )}
                        <Box component="span" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <ChipContagem
                            qtd={r.qtd_lojas}
                            singular="loja"
                            plural="lojas"
                            icon={<StorefrontIcon />}
                          />
                          <ChipContagem
                            qtd={r.qtd_tecnicos}
                            singular="técnico"
                            plural="técnicos"
                            icon={<EngineeringIcon />}
                          />
                          <ChipContagem
                            qtd={r.qtd_veiculos}
                            singular="veículo"
                            plural="veículos"
                            icon={<DirectionsCarIcon />}
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
              borderLeft: { md: `4px solid ${colors.navy}` },
              borderRadius: 2,
              minHeight: 400,
            }}
          >
            {!regiaoSelecionada ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                Selecione uma região na lista ou crie uma nova para vincular supervisor, lojas, técnicos e veículos.
              </Box>
            ) : carregandoDetalhe ? (
              <LinearProgress />
            ) : (
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Box
                  sx={{
                    mb: 3,
                    pb: 2.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ color: 'text.secondary', letterSpacing: 1, fontWeight: 600, lineHeight: 1.2 }}
                  >
                    Região de atuação
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: colors.navy, mt: 0.25, mb: 1 }}>
                    {nome || regiaoSelecionada.nome}
                  </Typography>
                  {idRegional !== '' && regionaisMapa.get(Number(idRegional)) ? (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                      <PersonIcon sx={{ fontSize: '1.1rem', color: colors.navy, mt: '2px' }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.4, mb: 0.25 }}>
                          Supervisor Regional
                        </Typography>
                        <TecnicoLinhaMenu tecnico={regionaisMapa.get(Number(idRegional))!} />
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1.5 }}>
                      Nenhum supervisor regional vinculado
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <ChipContagem qtd={idsLojas.length} singular="loja" plural="lojas" icon={<StorefrontIcon />} />
                    <ChipContagem
                      qtd={idsTecnicos.length}
                      singular="técnico"
                      plural="técnicos"
                      icon={<EngineeringIcon />}
                    />
                    <ChipContagem
                      qtd={idsVeiculos.length}
                      singular="veículo"
                      plural="veículos"
                      icon={<DirectionsCarIcon />}
                    />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                  <TextField
                    label="Nome da região"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    slotProps={{ inputLabel: labelFixo.inputLabel }}
                  />
                  <TextField
                    label="Descrição"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    multiline
                    minRows={2}
                    slotProps={{ inputLabel: labelFixo.inputLabel }}
                  />
                </Box>

                <Tabs
                  value={aba}
                  onChange={(_, v) => setAba(v)}
                  sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Supervisor Regional" />
                  <Tab icon={<StorefrontIcon fontSize="small" />} iconPosition="start" label="Lojas" />
                  <Tab icon={<EngineeringIcon fontSize="small" />} iconPosition="start" label="Técnicos" />
                  <Tab icon={<DirectionsCarIcon fontSize="small" />} iconPosition="start" label="Veículos" />
                </Tabs>

                {aba === 0 && (
                  <Box>
                    {catalogo.regionais.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Nenhum usuário com perfil Supervisor Regional encontrado.
                      </Alert>
                    ) : null}
                    <TextField
                      select
                      fullWidth
                      label="Supervisor Regional"
                      value={idRegional === '' ? '' : String(idRegional)}
                      onChange={(e) =>
                        setIdRegional(e.target.value ? Number(e.target.value) : '')
                      }
                      helperText="Usuários com perfil Supervisor Regional."
                      slotProps={{
                        inputLabel: labelFixo.inputLabel,
                        select: {
                          displayEmpty: true,
                          renderValue: placeholderSelect('Selecione o supervisor regional', (v) => rotuloSupervisor(Number(v)) ?? v),
                          ...selectMenuScrollProps,
                        },
                      }}
                    >
                      <MenuItem value="">Nenhum</MenuItem>
                      {catalogo.regionais.map((r) => (
                        <MenuItem key={r.id_usuario} value={String(r.id_usuario)} sx={{ py: 1, alignItems: 'stretch' }}>
                          <TecnicoLinhaMenu tecnico={r} />
                        </MenuItem>
                      ))}
                    </TextField>
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
                        onChange={setIdsTecnicos}
                      />
                    )}
                  </Box>
                )}

                {aba === 3 && (
                  <Box>
                    {catalogo.veiculos.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Nenhum veículo cadastrado na frota.
                      </Alert>
                    ) : (
                      <SelecaoVeiculosRegiao
                        veiculos={veiculosOrdenados}
                        selecionados={idsVeiculos}
                        onChange={setIdsVeiculos}
                      />
                    )}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? 'Salvando…' : 'Salvar alterações'}
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog open={dialogNova} onClose={() => !criando && setDialogNova(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nova região de atuação</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Nome da região"
            value={nomeNova}
            onChange={(e) => setNomeNova(e.target.value)}
            placeholder="Ex.: Norte, Capital, Interior"
            required
            autoFocus
            slotProps={{ inputLabel: labelFixo.inputLabel }}
          />
          <TextField
            label="Descrição"
            value={descricaoNova}
            onChange={(e) => setDescricaoNova(e.target.value)}
            multiline
            minRows={2}
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
