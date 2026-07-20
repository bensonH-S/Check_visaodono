import { IonButton, IonChip, IonIcon, IonProgressBar, IonText } from '@ionic/react';
import {
  checkmarkCircle,
  checkmarkOutline,
  chevronBackOutline,
  chevronForwardOutline,
  saveOutline,
} from 'ionicons/icons';
import type { CategoriaChecklist, Loja, Pergunta } from '../../api/client';
import ChecklistIonicPerguntaCard from './ChecklistIonicPerguntaCard';
import ChecklistIonicShell from './ChecklistIonicShell';
import {
  perguntaRespondida,
  type ErroPerguntaCampo,
  type RespostaLocal,
} from './ChecklistPerguntaCard';

type Props = {
  loja?: Loja;
  visitaId: number | null;
  checklist: CategoriaChecklist[];
  indiceSecao: number;
  secaoAtual: CategoriaChecklist;
  respostas: Record<number, RespostaLocal>;
  errosPerguntas: Record<number, ErroPerguntaCampo>;
  respondidas: number;
  totalPerguntas: number;
  progressoGeral: number;
  msg: string;
  msgTitulo: string;
  saving: boolean;
  onLimparMsg: () => void;
  onIrParaSecao: (idx: number) => void;
  onPatch: (idPergunta: number, patch: Partial<RespostaLocal>) => void;
  onSimNao: (p: Pergunta, opt: 'Sim' | 'Não') => void;
  secaoCompleta: (cat: CategoriaChecklist) => boolean;
  onSecaoAnterior: () => void;
  onSalvar: () => void;
  onProxima: () => void;
  onFinalizar: () => void;
};

export default function ChecklistIonicFluxo({
  loja,
  visitaId,
  checklist,
  indiceSecao,
  secaoAtual,
  respostas,
  errosPerguntas,
  respondidas,
  totalPerguntas,
  progressoGeral,
  msg,
  msgTitulo,
  saving,
  onLimparMsg,
  onIrParaSecao,
  onPatch,
  onSimNao,
  secaoCompleta,
  onSecaoAnterior,
  onSalvar,
  onProxima,
  onFinalizar,
}: Props) {
  const totalSecoes = checklist.length;
  const ehUltimaSecao = indiceSecao === totalSecoes - 1;
  const respondidasSecao = secaoAtual.perguntas.filter((p) =>
    perguntaRespondida(p, respostas[p.id_pergunta]),
  ).length;

  return (
    <ChecklistIonicShell scrollY={false}>
    <div className="fluxo-root">
      <div className="fluxo-top">
        <IonText color="medium">
          <p style={{ margin: 0, fontSize: 12 }}>
            {loja?.name}
            {visitaId ? ` · Visita #${visitaId}` : ''}
          </p>
        </IonText>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <strong style={{ fontSize: 14, color: '#1B2A6B' }}>Progresso geral</strong>
          <strong style={{ fontSize: 14, color: '#E8520A' }}>
            {respondidas}/{totalPerguntas} ({progressoGeral}%)
          </strong>
        </div>
        <IonProgressBar value={progressoGeral / 100} color="secondary" style={{ marginTop: 8 }} />
      </div>

      <div className="sec-rail">
        {checklist.map((cat, idx) => {
          const completa = secaoCompleta(cat);
          const ativa = idx === indiceSecao;
          return (
            <IonChip
              key={cat.id_categoria}
              color={ativa ? 'secondary' : completa ? 'success' : 'medium'}
              outline={!ativa}
              onClick={() => onIrParaSecao(idx)}
              style={{ flexShrink: 0, fontWeight: ativa ? 700 : 500 }}
            >
              {completa && <IonIcon icon={checkmarkCircle} />}
              {idx + 1}. {cat.nome.split(' ')[0]}
            </IonChip>
          );
        })}
      </div>

      <div className="secao-banner">
        <p className="ov">
          Seção {indiceSecao + 1} de {totalSecoes}
        </p>
        <h2>{secaoAtual.nome}</h2>
        <p>
          {respondidasSecao}/{secaoAtual.perguntas.length} respondidas nesta seção
        </p>
      </div>

      <div className="fluxo-body">
        {msg && (
          <IonListLikeAlert msg={msg} msgTitulo={msgTitulo} onLimparMsg={onLimparMsg} />
        )}

        {secaoAtual.perguntas.map((p) => (
          <ChecklistIonicPerguntaCard
            key={p.id_pergunta}
            pergunta={p}
            resposta={respostas[p.id_pergunta]}
            erroCampo={errosPerguntas[p.id_pergunta]}
            onPatch={(patch) => onPatch(p.id_pergunta, patch)}
            onSimNao={(opt) => onSimNao(p, opt)}
          />
        ))}
      </div>

      <div className="fluxo-foot">
        {indiceSecao > 0 && (
          <IonButton fill="clear" color="primary" disabled={saving} onClick={onSecaoAnterior}>
            <IonIcon slot="start" icon={chevronBackOutline} />
            Seção anterior
          </IonButton>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <IonButton
            expand="block"
            fill="outline"
            color="primary"
            disabled={saving}
            onClick={onSalvar}
            style={{ flex: 1 }}
          >
            <IonIcon slot="start" icon={saveOutline} />
            Salvar
          </IonButton>
          {ehUltimaSecao ? (
            <IonButton
              expand="block"
              color="success"
              disabled={saving}
              onClick={onFinalizar}
              style={{ flex: 1 }}
            >
              <IonIcon slot="end" icon={checkmarkOutline} />
              Finalizar
            </IonButton>
          ) : (
            <IonButton
              expand="block"
              color="secondary"
              disabled={saving}
              onClick={onProxima}
              style={{ flex: 1 }}
            >
              Próxima
              <IonIcon slot="end" icon={chevronForwardOutline} />
            </IonButton>
          )}
        </div>
      </div>
    </div>
    </ChecklistIonicShell>
  );
}

function IonListLikeAlert({
  msg,
  msgTitulo,
  onLimparMsg,
}: {
  msg: string;
  msgTitulo: string;
  onLimparMsg: () => void;
}) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(255, 149, 0, 0.12)',
        border: '1px solid rgba(255, 149, 0, 0.35)',
      }}
    >
      {msgTitulo && <strong style={{ display: 'block', marginBottom: 4 }}>{msgTitulo}</strong>}
      <span>{msg}</span>
      <IonButton size="small" fill="clear" color="warning" onClick={onLimparMsg}>
        Fechar
      </IonButton>
    </div>
  );
}
