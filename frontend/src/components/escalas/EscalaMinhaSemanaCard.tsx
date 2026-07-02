import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { api, type EscalaVisitasGrade } from '../../api/client';
import { getUsuario, podeVerEscalaVisitas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { colors } from '../../theme/tokens';
import {
  DIAS_ABREV,
  addDaysIso,
  diaIndexNaSemana,
  fmtDataCurta,
  primeiroNome,
  segundaFeiraAtual,
} from './escalaVisitasUtils';
import { atribuicoesDoDia, diaTemRegional } from './escalaVisitasModel';

type Props = {
  linkGrade?: string;
};

export default function EscalaMinhaSemanaCard({ linkGrade = '/escalas/visitas/mobile' }: Props) {
  const user = getUsuario();
  const idEu = user?.id_usuario;
  const [semanaInicio] = useState(segundaFeiraAtual());
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [loading, setLoading] = useState(true);

  const podeVer = podeVerEscalaVisitas(user);

  useEffect(() => {
    if (!podeVer) return;
    let cancel = false;
    setLoading(true);
    api
      .escalaVisitasSemana(`semana_inicio=${semanaInicio}`)
      .then((data) => {
        if (!cancel) setGrade(data);
      })
      .catch((e) => showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error'))
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [semanaInicio, podeVer]);

  const resumo = useMemo(() => {
    if (!grade || !idEu) return { totalMinhas: 0, hoje: [] as Array<{ nome: string; bk?: string | null; cor?: string | null }> };
    const hojeIdx = diaIndexNaSemana(grade.semana_inicio);
    let totalMinhas = 0;
    const hoje: Array<{ nome: string; bk?: string | null; cor?: string | null }> = [];

    for (const linha of grade.linhas) {
      for (const d of linha.dias) {
        if (!diaTemRegional(d, idEu)) continue;
        totalMinhas += 1;
        if (hojeIdx != null && d.dia === hojeIdx) {
          const minha = atribuicoesDoDia(d).find((a) => a.id_regional === idEu);
          hoje.push({ nome: linha.nome, bk: linha.bk_number, cor: minha?.cor ?? undefined });
        }
      }
    }
    return { totalMinhas, hoje };
  }, [grade, idEu]);

  if (!podeVer) return null;

  const hojeLabel = (() => {
    const idx = diaIndexNaSemana(semanaInicio);
    if (idx == null) return null;
    return `${DIAS_ABREV[idx]} ${fmtDataCurta(addDaysIso(semanaInicio, idx))}`;
  })();

  return (
    <Paper
      elevation={0}
      component={RouterLink}
      to={linkGrade}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        mb: 2,
        borderRadius: 2.5,
        overflow: 'hidden',
        border: '1px solid rgba(27, 42, 107, 0.1)',
        bgcolor: '#fff',
        boxShadow: '0 4px 16px rgba(27, 42, 107, 0.07)',
        '&:active': { bgcolor: 'rgba(27, 42, 107, 0.02)' },
      }}
    >
      <Box sx={{ px: 1.75, py: 1.25, bgcolor: colors.navy, color: '#fff', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <CalendarMonthOutlinedIcon sx={{ fontSize: 22, opacity: 0.9 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Escala da semana
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
            {grade?.semana_label ?? '…'}
          </Typography>
        </Box>
        <ArrowForwardIcon sx={{ fontSize: 20, opacity: 0.75, flexShrink: 0 }} />
      </Box>

      <Box sx={{ p: 1.75 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <CircularProgress size={22} sx={{ color: colors.navy }} />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: resumo.hoje.length ? 1.25 : 0 }}>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 99,
                  bgcolor: colors.navyMuted,
                  border: `1px solid ${colors.navyBorder}`,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: colors.navy }}>
                  {resumo.totalMinhas} visita{resumo.totalMinhas !== 1 ? 's' : ''} sua{resumo.totalMinhas !== 1 ? 's' : ''}
                </Typography>
              </Box>
              {hojeLabel && (
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 99,
                    bgcolor: 'rgba(232, 82, 10, 0.08)',
                    border: '1px solid rgba(232, 82, 10, 0.25)',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colors.orange }}>
                    Hoje · {hojeLabel}
                  </Typography>
                </Box>
              )}
            </Box>

            {resumo.hoje.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {resumo.hoje.slice(0, 3).map((l) => (
                  <Box
                    key={`${l.bk}-${l.nome}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      pl: 1,
                      borderLeft: `3px solid ${l.cor || colors.orange}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colors.navy, lineHeight: 1.35 }}>
                      {l.bk ? `${l.bk} · ` : ''}
                      {primeiroNome(l.nome)}
                    </Typography>
                  </Box>
                ))}
                {resumo.hoje.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{resumo.hoje.length - 3} loja(s) hoje
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {resumo.totalMinhas > 0
                  ? 'Nenhuma visita sua hoje. Toque para ver a semana completa.'
                  : 'Toque para ver o planejamento da semana.'}
              </Typography>
            )}

            <Button
              size="small"
              fullWidth
              sx={{ mt: 1.5, borderRadius: 2, fontWeight: 600, color: colors.navy }}
              endIcon={<ArrowForwardIcon />}
            >
              Abrir escala
            </Button>
          </>
        )}
      </Box>
    </Paper>
  );
}
