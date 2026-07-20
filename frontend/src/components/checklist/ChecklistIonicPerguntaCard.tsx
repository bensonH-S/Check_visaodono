import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonTextarea,
} from '@ionic/react';
import { checkmarkCircle, warning } from 'ionicons/icons';
import Rating from '@mui/material/Rating';
import type { Pergunta } from '../../api/client';
import PhotoCaptureMulti from './PhotoCaptureMulti';
import {
  exibeFoto,
  exibeObservacao,
  exigeFoto,
  maxFotos,
  parseFotos,
  serializeFotos,
} from '../../utils/checklistRules';
import {
  perguntaRespondida,
  type ErroPerguntaCampo,
  type RespostaLocal,
} from './ChecklistPerguntaCard';

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

interface Props {
  pergunta: Pergunta;
  resposta?: RespostaLocal;
  erroCampo?: ErroPerguntaCampo;
  onPatch: (patch: Partial<RespostaLocal>) => void;
  onSimNao: (opt: 'Sim' | 'Não') => void;
}

export default function ChecklistIonicPerguntaCard({
  pergunta: p,
  resposta: r,
  erroCampo,
  onPatch,
  onSimNao,
}: Props) {
  const fotos = getFotos(r);
  const ok = perguntaRespondida(p, r);
  const mostraFoto = exibeFoto(p, r?.resposta, r?.nota_estrelas);
  const mostraObs = exibeObservacao(p, r?.resposta, r?.nota_estrelas);

  return (
    <div className={`pergunta-card${ok ? ' ok' : ''}`}>
      <IonItem lines="none">
        <IonBadge slot="start" color={ok ? 'success' : 'medium'}>
          {p.codigo}
        </IonBadge>
        <IonLabel className="ion-text-wrap">
          <h2 style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.texto}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {p.critica && (
              <IonBadge color="danger">
                <IonIcon icon={warning} style={{ marginRight: 4 }} />
                Crítico
              </IonBadge>
            )}
            {ok && (
              <IonBadge color="success">
                <IonIcon icon={checkmarkCircle} style={{ marginRight: 4 }} />
                Respondida
              </IonBadge>
            )}
          </div>
        </IonLabel>
      </IonItem>

      {usaEstrelas(p) && (
        <div style={{ textAlign: 'center', padding: '8px 12px 12px' }}>
          <Rating
            value={r?.nota_estrelas ?? 0}
            onChange={(_, v) => {
              const nota = v && v >= 1 ? v : undefined;
              onPatch({ nota_estrelas: nota });
            }}
            size="large"
          />
          {r?.nota_estrelas != null && r.nota_estrelas >= 1 && (
            <IonNote style={{ display: 'block', marginTop: 4 }}>
              Avaliação: {r.nota_estrelas} {r.nota_estrelas === 1 ? 'estrela' : 'estrelas'}
            </IonNote>
          )}
        </div>
      )}

      {usaSimNao(p) && (
        <div className="sim-nao">
          <IonButton
            expand="block"
            fill={r?.resposta === 'Sim' ? 'solid' : 'outline'}
            color="success"
            onClick={() => onSimNao('Sim')}
          >
            Sim
          </IonButton>
          <IonButton
            expand="block"
            fill={r?.resposta === 'Não' ? 'solid' : 'outline'}
            color="danger"
            onClick={() => onSimNao('Não')}
          >
            Não
          </IonButton>
        </div>
      )}

      {mostraFoto && (
        <div
          style={{
            padding: '0 12px 12px',
            ...(erroCampo === 'foto'
              ? {
                  margin: '0 12px 12px',
                  padding: 8,
                  borderRadius: 12,
                  border: '1px solid var(--ion-color-danger)',
                  background: 'rgba(255, 59, 48, 0.06)',
                }
              : {}),
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
        </div>
      )}

      {mostraObs && (
        <div style={{ padding: '0 12px 12px' }}>
          <IonTextarea
            fill="outline"
            autoGrow
            rows={2}
            value={r?.observacao || ''}
            placeholder={
              p.codigo === '37'
                ? 'Digite aqui o que foi observado'
                : 'Digite aqui sua observação'
            }
            color={erroCampo === 'observacao' ? 'danger' : undefined}
            onIonInput={(e) => onPatch({ observacao: e.detail.value ?? '' })}
          />
          <IonNote
            color={erroCampo === 'observacao' ? 'danger' : 'medium'}
            style={{ display: 'block', marginTop: 4, fontSize: 12 }}
          >
            {erroCampo === 'observacao'
              ? p.requer_obs_em_nao
                ? 'Observação obrigatória quando selecionado Não'
                : 'Preencha a observação para continuar'
              : p.requer_obs_em_nao && r?.resposta === 'Não'
                ? 'Obrigatória quando selecionado Não'
                : 'Opcional — registre detalhes ou pendências'}
          </IonNote>
        </div>
      )}
    </div>
  );
}
