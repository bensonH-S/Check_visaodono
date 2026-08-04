import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { api, type FrotaVeiculo } from '../../api/client';
import FrotaVeiculoDocumentosPanel from '../../components/frota/FrotaVeiculoDocumentosPanel';
import FrotaVeiculoKmPanel from '../../components/frota/FrotaVeiculoKmPanel';
import FrotaVeiculoAbasEdicao from '../../components/frota/FrotaVeiculoAbasEdicao';
import FrotaVeiculoFormFields from '../../components/frota/FrotaVeiculoFormFields';
import {
  formParaBody,
  veiculoParaForm,
  type FormVeiculoFrota,
} from '../../constants/frotaVeiculo';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { showToast } from '../../utils/toast';

export default function FrotaVeiculoDetalhePage() {
  const { id } = useParams();
  const idVeiculo = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [aba, setAba] = useState(0);
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [qtdDocumentos, setQtdDocumentos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(() => searchParams.get('editar') === '1');
  const [form, setForm] = useState<FormVeiculoFrota | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Sem filtro por padrão — mostra todo o histórico de atribuição/devolução
  const [kmDataInicio, setKmDataInicio] = useState('');
  const [kmDataFim, setKmDataFim] = useState('');

  const carregar = useCallback(() => {
    if (!Number.isFinite(idVeiculo)) return;
    setLoading(true);
    Promise.all([api.frotaVeiculo(idVeiculo), api.frotaDocumentos(idVeiculo)])
      .then(([v, docs]) => {
        setVeiculo(v);
        setQtdDocumentos(docs.length);
        setForm(veiculoParaForm(v));
      })
      .catch((e) => showToast(e instanceof Error ? e.message : 'Erro ao carregar', 'error'))
      .finally(() => setLoading(false));
  }, [idVeiculo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (searchParams.get('editar') === '1') {
      setEditando(true);
      setAba(0);
    }
  }, [searchParams]);

  function iniciarEdicao() {
    if (!veiculo) return;
    setForm(veiculoParaForm(veiculo));
    setEditando(true);
    setAba(0);
    setSearchParams({ editar: '1' }, { replace: true });
  }

  function cancelarEdicao() {
    if (veiculo) setForm(veiculoParaForm(veiculo));
    setEditando(false);
    setSearchParams({}, { replace: true });
  }

  async function salvar() {
    if (!veiculo || !form) return;
    if (!form.placa.trim()) {
      showToast('Informe a placa', 'warning');
      return;
    }
    setSalvando(true);
    try {
      await api.frotaAtualizarVeiculo(veiculo.id_veiculo, formParaBody(form, { omitirRegiao: true }));
      showToast('Veículo atualizado com sucesso!');
      setEditando(false);
      setSearchParams({}, { replace: true });
      carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  if (!Number.isFinite(idVeiculo)) {
    return <Alert severity="error">Veículo inválido</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (!veiculo) {
    return (
      <Alert severity="error">
        Veículo não encontrado.{' '}
        <Button size="small" onClick={() => navigate('/frota/operacao?aba=cadastro')}>
          Voltar
        </Button>
      </Alert>
    );
  }

  const titulo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo';

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton
          size="small"
          onClick={() => navigate('/frota/operacao?aba=cadastro')}
          aria-label="Voltar"
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Chip label={veiculo.placa} size="small" sx={{ mt: 0.5, fontWeight: 700 }} />
        </Box>
        {aba === 0 && !editando && (
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={iniciarEdicao}>
            Editar
          </Button>
        )}
        {aba === 0 && editando && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={cancelarEdicao} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </Box>
        )}
      </Box>

      <FrotaVeiculoAbasEdicao
        semPadding
        aba={aba}
        onChangeAba={setAba}
        labelDocumentos={`Documentos (${qtdDocumentos})`}
        kmDataInicio={kmDataInicio}
        kmDataFim={kmDataFim}
        onChangeKmInicio={setKmDataInicio}
        onChangeKmFim={setKmDataFim}
      />

      <Box sx={{ display: aba === 0 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          {editando && form ? (
            <FrotaVeiculoFormFields
              form={form}
              onChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          ) : (
            <>
              <SecaoTitulo icon={<BadgeOutlinedIcon fontSize="small" />}>Identificação</SecaoTitulo>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                  mb: 2.5,
                }}
              >
                <Info label="Placa" value={veiculo.placa} />
                <Info label="RENAVAM" value={veiculo.renavam || '—'} />
                <Info label="Chassi" value={veiculo.chassi || '—'} />
              </Box>

              <SecaoTitulo icon={<DirectionsCarOutlinedIcon fontSize="small" />}>
                Dados do veículo
              </SecaoTitulo>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                  mb: 1.5,
                }}
              >
                <Info label="Marca" value={veiculo.marca || '—'} />
                <Info label="Modelo" value={veiculo.modelo || '—'} />
                <Info label="Ano" value={veiculo.ano ? String(veiculo.ano) : '—'} />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                  mb: 2.5,
                }}
              >
                <Info label="Cor" value={veiculo.cor || '—'} />
                <Info label="Combustível" value={veiculo.combustivel || '—'} />
                <Info
                  label="KM atual"
                  value={
                    veiculo.km_atual != null ? `${veiculo.km_atual.toLocaleString('pt-BR')} km` : '—'
                  }
                />
              </Box>

              <SecaoTitulo icon={<PersonOutlineOutlinedIcon fontSize="small" />}>
                Uso e observações
              </SecaoTitulo>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'flex-start' },
                  gap: { xs: 1.5, sm: 0 },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Info label="Responsável" value={veiculo.nome_responsavel || 'Sem responsável'} />
                </Box>
                <Typography
                  aria-hidden
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    px: 2,
                    alignSelf: 'stretch',
                    color: 'rgba(20, 32, 72, 0.28)',
                    fontSize: '1.55rem',
                    fontWeight: 300,
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  |
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Info
                    label="Atribuição"
                    value={veiculo.assuncao_em ? formatDataHoraBrasilia(veiculo.assuncao_em) : '—'}
                  />
                </Box>
                <Typography
                  aria-hidden
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    px: 2,
                    alignSelf: 'stretch',
                    color: 'rgba(20, 32, 72, 0.28)',
                    fontSize: '1.55rem',
                    fontWeight: 300,
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  |
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Info label="Observações" value={veiculo.observacoes || '—'} />
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: aba === 1 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          <FrotaVeiculoKmPanel
            idVeiculo={veiculo.id_veiculo}
            ocultarFiltro
            dataInicio={kmDataInicio}
            dataFim={kmDataFim}
            onChangeInicio={setKmDataInicio}
            onChangeFim={setKmDataFim}
          />
        </Paper>
      </Box>

      <Box sx={{ display: aba === 2 ? 'block' : 'none' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: colors.border }}>
          <FrotaVeiculoDocumentosPanel
            idVeiculo={veiculo.id_veiculo}
            onDocumentosChange={setQtdDocumentos}
          />
        </Paper>
      </Box>
    </Box>
  );
}

function SecaoTitulo({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
      <Box sx={{ display: 'inline-flex', color: colors.navy, opacity: 0.85 }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Box>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
