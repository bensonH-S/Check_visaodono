import Rating from '@mui/material/Rating';
import type { Pergunta } from '../../api/client';
import PhotoCaptureMulti from './PhotoCaptureMulti';
import {
  exibeFoto,
  exibeObservacao,
  exigeFoto,
  isObsSomenteEmSim,
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
  onSimNao: (opt: 'Sim' | 'Não' | 'N/A') => void;
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
    <article className={`ck-q${ok ? ' is-ok' : ''}${erroCampo ? ' is-err' : ''}`}>
      <header className="ck-q__head">
        <span className={`ck-q__code${ok ? ' is-ok' : ''}`}>{p.codigo}</span>
        <div className="ck-q__title-wrap">
          <h3 className="ck-q__title">{p.texto}</h3>
          <div className="ck-q__tags">
            {p.critica && <span className="ck-q__tag ck-q__tag--crit">Crítico</span>}
            {ok && <span className="ck-q__tag ck-q__tag--ok">Respondida</span>}
          </div>
        </div>
      </header>

      {usaEstrelas(p) && (
        <div className="ck-q__stars">
          <Rating
            value={r?.nota_estrelas ?? 0}
            onChange={(_, v) => {
              const nota = v && v >= 1 ? v : undefined;
              onPatch({ nota_estrelas: nota });
            }}
            size="large"
          />
          {r?.nota_estrelas != null && r.nota_estrelas >= 1 && (
            <p>
              {r.nota_estrelas} {r.nota_estrelas === 1 ? 'estrela' : 'estrelas'}
            </p>
          )}
        </div>
      )}

      {usaSimNao(p) && (
        <div className="ck-q__yn ck-q__yn--3">
          <button
            type="button"
            className={`ck-q__yn-btn ck-q__yn-btn--yes${r?.resposta === 'Sim' ? ' is-on' : ''}`}
            onClick={() => onSimNao('Sim')}
          >
            Sim
          </button>
          <button
            type="button"
            className={`ck-q__yn-btn ck-q__yn-btn--no${r?.resposta === 'Não' ? ' is-on' : ''}`}
            onClick={() => onSimNao('Não')}
          >
            Não
          </button>
          <button
            type="button"
            className={`ck-q__yn-btn ck-q__yn-btn--na${r?.resposta === 'N/A' ? ' is-on' : ''}`}
            onClick={() => onSimNao('N/A')}
            aria-label="Não se aplica"
            title="Não se aplica"
          >
            N/A
          </button>
        </div>
      )}

      {mostraFoto && (
        <div className={`ck-q__foto${erroCampo === 'foto' ? ' is-err' : ''}`}>
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
        <div className="ck-q__obs">
          <textarea
            className={`ck-q__textarea${erroCampo === 'observacao' ? ' is-err' : ''}`}
            rows={2}
            value={r?.observacao || ''}
            placeholder={
              isObsSomenteEmSim(p)
                ? 'Digite aqui o que foi observado'
                : 'Digite aqui sua observação'
            }
            onChange={(e) => onPatch({ observacao: e.target.value })}
          />
          <p className={`ck-q__hint${erroCampo === 'observacao' ? ' is-err' : ''}`}>
            {erroCampo === 'observacao'
              ? p.requer_obs_em_nao
                ? 'Observação obrigatória quando selecionado Não'
                : 'Preencha a observação para continuar'
              : p.requer_obs_em_nao && r?.resposta === 'Não'
                ? 'Obrigatória quando selecionado Não'
                : 'Opcional — registre detalhes ou pendências'}
          </p>
        </div>
      )}
    </article>
  );
}
