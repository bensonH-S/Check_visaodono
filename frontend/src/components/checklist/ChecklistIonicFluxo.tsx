import { useChecklistMobileUi } from '../../context/ChecklistMobileUiContext';
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
  const { dispararVoltar } = useChecklistMobileUi();
  const totalSecoes = checklist.length;
  const ehUltimaSecao = indiceSecao === totalSecoes - 1;
  const respondidasSecao = secaoAtual.perguntas.filter((p) =>
    perguntaRespondida(p, respostas[p.id_pergunta]),
  ).length;

  return (
    <ChecklistIonicShell scrollY={false}>
      <div className="ck-fluxo ck-start--fixed">
        <header className="ck-fluxo__top">
          <div className="ck-fluxo__top-row">
            <button
              type="button"
              className="ck-fluxo__back"
              onClick={() => dispararVoltar()}
              aria-label="Voltar"
            >
              ←
            </button>
            <div className="ck-fluxo__top-copy">
              <p className="ck-fluxo__loja">
                {loja?.name ?? 'Checklist'}
                {visitaId ? ` · #${visitaId}` : ''}
              </p>
              <strong>
                {respondidas}/{totalPerguntas} · {progressoGeral}%
              </strong>
            </div>
          </div>
          <div className="ck-fluxo__bar" aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(0, progressoGeral))}%` }} />
          </div>
        </header>

        <div className="ck-fluxo__rail" role="tablist" aria-label="Seções">
          {checklist.map((cat, idx) => {
            const completa = secaoCompleta(cat);
            const ativa = idx === indiceSecao;
            return (
              <button
                key={cat.id_categoria}
                type="button"
                role="tab"
                aria-selected={ativa}
                className={`ck-fluxo__chip${ativa ? ' is-on' : ''}${completa ? ' is-done' : ''}`}
                onClick={() => onIrParaSecao(idx)}
              >
                {completa ? '✓ ' : ''}
                {idx + 1}. {cat.nome.split(' ')[0]}
              </button>
            );
          })}
        </div>

        <div className="ck-fluxo__scroll">
          <div className="ck-fluxo__banner">
            <p>
              Seção {indiceSecao + 1} de {totalSecoes}
            </p>
            <h2>{secaoAtual.nome}</h2>
            <span>
              {respondidasSecao}/{secaoAtual.perguntas.length} respondidas
            </span>
          </div>

          {msg && (
            <div className="ck-fluxo__alert" role="alert">
              <div>
                {msgTitulo && <strong>{msgTitulo}</strong>}
                <p>{msg}</p>
              </div>
              <button type="button" onClick={onLimparMsg}>
                Fechar
              </button>
            </div>
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

        <footer className="ck-fluxo__dock">
          <div className="ck-fluxo__dock-row">
            {indiceSecao > 0 && (
              <button
                type="button"
                className="ck-fluxo__btn ck-fluxo__btn--ghost"
                disabled={saving}
                onClick={onSecaoAnterior}
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              className="ck-fluxo__btn ck-fluxo__btn--navy"
              disabled={saving}
              onClick={onSalvar}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {ehUltimaSecao ? (
              <button
                type="button"
                className="ck-fluxo__btn ck-fluxo__btn--ok"
                disabled={saving}
                onClick={onFinalizar}
              >
                Finalizar
              </button>
            ) : (
              <button
                type="button"
                className="ck-fluxo__btn ck-fluxo__btn--orange"
                disabled={saving}
                onClick={onProxima}
              >
                Próxima →
              </button>
            )}
          </div>
        </footer>
      </div>
    </ChecklistIonicShell>
  );
}
