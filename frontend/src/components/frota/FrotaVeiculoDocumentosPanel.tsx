import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { api, type FrotaDocumento } from '../../api/client';
import { labelFixo } from '../../constants/frotaVeiculo';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';
import { colors } from '../../theme/tokens';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { FrotaDocumentoModal } from './FrotaDocumentoModal';

export const FROTA_DOC_FORM_ID = 'frota-doc-upload-form';

/** Máximo de arquivos por envio (fotos do veículo, CNH, etc.). */
export const MAX_ARQUIVOS_DOC = 10;

const TIPOS_DOC = [
  { value: 'cnh', label: 'CNH' },
  { value: 'crlv', label: 'CRLV' },
  { value: 'foto_veiculo', label: 'Foto do veículo' },
  { value: 'multa', label: 'Multa' },
  { value: 'manutencao', label: 'Comprovante de manutenção' },
  { value: 'outro', label: 'Outro' },
];

const TITULO_PADRAO: Record<string, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  foto_veiculo: 'Foto do veículo',
  multa: 'Multa',
  manutencao: 'Comprovante de manutenção',
};

const inputSx = {
  '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 1 },
};

function labelTipo(tipo: string) {
  return TIPOS_DOC.find((t) => t.value === tipo)?.label ?? tipo;
}

function nomeArquivo(d: FrotaDocumento) {
  const nome = d.nome_arquivo?.trim();
  const generico = !nome || /^doc\.[a-z0-9]+$/i.test(nome);
  if (nome && !generico) return nome;
  return d.titulo?.trim() || nome || 'Documento';
}

function DocumentoIconePequeno({ mime }: { mime?: string | null }) {
  const isPdf = mime === 'application/pdf';
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        mx: 'auto',
        borderRadius: 1,
        bgcolor: isPdf ? 'rgba(220, 38, 38, 0.08)' : 'rgba(27, 42, 107, 0.08)',
        border: '1px solid',
        borderColor: isPdf ? 'rgba(220, 38, 38, 0.2)' : 'rgba(27, 42, 107, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isPdf ? (
        <PictureAsPdfOutlinedIcon sx={{ fontSize: 22, color: '#DC2626' }} />
      ) : (
        <ImageOutlinedIcon sx={{ fontSize: 22, color: colors.navy }} />
      )}
    </Box>
  );
}

type Props = {
  idVeiculo: number | null;
  ativo?: boolean;
  onDocumentosChange?: (count: number) => void;
  /** Oculta o botão interno; use com `form` no rodapé do modal. */
  anexarNoRodape?: boolean;
  onSalvandoChange?: (salvando: boolean) => void;
  onPodeAnexarChange?: (pode: boolean) => void;
};

export default function FrotaVeiculoDocumentosPanel({
  idVeiculo,
  ativo: _ativo = true,
  onDocumentosChange,
  anexarNoRodape = false,
  onSalvandoChange,
  onPodeAnexarChange,
}: Props) {
  const [documentos, setDocumentos] = useState<FrotaDocumento[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tipoDoc, setTipoDoc] = useState('');
  const [tituloDoc, setTituloDoc] = useState('');
  const [arquivosDoc, setArquivosDoc] = useState<File[]>([]);
  const [modalDoc, setModalDoc] = useState<FrotaDocumento | null>(null);
  const [excluindoDoc, setExcluindoDoc] = useState<number | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const onDocumentosChangeRef = useRef(onDocumentosChange);
  const onSalvandoChangeRef = useRef(onSalvandoChange);
  const onPodeAnexarChangeRef = useRef(onPodeAnexarChange);
  onDocumentosChangeRef.current = onDocumentosChange;
  onSalvandoChangeRef.current = onSalvandoChange;
  onPodeAnexarChangeRef.current = onPodeAnexarChange;

  const podeAnexar = Boolean(tipoDoc && tituloDoc.trim() && arquivosDoc.length > 0);

  useEffect(() => {
    onSalvandoChangeRef.current?.(salvando);
  }, [salvando]);

  useEffect(() => {
    onPodeAnexarChangeRef.current?.(podeAnexar);
  }, [podeAnexar]);

  const carregar = useCallback(() => {
    if (!idVeiculo) {
      setDocumentos([]);
      onDocumentosChangeRef.current?.(0);
      return;
    }
    setLoading(true);
    api
      .frotaDocumentos(idVeiculo)
      .then((docs) => {
        setDocumentos(docs);
        onDocumentosChangeRef.current?.(docs.length);
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : 'Erro ao carregar documentos', 'error'),
      )
      .finally(() => setLoading(false));
  }, [idVeiculo]);

  useEffect(() => {
    if (idVeiculo) carregar();
  }, [idVeiculo, carregar]);

  function aoMudarTipo(tipo: string) {
    setTipoDoc(tipo);
    if (!tituloDoc.trim() || Object.values(TITULO_PADRAO).includes(tituloDoc.trim())) {
      setTituloDoc(TITULO_PADRAO[tipo] || '');
    }
  }

  function aoSelecionarArquivos(lista: FileList | null) {
    if (!lista?.length) return;
    const novos = Array.from(lista);
    setArquivosDoc((atual) => {
      const juntos = [...atual, ...novos].slice(0, MAX_ARQUIVOS_DOC);
      if (atual.length + novos.length > MAX_ARQUIVOS_DOC) {
        showToast(`Máximo de ${MAX_ARQUIVOS_DOC} arquivos por envio`, 'warning');
      }
      return juntos;
    });
    if (inputFileRef.current) inputFileRef.current.value = '';
  }

  function removerArquivo(idx: number) {
    setArquivosDoc((atual) => atual.filter((_, i) => i !== idx));
  }

  async function excluirDocumento(doc: FrotaDocumento, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!idVeiculo || excluindoDoc != null) return;
    setExcluindoDoc(doc.id_documento);
    try {
      await api.frotaExcluirDocumento(idVeiculo, doc.id_documento);
      if (modalDoc?.id_documento === doc.id_documento) setModalDoc(null);
      showToast('Documento removido');
      carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover documento', 'error');
    } finally {
      setExcluindoDoc(null);
    }
  }

  async function enviarDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!idVeiculo) {
      showToast('Salve os dados do veículo antes de anexar documentos', 'warning');
      return;
    }
    if (!tipoDoc) {
      showToast('Selecione o tipo de documento', 'warning');
      return;
    }
    if (!tituloDoc.trim()) {
      showToast('Informe o título do documento', 'warning');
      return;
    }
    if (!arquivosDoc.length) {
      showToast('Selecione ao menos um arquivo (imagem ou PDF)', 'warning');
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('tipo', tipoDoc);
      fd.append('titulo', tituloDoc.trim());
      for (const arq of arquivosDoc) {
        fd.append('arquivo', arq, arq.name);
      }
      const r = await api.frotaEnviarDocumento(idVeiculo, fd);
      const qtd = (r as { qtd?: number })?.qtd ?? arquivosDoc.length;
      setTipoDoc('');
      setTituloDoc('');
      setArquivosDoc([]);
      showToast(qtd > 1 ? `${qtd} documentos adicionados!` : 'Documento adicionado com sucesso!');
      carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar documento', 'error');
    } finally {
      setSalvando(false);
    }
  }

  if (!idVeiculo) {
    return (
      <Alert severity="info">
        Salve os dados do veículo na aba anterior para poder anexar documentos.
      </Alert>
    );
  }

  if (loading) return <LinearProgress sx={{ my: 2 }} />;

  return (
    <Box>
      {documentos.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nenhum documento cadastrado. Você pode anexar CNH, CRLV e até {MAX_ARQUIVOS_DOC} fotos do
          veículo.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
          {documentos.map((d) => (
            <Box
              key={d.id_documento}
              onClick={() => d.media_url && setModalDoc(d)}
              sx={{
                position: 'relative',
                width: 112,
                minWidth: 0,
                p: 1,
                borderRadius: 1.5,
                textAlign: 'center',
                cursor: d.media_url ? 'pointer' : 'default',
                transition: 'background-color 0.15s, box-shadow 0.15s',
                '&:hover': d.media_url
                  ? { bgcolor: 'rgba(27, 42, 107, 0.04)', boxShadow: '0 2px 10px rgba(27, 42, 107, 0.1)' }
                  : undefined,
              }}
              title={nomeArquivo(d)}
            >
              <IconButton
                size="small"
                aria-label="Remover documento"
                disabled={excluindoDoc === d.id_documento}
                onClick={(e) => void excluirDocumento(d, e)}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  zIndex: 1,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  width: 22,
                  height: 22,
                  '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <DocumentoIconePequeno mime={d.tipo_mime} />
              <Chip
                label={labelTipo(d.tipo)}
                size="small"
                sx={{
                  mt: 0.75,
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  maxWidth: '100%',
                  '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, lineHeight: 1.25, fontSize: '0.68rem' }}
              >
                {formatDataHoraBrasilia(d.created_at)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  mt: 0.35,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  fontSize: '0.72rem',
                  wordBreak: 'break-word',
                }}
              >
                {nomeArquivo(d)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Adicionar documento
      </Typography>
      <Box
        component="form"
        id={anexarNoRodape ? FROTA_DOC_FORM_ID : undefined}
        onSubmit={enviarDocumento}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            select
            label="Tipo de documento"
            size="small"
            value={tipoDoc}
            onChange={(e) => aoMudarTipo(e.target.value)}
            slotProps={{
              inputLabel: labelFixo.inputLabel,
              select: {
                displayEmpty: true,
                renderValue: (selected: unknown) => {
                  const val = String(selected ?? '');
                  if (!val) {
                    return (
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        Selecione o tipo
                      </Box>
                    );
                  }
                  return TIPOS_DOC.find((t) => t.value === val)?.label ?? val;
                },
                ...selectMenuScrollProps,
              },
            }}
          >
            <MenuItem value="" disabled sx={{ display: 'none' }}>
              Selecione o tipo
            </MenuItem>
            {TIPOS_DOC.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Título"
            size="small"
            required
            value={tituloDoc}
            onChange={(e) => setTituloDoc(e.target.value)}
            placeholder="Digite o título"
            slotProps={{ inputLabel: labelFixo.inputLabel }}
            sx={inputSx}
          />
        </Box>

        <Box
          component="label"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            border: '2px dashed',
            borderColor: arquivosDoc.length ? colors.navy : 'rgba(27, 42, 107, 0.2)',
            borderRadius: 2,
            bgcolor: arquivosDoc.length ? 'rgba(27, 42, 107, 0.04)' : 'rgba(27, 42, 107, 0.02)',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
            '&:hover': {
              borderColor: colors.navy,
              bgcolor: 'rgba(27, 42, 107, 0.06)',
              boxShadow: '0 4px 16px rgba(27, 42, 107, 0.08)',
            },
          }}
        >
          <input
            ref={inputFileRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => aoSelecionarArquivos(e.target.files)}
          />
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 1.5,
              bgcolor: '#fff',
              border: '1px solid rgba(27, 42, 107, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {arquivosDoc.length ? (
              arquivosDoc[0].type === 'application/pdf' ? (
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 32, color: colors.navy }} />
              ) : (
                <ImageOutlinedIcon sx={{ fontSize: 32, color: colors.navy }} />
              )
            ) : (
              <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: colors.navy }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: colors.navy }}>
              {arquivosDoc.length
                ? `${arquivosDoc.length} arquivo${arquivosDoc.length > 1 ? 's' : ''} selecionado${arquivosDoc.length > 1 ? 's' : ''}`
                : 'Selecionar arquivos ou imagens'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              CNH, CRLV, fotos do veículo (até {MAX_ARQUIVOS_DOC} de uma vez) · JPG, PNG ou PDF · máx. 12 MB
              cada
            </Typography>
          </Box>
        </Box>

        {arquivosDoc.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {arquivosDoc.map((arq, idx) => (
              <Box
                key={`${arq.name}-${idx}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: 'rgba(27, 42, 107, 0.04)',
                  border: '1px solid rgba(27, 42, 107, 0.08)',
                }}
              >
                {arq.type === 'application/pdf' ? (
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: colors.navy }} />
                ) : (
                  <ImageOutlinedIcon sx={{ fontSize: 18, color: colors.navy }} />
                )}
                <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap title={arq.name}>
                  {arq.name}
                </Typography>
                <IconButton size="small" aria-label="Remover arquivo" onClick={() => removerArquivo(idx)}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {!anexarNoRodape && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" size="small" disabled={salvando || !podeAnexar}>
              {salvando
                ? 'Enviando…'
                : arquivosDoc.length > 1
                  ? `Anexar ${arquivosDoc.length} arquivos`
                  : 'Anexar documento'}
            </Button>
          </Box>
        )}
      </Box>

      <FrotaDocumentoModal documento={modalDoc} open={modalDoc != null} onClose={() => setModalDoc(null)} />
    </Box>
  );
}
