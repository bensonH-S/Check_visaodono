import {
  addDaysIso,
  DIAS_ABREV,
  diaIndexNaSemana,
  fmtDataCurta,
} from './escalaVisitasUtils';
import { agruparAgendaPorRegional, type EscalaAgendaPessoa } from './escalaAgendaModel';
import LojaBkMarca from './LojaBkMarca';
import './escala-agenda.css';

type Props = {
  pessoas: EscalaAgendaPessoa[];
  semanaInicio: string;
  variant: 'desktop' | 'mobile';
  onPessoaClick?: (id: number) => void;
};

export default function EscalaAgendaPorRegional({
  pessoas,
  semanaInicio,
  variant,
  onPessoaClick,
}: Props) {
  const hoje = diaIndexNaSemana(semanaInicio);
  const grupos = agruparAgendaPorRegional(pessoas);
  const temEvento = pessoas.some((p) => p.total > 0);

  if (!temEvento) {
    return (
      <div className={`ck-escala-cal ck-escala-reg ck-escala-cal--${variant}`}>
        <div className="ck-escala-cal__empty">Nenhuma visita nesta semana.</div>
      </div>
    );
  }

  return (
    <div className={`ck-escala-cal ck-escala-reg ck-escala-cal--${variant}`}>
      {grupos.map((grupo) => (
        <section key={grupo.chave} className="ck-escala-reg__bloco">
          <header className="ck-escala-reg__h">
            <strong>{grupo.nome_regiao}</strong>
            {grupo.nome_regional ? (
              <span>Regional {grupo.nome_regional}</span>
            ) : null}
          </header>
          {grupo.pessoas.map((p) => (
            <article key={p.id_usuario} className="ck-escala-reg__tec" style={{ ['--tec-cor' as string]: p.cor }}>
              <button
                type="button"
                className="ck-escala-reg__nome"
                onClick={onPessoaClick ? () => onPessoaClick(p.id_usuario) : undefined}
                style={{ cursor: onPessoaClick ? 'pointer' : 'default' }}
              >
                <i />
                <b>{p.primeiroNome}</b>
                <em>
                  {p.total} visita{p.total !== 1 ? 's' : ''}
                </em>
              </button>
              <div className="ck-escala-reg__grade">
                {DIAS_ABREV.map((label, dia) => {
                  const lojas = p.dias[dia]?.lojas ?? [];
                  const ehHoje = hoje === dia;
                  return (
                    <div
                      key={label}
                      className={`ck-escala-reg__dia${ehHoje ? ' is-today' : ''}${lojas.length ? ' is-on' : ''}`}
                    >
                      <span>
                        {label}
                        <small>{fmtDataCurta(addDaysIso(semanaInicio, dia))}</small>
                      </span>
                      {lojas.length ? (
                        lojas.map((loja) => (
                          <LojaBkMarca key={loja.id_loja} bk={loja.bk} nome={loja.nome} size={16} />
                        ))
                      ) : (
                        <em>Folga</em>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
