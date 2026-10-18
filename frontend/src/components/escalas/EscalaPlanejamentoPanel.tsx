import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  api,
  type EscalaPlanejamentoEvento,
  type EscalaPlanejamentoTipo,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { formatDataSomenteData } from '../../utils/dateBr';
import LojaBkMarca from './LojaBkMarca';
import { TIPOS_PLANEJAMENTO } from './escalaPlanejamentoTipos';

type LojaOpcao = {
  id_loja: number;
  name?: string;
  nome?: string;
  bk_number?: string | null;
};

type Props = {
  semanaInicio: string;
  lojas: LojaOpcao[];
  colors: {
    surface: string;
    border: string;
    textSecondary: string;
    canvasAlt: string;
  };
};

function rotuloLoja(l: LojaOpcao) {
  return l.name || l.nome || `Loja ${l.id_loja}`;
}

export default function EscalaPlanejamentoPanel({ semanaInicio, lojas, colors }: Props) {
  const [eventos, setEventos] = useState<EscalaPlanejamentoEvento[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<EscalaPlanejamentoTipo | ''>('');
  const [filtroLoja, setFiltroLoja] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const [novoTipo, setNovoTipo] = useState<EscalaPlanejamentoTipo>('reuniao');
  const [novoIdLoja, setNovoIdLoja] = useState<number | ''>('');
  const [novaData, setNovaData] = useState(semanaInicio);
  const [novaObs, setNovaObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const taquari = useMemo(
    () => lojas.find((l) => String(l.bk_number || '') === '34390') || null,
    [lojas],
  );

  useEffect(() => {
    setNovaData(semanaInicio);
  }, [semanaInicio]);

  useEffect(() => {
    if (taquari && novoIdLoja === '') setNovoIdLoja(taquari.id_loja);
  }, [taquari, novoIdLoja]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.escalaPlanejamentoSemana({
        semana_inicio: semanaInicio,
        id_loja: filtroLoja === '' ? undefined : Number(filtroLoja),
      });
      setEventos(data.eventos || []);
      setPodeEditar(Boolean(data.pode_editar));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar planejamento', 'error');
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [semanaInicio, filtroLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!filtroTipo) return eventos;
    return eventos.filter((e) => e.tipo === filtroTipo);
  }, [eventos, filtroTipo]);

  const porLoja = useMemo(() => {
    const map = new Map<number, { loja: LojaOpcao; itens: EscalaPlanejamentoEvento[] }>();
    for (const ev of filtrados) {
      const loja =
        lojas.find((l) => l.id_loja === ev.id_loja) ||
        ({
          id_loja: ev.id_loja,
          name: ev.nome_loja,
          bk_number: ev.bk_number,
        } as LojaOpcao);
      if (!map.has(ev.id_loja)) map.set(ev.id_loja, { loja, itens: [] });
      map.get(ev.id_loja)!.itens.push(ev);
    }
    // Taquari no topo quando existir
    const lista = [...map.values()];
    lista.sort((a, b) => {
      const aT = String(a.loja.bk_number || '') === '34390' ? 0 : 1;
      const bT = String(b.loja.bk_number || '') === '34390' ? 0 : 1;
      if (aT !== bT) return aT - bT;
      return rotuloLoja(a.loja).localeCompare(rotuloLoja(b.loja), 'pt-BR');
    });
    return lista;
  }, [filtrados, lojas]);

  async function adicionar() {
    if (!novoIdLoja || !novaData) {
      showToast('Informe loja e data', 'error');
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaPlanejamentoCriar({
        id_loja: Number(novoIdLoja),
        data: novaData,
        tipo: novoTipo,
        observacao: novaObs,
      });
      setEventos(data.eventos || []);
      setNovaObs('');
      showToast('Observação adicionada', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    try {
      const data = await api.escalaPlanejamentoExcluir(id);
      setEventos(data.eventos || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    }
  }

  return (
    <Paper
      sx={{
        flex: 1,
        minHeight: { xs: 560, md: 0 },
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${colors.border}`,
        bgcolor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={1.5} sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
          Eventos da semana · Audiência, Reunião, Congresso e Treinamento
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {TIPOS_PLANEJAMENTO.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              clickable
              color={filtroTipo === t.value ? 'primary' : 'default'}
              variant={filtroTipo === t.value ? 'filled' : 'outlined'}
              onClick={() => setFiltroTipo((prev) => (prev === t.value ? '' : t.value))}
              size="small"
            />
          ))}
          <TextField
            select
            size="small"
            label="Loja"
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {taquari ? (
              <MenuItem value={taquari.id_loja}>
                {rotuloLoja(taquari)} (Taquari)
              </MenuItem>
            ) : null}
            {lojas
              .filter((l) => l.id_loja !== taquari?.id_loja)
              .map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {rotuloLoja(l)}
                  {l.bk_number ? ` · ${l.bk_number}` : ''}
                </MenuItem>
              ))}
          </TextField>
        </Stack>

        {podeEditar ? (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: colors.canvasAlt,
              border: `1px solid ${colors.border}`,
              alignItems: { md: 'flex-start' },
            }}
          >
            <TextField
              select
              size="small"
              label="Tipo"
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as EscalaPlanejamentoTipo)}
              sx={{ minWidth: 150 }}
            >
              {TIPOS_PLANEJAMENTO.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Loja"
              value={novoIdLoja}
              onChange={(e) => setNovoIdLoja(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ minWidth: 220, flex: 1 }}
            >
              {lojas.map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {rotuloLoja(l)}
                  {l.bk_number ? ` · ${l.bk_number}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="date"
              label="Data"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              size="small"
              label="Observação"
              value={novaObs}
              onChange={(e) => setNovaObs(e.target.value)}
              fullWidth
              placeholder="Detalhes do evento…"
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={salvando || !novoIdLoja}
              onClick={() => void adicionar()}
              sx={{ whiteSpace: 'nowrap', height: 40 }}
            >
              Adicionar
            </Button>
          </Stack>
        ) : null}
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading && !filtrados.length ? (
          <Typography color="text.secondary">Carregando…</Typography>
        ) : !porLoja.length ? (
          <Typography color="text.secondary">
            Nenhum evento nesta semana. Use o formulário acima para registrar Audiência, Reunião,
            Congresso ou Treinamento sob a loja (ex.: Taquari).
          </Typography>
        ) : (
          <Stack spacing={2}>
            {porLoja.map(({ loja, itens }) => (
              <Box
                key={loja.id_loja}
                sx={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: colors.surface,
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    bgcolor: colors.canvasAlt,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <LojaBkMarca bk={loja.bk_number} nome={rotuloLoja(loja)} size={18} />
                  {String(loja.bk_number || '') === '34390' ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      BKN 34390 · observações de planejamento desta loja
                    </Typography>
                  ) : null}
                </Box>
                <Stack spacing={0} divider={<Box sx={{ borderBottom: `1px solid ${colors.border}` }} />}>
                  {itens.map((ev) => {
                    const tipoLabel =
                      TIPOS_PLANEJAMENTO.find((t) => t.value === ev.tipo)?.label || ev.tipo;
                    return (
                      <Stack
                        key={ev.id_evento}
                        direction="row"
                        spacing={1}
                        sx={{ px: 1.5, py: 1, alignItems: 'flex-start' }}
                      >
                        <Chip label={tipoLabel} size="small" sx={{ fontWeight: 700, mt: 0.25 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                            {formatDataSomenteData(ev.data)}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>
                            {ev.observacao || '—'}
                          </Typography>
                        </Box>
                        {podeEditar ? (
                          <IconButton
                            size="small"
                            aria-label="Excluir"
                            onClick={() => void remover(ev.id_evento)}
                            sx={{ color: '#f87171' }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Paper>
  );
}
