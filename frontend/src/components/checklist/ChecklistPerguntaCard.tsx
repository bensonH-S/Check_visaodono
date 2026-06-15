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
import PhotoCaptureMulti from './PhotoCaptureMulti';
import {
  exibeFoto,
  exibeObservacao,
  exigeFoto,
  exigeObservacao,
  maxFotos,
  parseFotos,
  serializeFotos,
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
  if (exigeFoto(p, r.resposta, fotos, r?.nota_estrelas)) return false;
  if (exigeObservacao(p, r.resposta, r.observacao)) return false;
  return true;
}

export type ErroPerguntaCampo = 'observacao' | 'foto' | 'resposta';

interface Props {
  pergunta: Pergunta;
  resposta?: RespostaLocal;
  erroCampo?: ErroPerguntaCampo;
  onPatch: (patch: Partial<RespostaLocal>) => void;
  onSimNao: (opt: 'Sim' | 'Não') => void;
}

export default function ChecklistPerguntaCard({
  pergunta: p,
  resposta: r,
  erroCampo,
  onPatch,
  onSimNao,
}: Props) {
  const fotos = getFotos(r);
  const ok = perguntaRespondida(p, r);
  const mostraFoto = exibeFoto(p, r?.resposta, r?.nota_estrelas);
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
        <Box sx={{ display: 'flex', gap: 0.75, mb: mostraFoto || mostraObs ? 1.25 : 0 }}>
          {(['Sim', 'Não'] as const).map((opt) => {
            const sel = r?.resposta === opt;
            const cor = opt === 'Sim' ? '#3B6D11' : '#A32D2D';
            const hoverBg = opt === 'Sim' ? 'rgba(59, 109, 17, 0.08)' : 'rgba(163, 45, 45, 0.08)';
            return (
              <Button
                key={opt}
                fullWidth
                size="small"
                variant={sel ? 'contained' : 'outlined'}
                onClick={() => onSimNao(opt)}
                sx={{
                  flex: 1,
                  minHeight: 34,
                  py: 0.5,
                  px: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  boxShadow: 'none',
                  ...(sel
                    ? { bgcolor: cor, '&:hover': { bgcolor: cor, boxShadow: 'none' } }
                    : {
                        borderColor: cor,
                        color: cor,
                        bgcolor: 'transparent',
                        '&:hover': { bgcolor: hoverBg, borderColor: cor, boxShadow: 'none' },
                      }),
                }}
              >
                {opt}
              </Button>
            );
          })}
        </Box>
      )}

      {mostraFoto && (
        <Box
          sx={{
            ...(erroCampo === 'foto' && {
              p: 1,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'error.main',
              bgcolor: 'rgba(211, 47, 47, 0.04)',
            }),
          }}
        >
          <PhotoCaptureMulti
            fotos={fotos}
            max={maxFotos()}
            inlineActions
            compactThumbs
            thumbSize={72}
            obrigatoria={exigeFoto(p, r?.resposta, fotos, r?.nota_estrelas)}
            comErro={erroCampo === 'foto'}
            onChange={(lista) =>
              onPatch({
                fotos: lista,
                foto_url: serializeFotos(lista) ?? undefined,
              })
            }
          />
        </Box>
      )}

      {mostraObs && (
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          error={erroCampo === 'observacao'}
          placeholder={
            p.codigo === '37'
              ? 'Digite aqui o que foi observado'
              : 'Digite aqui sua observação'
          }
          helperText={
            erroCampo === 'observacao'
              ? 'Observação deve ser preenchida quando selecionado Não'
              : p.requer_obs_em_nao && r?.resposta === 'Não'
                ? 'Obrigatória quando selecionado Não'
                : undefined
          }
          value={r?.observacao || ''}
          onChange={(e) => onPatch({ observacao: e.target.value })}
          sx={{ mt: 1 }}
        />
      )}
    </Paper>
  );
}
