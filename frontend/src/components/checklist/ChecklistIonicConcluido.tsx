import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonSpinner,
  IonText,
} from '@ionic/react';
import {
  addOutline,
  checkmarkCircle,
  documentTextOutline,
  homeOutline,
} from 'ionicons/icons';
import { fmtNota, scoreColor } from '../../api/client';
import ChecklistIonicShell from './ChecklistIonicShell';

type Visita = {
  name: string;
  bk_number: string | null;
  nome_usuario: string;
  data_visita: string;
  nota_final: string | number | null;
  status: string;
};

type Props = {
  loading: boolean;
  err: string;
  visita: Visita | null;
  categorias: Array<{ categoria: string; percentual: string }>;
  id: string | undefined;
  dataFormatada: string;
  onVoltar: () => void;
  onRelatorio: () => void;
  onNovaVisita: () => void;
  onInicio: () => void;
};

export default function ChecklistIonicConcluido({
  loading,
  err,
  visita,
  categorias,
  id,
  dataFormatada,
  onVoltar,
  onRelatorio,
  onNovaVisita,
  onInicio,
}: Props) {
  if (loading) {
    return (
      <ChecklistIonicShell>
        <div style={{ padding: 32, textAlign: 'center' }}>
          <IonSpinner name="crescent" />
          <IonNote style={{ display: 'block', marginTop: 12 }}>Carregando…</IonNote>
        </div>
      </ChecklistIonicShell>
    );
  }

  if (err || !visita) {
    return (
      <ChecklistIonicShell>
        <div style={{ padding: 16 }}>
          <IonText color="danger">
            <p>{err || 'Visita não encontrada'}</p>
          </IonText>
          <IonButton expand="block" onClick={onVoltar}>
            Voltar
          </IonButton>
        </div>
      </ChecklistIonicShell>
    );
  }

  const nota = Number(visita.nota_final ?? 0);
  const corNota = scoreColor(nota);

  return (
    <ChecklistIonicShell>
    <div style={{ paddingBottom: 24 }}>
      <div className="ios-large-title">
        <h1>Finalizada</h1>
        <p>Avaliação concluída com sucesso.</p>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 16px' }}>
        <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 56 }} />
        <IonText color="primary">
          <h2 style={{ margin: '12px 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>
            Visita #{id}
          </h2>
        </IonText>
        <IonNote>
          {visita.name}
          {visita.bk_number ? ` · BKN ${visita.bk_number}` : ''}
        </IonNote>
        <IonNote style={{ display: 'block', marginTop: 4 }}>
          {dataFormatada} · {visita.nome_usuario} · #{id}
        </IonNote>
      </div>

      <IonList inset={true}>
        <IonItem lines="none">
          <IonLabel style={{ textAlign: 'center' }}>
            <p>Nota da avaliação</p>
            <h1 style={{ fontSize: '2.75rem', fontWeight: 800, color: corNota, margin: '8px 0' }}>
              {fmtNota(visita.nota_final)}
            </h1>
            <p>
              {nota >= 85
                ? 'Excelente desempenho operacional'
                : nota >= 75
                  ? 'Desempenho dentro da meta, com pontos de atenção'
                  : 'Atenção: resultado abaixo da meta'}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>

      {categorias.length > 0 && (
        <IonList inset={true}>
          <IonItem lines="none">
            <IonLabel>
              <h2>Por seção</h2>
            </IonLabel>
          </IonItem>
          {categorias.map((c) => {
            const temNota =
              c.percentual != null &&
              String(c.percentual) !== '' &&
              Number.isFinite(Number(c.percentual));
            const pct = temNota ? Number(c.percentual) : 0;
            return (
              <IonItem key={c.categoria} lines="none">
                <IonLabel>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{c.categoria}</span>
                    <strong>{pct}%</strong>
                  </div>
                  <IonProgressBar
                    value={Math.min(1, pct / 100)}
                    color={pct >= 80 ? 'success' : pct >= 60 ? 'secondary' : 'primary'}
                  />
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>
      )}

      <div className="cta-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <IonButton expand="block" size="large" color="primary" onClick={onRelatorio}>
          <IonIcon slot="start" icon={documentTextOutline} />
          Ver relatório completo
        </IonButton>
        <IonButton expand="block" fill="outline" color="secondary" onClick={onNovaVisita}>
          <IonIcon slot="start" icon={addOutline} />
          Nova visita
        </IonButton>
        <IonButton expand="block" fill="clear" color="medium" onClick={onInicio}>
          <IonIcon slot="start" icon={homeOutline} />
          Voltar ao checklist
        </IonButton>
      </div>
    </div>
    </ChecklistIonicShell>
  );
}
