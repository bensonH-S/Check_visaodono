import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
} from '@ionic/react';
import { checkmarkCircle, clipboardOutline, personOutline, storefrontOutline } from 'ionicons/icons';
import { formatDataHoraVisita } from '../../utils/dateBr';
import type { Loja, Usuario, MetaVisitaTimeCampo } from '../../api/client';
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

  if (ionic) {
    return (
      <ChecklistIonicShell>
      <div style={{ paddingBottom: 24 }}>
        <div className="ios-large-title">
          <h1>Visita aberta</h1>
          <p>Confira os dados e comece a avaliação em loja.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 16px' }}>
          <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 48 }} />
        </div>

        <IonList inset={true}>
          {tipoChecklist && (
            <IonItem>
              <IonIcon slot="start" icon={clipboardOutline} color="secondary" />
              <IonLabel>
                <p>Checklist</p>
                <h2>{tipoChecklist}</h2>
              </IonLabel>
            </IonItem>
          )}
          <IonItem>
            <IonLabel>
              <p>Protocolo</p>
              <h2>#{visitaId}</h2>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>
              <p>Data e hora</p>
              <h2>{dataHoraVisita}</h2>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonIcon slot="start" icon={storefrontOutline} color="primary" />
            <IonLabel>
              <p>Loja avaliada</p>
              <h2>{loja?.name ?? '—'}</h2>
              {loja?.bk_number && <p>BKN {loja.bk_number}</p>}
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonIcon slot="start" icon={personOutline} color="primary" />
            <IonLabel>
              <p>Supervisor / auditor</p>
              <h2>{auditor?.nome ?? '—'}</h2>
            </IonLabel>
          </IonItem>
          {meta.gerente && (
            <IonItem>
              <IonLabel>
                <p>Gerente</p>
                <h2>{meta.gerente}</h2>
              </IonLabel>
            </IonItem>
          )}
          {meta.territorio && (
            <IonItem>
              <IonLabel>
                <p>Território</p>
                <h2>{meta.territorio}</h2>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        <IonList inset={true}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>Escopo</h2>
              <p>
                {totalPerguntas} critérios em {totalSecoes} seções. Responda seção por seção e use
                Salvar para preservar o progresso.
              </p>
            </IonLabel>
          </IonItem>
        </IonList>

        <div className="cta-wrap">
          <IonButton expand="block" size="large" color="secondary" onClick={onComecar}>
            Começar avaliação
          </IonButton>
        </div>
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
          O checklist foi aberto com sucesso. Confira os dados abaixo antes de
          iniciar a avaliação em loja.
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
        {meta.gerente && <InfoRow label="Gerente" value={meta.gerente} />}
        {meta.coordenador_1_dia && <InfoRow label="Coord. 1º dia" value={meta.coordenador_1_dia} />}
        {meta.coordenador_2_dia && <InfoRow label="Coord. 2º dia" value={meta.coordenador_2_dia} />}
        {meta.coordenador_madrugada_1 && (
          <InfoRow label="Coord. madrugada 1" value={meta.coordenador_madrugada_1} />
        )}
        {meta.coordenador_madrugada_2 && (
          <InfoRow label="Coord. madrugada 2" value={meta.coordenador_madrugada_2} />
        )}
        {meta.time_total != null && meta.time_total !== '' && (
          <InfoRow label="Time total" value={String(meta.time_total)} />
        )}
        {meta.territorio && <InfoRow label="Território" value={meta.territorio} />}
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
          <li>Use <strong>Salvar</strong> para preservar o progresso</li>
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
