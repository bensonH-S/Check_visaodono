import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { assetUrl } from '../../config/paths';
import { formatDataHoraVisita } from '../../utils/dateBr';
import type { Loja, Usuario, MetaVisitaTimeCampo } from '../../api/client';
import { useChecklistMobileUi } from '../../context/ChecklistMobileUiContext';
import ChecklistIonicShell from './ChecklistIonicShell';

interface Props {
  visitaId: number;
  loja?: Loja;
  auditor?: Usuario;
  dataVisita?: string | null;
  horaInicio?: string | null;
  totalSecoes: number;
  totalPerguntas: number;
  tipoChecklist?: string;
  metaVisita?: MetaVisitaTimeCampo;
  onComecar: () => void;
  ionic?: boolean;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

function MetaLinhas({ meta }: { meta: MetaVisitaTimeCampo }) {
  const linhas: { label: string; value: string }[] = [];
  if (meta.gerente) linhas.push({ label: 'Gerente', value: meta.gerente });
  if (meta.coordenador_1_dia) linhas.push({ label: 'Coord. 1º dia', value: meta.coordenador_1_dia });
  if (meta.coordenador_2_dia) linhas.push({ label: 'Coord. 2º dia', value: meta.coordenador_2_dia });
  if (meta.coordenador_madrugada_1) {
    linhas.push({ label: 'Coord. madrugada 1', value: meta.coordenador_madrugada_1 });
  }
  if (meta.coordenador_madrugada_2) {
    linhas.push({ label: 'Coord. madrugada 2', value: meta.coordenador_madrugada_2 });
  }
  if (meta.time_total != null && meta.time_total !== '') {
    linhas.push({ label: 'Time total', value: String(meta.time_total) });
  }
  if (meta.territorio) linhas.push({ label: 'Território', value: meta.territorio });
  return linhas;
}

export default function VisitaIniciadaScreen({
  visitaId,
  loja,
  auditor,
  dataVisita,
  horaInicio,
  totalSecoes,
  totalPerguntas,
  tipoChecklist,
  metaVisita,
  onComecar,
  ionic = false,
}: Props) {
  const dataHoraVisita = formatDataHoraVisita(dataVisita, horaInicio);
  const meta = metaVisita ?? {};
  const { dispararVoltar } = useChecklistMobileUi();
  const metaLinhas = MetaLinhas({ meta });

  if (ionic) {
    return (
      <ChecklistIonicShell scrollY={false}>
        <div className="ck-go ck-start--fixed">
          <div className="ck-start__scroll">
            <div className="ck-go__stage">
              <div className="ck-start__glow ck-start__glow--a" aria-hidden />
              <div className="ck-start__mesh" aria-hidden />
              <div className="ck-go__stage-inner">
                <button
                  type="button"
                  className="ck-go__back"
                  onClick={() => dispararVoltar()}
                  aria-label="Voltar"
                >
                  ←
                </button>
                <img
                  src={assetUrl('Logo_Icon-clear.png')}
                  alt=""
                  className="ck-go__logo"
                  width={44}
                  height={44}
                />
                <p className="ck-go__eyebrow">Protocolo #{visitaId}</p>
                <h1 className="ck-go__title">Visita aberta</h1>
                <p className="ck-go__sub">Confira os dados e comece a avaliação.</p>
                <div className="ck-go__metrics">
                  <div className="ck-start__metric">
                    <strong>{totalPerguntas}</strong>
                    <span>perguntas</span>
                  </div>
                  <div className="ck-start__metric">
                    <strong>{totalSecoes}</strong>
                    <span>seções</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ck-go__sheet">
              <div className="ck-go__card">
                {tipoChecklist && (
                  <div className="ck-go__row">
                    <span>Checklist</span>
                    <strong>{tipoChecklist}</strong>
                  </div>
                )}
                <div className="ck-go__row">
                  <span>Data e hora</span>
                  <strong>{dataHoraVisita}</strong>
                </div>
                <div className="ck-go__row">
                  <span>Loja</span>
                  <strong>
                    {loja?.name ?? '—'}
                    {loja?.bk_number ? ` · BKN ${loja.bk_number}` : ''}
                  </strong>
                </div>
                <div className="ck-go__row">
                  <span>Auditor</span>
                  <strong>{auditor?.nome ?? '—'}</strong>
                </div>
                {metaLinhas.map((l) => (
                  <div key={l.label} className="ck-go__row">
                    <span>{l.label}</span>
                    <strong>{l.value}</strong>
                  </div>
                ))}
              </div>

              <div className="ck-go__tip">
                <strong>Como funciona</strong>
                <p>
                  Responda seção por seção. Use Salvar para guardar o progresso e anexe fotos quando
                  o critério pedir.
                </p>
              </div>
            </div>
          </div>

          <footer className="ck-start__dock ck-go__dock">
            <button type="button" className="ck-start__cta is-ready" onClick={onComecar}>
              <span>Começar avaliação</span>
              <span className="ck-start__cta-arrow" aria-hidden>
                →
              </span>
            </button>
          </footer>
        </div>
      </ChecklistIonicShell>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        px: 2,
        py: 3,
        pb: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: '#EAF3DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1.5,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'secondary.main' }}>
          Visita registrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, px: 1 }}>
          O checklist foi aberto com sucesso. Confira os dados abaixo antes de iniciar a avaliação
          em loja.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <AssignmentIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Dados da visita
          </Typography>
        </Box>
        {tipoChecklist && <InfoRow label="Checklist" value={tipoChecklist} />}
        <InfoRow label="Protocolo" value={`#${visitaId}`} />
        <InfoRow label="Data e hora" value={dataHoraVisita} />
        <Divider sx={{ my: 0.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
          <StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Loja avaliada
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {loja?.name ?? '—'}
            </Typography>
            {loja?.bk_number && (
              <Typography variant="caption" color="text.secondary">
                BKN {loja.bk_number}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Supervisor / auditor
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {auditor?.nome ?? '—'}
            </Typography>
          </Box>
        </Box>
        {metaLinhas.map((l) => (
          <InfoRow key={l.label} label={l.label} value={l.value} />
        ))}
      </Paper>

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          bgcolor: '#FFF0E8',
          border: '1px solid',
          borderColor: 'primary.light',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
          Escopo da avaliação
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {totalPerguntas} critérios distribuídos em {totalSecoes} seções temáticas.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="ul" sx={{ m: 0, pl: 2 }}>
          <li>Responda seção por seção, na ordem sugerida</li>
          <li>
            Use <strong>Salvar</strong> para preservar o progresso
          </li>
          <li>Anexe fotos quando indicado (evidências)</li>
        </Typography>
      </Paper>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={onComecar}
        sx={{ mt: 'auto', minHeight: 56, fontWeight: 700, fontSize: '1rem' }}
      >
        Começar avaliação
      </Button>
    </Box>
  );
}
