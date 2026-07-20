import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonText,
  useIonActionSheet,
} from '@ionic/react';
import { locationOutline, personOutline, playOutline, trashOutline } from 'ionicons/icons';
import type { Loja, TipoChecklist, Usuario, MetaVisitaTimeCampo } from '../../api/client';
import type { ChecklistSessaoLocal } from '../../utils/checklistSessao';
import TimeCampoMetaForm from './TimeCampoMetaForm';
import ChecklistIonicShell from './ChecklistIonicShell';

type Props = {
  msg: string;
  onClearMsg: () => void;
  sessaoLocal: ChecklistSessaoLocal | null;
  onContinuar: () => void;
  onEsquecer: () => void;
  saving: boolean;
  retomando: boolean;
  totalPerguntas: number;
  totalSecoes: number;
  carregandoTipo: boolean;
  auditores: Usuario[];
  idAuditor: number | '';
  nomeAuditorFallback: string;
  onSelecionarAuditor: (id: number) => void;
  lojas: Loja[];
  idLoja: number | '';
  onSelecionarLoja: (id: number) => void;
  tiposChecklist: TipoChecklist[];
  tipoCodigo: string;
  onSelecionarTipo: (codigo: string) => void;
  metaVisita: MetaVisitaTimeCampo;
  onMetaChange: (patch: Partial<MetaVisitaTimeCampo>) => void;
  podeIniciar: boolean;
  onIniciar: () => void;
};

export default function ChecklistIonicSetup(props: Props) {
  const {
    msg,
    onClearMsg,
    sessaoLocal,
    onContinuar,
    onEsquecer,
    saving,
    retomando,
    totalPerguntas,
    totalSecoes,
    carregandoTipo,
    auditores,
    idAuditor,
    nomeAuditorFallback,
    onSelecionarAuditor,
    lojas,
    idLoja,
    onSelecionarLoja,
    tiposChecklist,
    tipoCodigo,
    onSelecionarTipo,
    metaVisita,
    onMetaChange,
    podeIniciar,
    onIniciar,
  } = props;

  const [present] = useIonActionSheet();
  const auditorAtual = auditores.find((u) => u.id_usuario === idAuditor);
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja);
  const nomeAuditor = auditorAtual?.nome ?? nomeAuditorFallback;
  const nomeLoja = lojaAtual?.name ?? (lojas.length > 1 ? 'Selecione a loja' : lojas[0]?.name ?? '—');

  function escolherAuditor() {
    if (auditores.length <= 1) return;
    void present({
      header: 'Escolher auditor',
      buttons: [
        ...auditores.map((u) => ({
          text: u.nome,
          handler: () => onSelecionarAuditor(u.id_usuario),
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
  }

  function escolherLoja() {
    if (lojas.length <= 1) return;
    void present({
      header: 'Escolher loja',
      buttons: [
        ...lojas.map((l) => ({
          text: l.bk_number ? `${l.name} · BKN ${l.bk_number}` : l.name,
          handler: () => onSelecionarLoja(l.id_loja),
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
  }

  return (
    <ChecklistIonicShell>
      <div className="ios-large-title">
        <h1>Nova visita</h1>
        <p>Configure a loja e o tipo de checklist para começar a avaliação em campo.</p>
      </div>

      <div className="resumo-pill">
        {carregandoTipo ? 'Carregando…' : `${totalPerguntas} itens · ${totalSecoes} seções`}
      </div>

      {msg && (
        <IonList inset={true}>
          <IonItem color="danger" lines="none">
            <IonLabel className="ion-text-wrap">
              <h3>Não foi possível continuar</h3>
              <p>{msg}</p>
            </IonLabel>
            <IonButton slot="end" fill="clear" color="light" onClick={onClearMsg}>
              Ok
            </IonButton>
          </IonItem>
        </IonList>
      )}

      {sessaoLocal && (
        <IonList inset={true}>
          <IonItem lines="none" color="warning">
            <IonLabel className="ion-text-wrap">
              <h2>Visita pausada neste aparelho</h2>
              <p>Protocolo #{sessaoLocal.visitaId}</p>
            </IonLabel>
          </IonItem>
          <IonItem lines="none">
            <div style={{ display: 'flex', gap: 8, width: '100%', padding: '4px 0 8px' }}>
              <IonButton
                expand="block"
                color="dark"
                disabled={saving || retomando}
                onClick={onContinuar}
                style={{ flex: 1 }}
              >
                <IonIcon slot="start" icon={playOutline} />
                Continuar
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                color="medium"
                disabled={saving || retomando}
                onClick={onEsquecer}
                style={{ flex: 1 }}
              >
                <IonIcon slot="start" icon={trashOutline} />
                Esquecer
              </IonButton>
            </div>
          </IonItem>
        </IonList>
      )}

      <IonList inset={true}>
        <IonListHeader>
          <IonLabel>Contexto</IonLabel>
        </IonListHeader>
        <IonItem button={auditores.length > 1} detail={auditores.length > 1} onClick={escolherAuditor}>
          <IonIcon slot="start" icon={personOutline} color="primary" />
          <IonLabel>
            <p>Auditor</p>
            <h2>{nomeAuditor}</h2>
          </IonLabel>
        </IonItem>
        <IonItem button={lojas.length > 1} detail={lojas.length > 1} onClick={escolherLoja}>
          <IonIcon slot="start" icon={locationOutline} color="secondary" />
          <IonLabel>
            <p>Loja</p>
            <h2>{nomeLoja}</h2>
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList inset={true}>
        <IonListHeader>
          <IonLabel>Tipo de checklist</IonLabel>
          {carregandoTipo && <IonSpinner name="crescent" style={{ width: 18, height: 18, marginRight: 12 }} />}
        </IonListHeader>
        <IonRadioGroup value={tipoCodigo} onIonChange={(e) => onSelecionarTipo(String(e.detail.value))}>
          {tiposChecklist.map((t) => (
            <IonItem key={t.codigo}>
              <IonRadio value={t.codigo} justify="start" labelPlacement="end">
                <IonLabel>
                  <h2>{t.nome}</h2>
                  {t.descricao && <p>{t.descricao}</p>}
                </IonLabel>
              </IonRadio>
            </IonItem>
          ))}
        </IonRadioGroup>
      </IonList>

      {tipoCodigo === 'time_de_campo' && (
        <IonList inset={true}>
          <IonItem lines="none">
            <div style={{ width: '100%', padding: '8px 0' }}>
              <TimeCampoMetaForm value={metaVisita} onChange={onMetaChange} />
            </div>
          </IonItem>
        </IonList>
      )}

      <div className="cta-wrap">
        <IonButton
          expand="block"
          size="large"
          color="secondary"
          disabled={saving || carregandoTipo || !podeIniciar}
          onClick={onIniciar}
        >
          {saving ? <IonSpinner name="crescent" /> : 'Iniciar checklist'}
        </IonButton>
        {!podeIniciar && (
          <IonNote style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
            <IonText color="medium">Escolha loja, auditor e tipo para continuar.</IonText>
          </IonNote>
        )}
      </div>
    </ChecklistIonicShell>
  );
}
