import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import TextField from '@mui/material/TextField';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import type { Pergunta } from '../../api/client';
import PhotoCapture from './PhotoCapture';
import PhotoCaptureMulti from './PhotoCaptureMulti';
import {
  exibeFoto,
  exibeObservacao,
  exigeFoto,
  exigeObservacao,
  maxFotos,
  parseFotos,
  permiteMultiplasFotos,
  serializeFotos,
  urlFoto,
} from '../../utils/checklistRules';

export interface RespostaLocal {
  resposta?: 'Sim' | 'Não' | 'N/A';
  nota_estrelas?: number;
  foto_url?: string;
  fotos?: string[];
  observacao?: string;
}

function usaEstrelas(p: Pergunta) {
  return p.tipo_resposta === 'estrelas' || p.tipo_resposta === 'estrelas_foto';
}

function usaSimNao(p: Pergunta) {
  return p.tipo_resposta === 'sim_nao' || p.tipo_resposta === 'sim_nao_foto';
}

function getFotos(r?: RespostaLocal): string[] {
  if (r?.fotos?.length) return r.fotos;
  return parseFotos(r?.foto_url);
}

export function perguntaRespondida(p: Pergunta, r?: RespostaLocal): boolean {
  if (!r) return false;
  if (usaEstrelas(p) && !r.nota_estrelas) return false;
  if (usaSimNao(p) && !r.resposta) return false;
  const fotos = getFotos(r);
  if (exigeFoto(p, r.resposta, fotos)) return false;
  if (exigeObservacao(p, r.resposta, r.observacao)) return false;
  return true;
}

interface Props {
  pergunta: Pergunta;
  resposta?: RespostaLocal;
  onPatch: (patch: Partial<RespostaLocal>) => void;
  onSimNao: (opt: 'Sim' | 'Não') => void;
}

export default function ChecklistPerguntaCard({ pergunta: p, resposta: r, onPatch, onSimNao }: Props) {
  const fotos = getFotos(r);
  const ok = perguntaRespondida(p, r);
  const mostraFoto = exibeFoto(p, r?.resposta);
  const mostraObs = exibeObservacao(p, r?.resposta);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: ok ? 'success.light' : 'divider',
        bgcolor: ok ? 'rgba(234,243,222,0.35)' : 'white',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
        <Chip
          label={p.codigo}
          size="small"
          sx={{
            fontWeight: 700,
            minWidth: 36,
            bgcolor: ok ? 'success.main' : 'grey.200',
            color: ok ? 'white' : 'text.primary',
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
            {p.texto}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
            {p.critica && (
              <Chip size="small" color="error" icon={<WarningIcon />} label="Crítico" />
            )}
            {ok && (
              <Chip
                size="small"
                color="success"
                icon={<CheckCircleIcon />}
                label="Respondida"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </Box>

      {usaEstrelas(p) && (
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Rating
            value={r?.nota_estrelas ?? 0}
            onChange={(_, v) => {
              const nota = v && v >= 1 ? v : undefined;
              onPatch({ nota_estrelas: nota });
            }}
            size="large"
          />
          {r?.nota_estrelas != null && r.nota_estrelas >= 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Avaliação: {r.nota_estrelas} {r.nota_estrelas === 1 ? 'estrela' : 'estrelas'}
            </Typography>
          )}
        </Box>
      )}

      {usaSimNao(p) && (
        <Box sx={{ display: 'flex', gap: 1, mb: mostraFoto || mostraObs ? 1.5 : 0 }}>
          {(['Sim', 'Não'] as const).map((opt) => {
            const sel = r?.resposta === opt;
            const cor = opt === 'Sim' ? '#3B6D11' : '#A32D2D';
            return (
              <Button
                key={opt}
                fullWidth
                size="small"
                variant={sel ? 'contained' : 'outlined'}
                onClick={() => onSimNao(opt)}
                sx={{
                  minHeight: 44,
                  fontWeight: 700,
                  ...(sel
                    ? { bgcolor: cor, '&:hover': { bgcolor: cor } }
                    : { borderColor: cor, color: cor }),
                }}
              >
                {opt}
              </Button>
            );
          })}
        </Box>
      )}

      {mostraFoto && permiteMultiplasFotos(p) && (
        <PhotoCaptureMulti
          fotos={fotos}
          max={maxFotos(p)}
          onChange={(lista) =>
            onPatch({
              fotos: lista,
              foto_url: serializeFotos(lista) ?? undefined,
            })
          }
        />
      )}

      {mostraFoto && !permiteMultiplasFotos(p) && (
        <PhotoCapture
          value={fotos[0] ? urlFoto(fotos[0]) : undefined}
          onChange={(url) =>
            onPatch({
              foto_url: url,
              fotos: url ? [url] : [],
            })
          }
          obrigatoria={exigeFoto(p, r?.resposta, fotos)}
        />
      )}

      {mostraObs && (
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          label={p.codigo === '37' ? 'O que foi observado?' : 'Observação (obrigatória em Não)'}
          value={r?.observacao || ''}
          onChange={(e) => onPatch({ observacao: e.target.value })}
          sx={{ mt: 1 }}
        />
      )}
    </Paper>
  );
}
