import { useEffect, useState } from 'react';
import {
  addDaysIso,
  DIAS_ABREV,
  diaIndexNaSemana,
  fmtDataAgenda,
  fmtDiaCalendario,
} from './escalaVisitasUtils';
import type { EscalaAgendaLoja, EscalaAgendaPessoa } from './escalaAgendaModel';
import LojaBkMarca from './LojaBkMarca';
import './escala-agenda.css';

type EventoAgenda = {
  key: string;
  id_usuario: number;
  nome: string;
  cor: string;
  loja: EscalaAgendaLoja;
};

type Props = {
  pessoas: EscalaAgendaPessoa[];
  semanaInicio: string;
  variant: 'desktop' | 'mobile';
  onPessoaClick?: (id: number) => void;
};

function eventosDaSemana(pessoas: EscalaAgendaPessoa[]): EventoAgenda[][] {
  return Array.from({ length: 7 }, (_, dia) =>
    pessoas.flatMap((p) =>
      (p.dias[dia]?.lojas ?? []).map((loja) => ({
        key: `${p.id_usuario}-${dia}-${loja.id_loja}`,
        id_usuario: p.id_usuario,
        nome: p.primeiroNome,
        cor: p.cor,
        loja,
      })),
    ),
  );
}

function ChipEvento({
  ev,
  onPessoaClick,
}: {
  ev: EventoAgenda;
  onPessoaClick?: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className="ck-escala-cal__ev"
      onClick={onPessoaClick ? () => onPessoaClick(ev.id_usuario) : undefined}
      style={{
        background: `${ev.cor}26`,
        borderColor: ev.cor,
        color: 'inherit',
        cursor: onPessoaClick ? 'pointer' : 'default',
      }}
    >
      <i style={{ background: ev.cor }} />
      <strong>{ev.nome}</strong>
      <LojaBkMarca bk={ev.loja.bk} nome={ev.loja.nome} size={16} />
    </button>
  );
}

export default function EscalaAgendaPessoas({
  pessoas,
  semanaInicio,
  variant,
  onPessoaClick,
}: Props) {
  const hoje = diaIndexNaSemana(semanaInicio);
  const porDia = eventosDaSemana(pessoas);
  const temEvento = porDia.some((d) => d.length > 0);
  const [diaSel, setDiaSel] = useState(hoje ?? 0);

  useEffect(() => {
    setDiaSel(hoje ?? 0);
  }, [hoje, semanaInicio]);

  if (!temEvento) {
    return (
      <div className={`ck-escala-cal ck-escala-cal--${variant}`}>
        <div className="ck-escala-cal__empty">Nenhuma visita nesta semana.</div>
      </div>
    );
  }

  if (variant === 'mobile') {
    const eventos = porDia[diaSel] ?? [];
    const iso = addDaysIso(semanaInicio, diaSel);
    return (
      <div className="ck-escala-cal ck-escala-cal--mobile">
        <div className="ck-escala-cal__dias" role="tablist">
          {DIAS_ABREV.map((label, dia) => {
            const cal = fmtDiaCalendario(addDaysIso(semanaInicio, dia));
            const n = porDia[dia].length;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={diaSel === dia}
                className={`ck-escala-cal__dia${diaSel === dia ? ' is-on' : ''}${hoje === dia ? ' is-today' : ''}`}
                onClick={() => setDiaSel(dia)}
              >
                <span>{label}</span>
                <b>{cal.dia}</b>
                {n > 0 ? <em>{n}</em> : null}
              </button>
            );
          })}
        </div>
        <header className="ck-escala-cal__data">
          {hoje === diaSel ? <em>Hoje</em> : null}
          <strong>{fmtDataAgenda(iso)}</strong>
        </header>
        {eventos.length ? (
          <div className="ck-escala-cal__lista">
            {eventos.map((ev) => (
              <ChipEvento key={ev.key} ev={ev} onPessoaClick={onPessoaClick} />
            ))}
          </div>
        ) : (
          <div className="ck-escala-cal__empty">Nenhuma visita neste dia.</div>
        )}
      </div>
    );
  }

  return (
    <div className="ck-escala-cal ck-escala-cal--desktop">
      <div className="ck-escala-cal__grid">
        {DIAS_ABREV.map((label, dia) => {
          const iso = addDaysIso(semanaInicio, dia);
          const cal = fmtDiaCalendario(iso);
          const ehHoje = hoje === dia;
          const eventos = porDia[dia];
          return (
            <div key={label} className={`ck-escala-cal__col${ehHoje ? ' is-today' : ''}`}>
              <div className="ck-escala-cal__col-h">
                <span>{label}</span>
                <b className={ehHoje ? 'is-today' : undefined}>{cal.dia}</b>
                <small>{cal.mes}</small>
              </div>
              <div className="ck-escala-cal__col-b">
                {eventos.length ? (
                  eventos.map((ev) => (
                    <ChipEvento key={ev.key} ev={ev} onPessoaClick={onPessoaClick} />
                  ))
                ) : (
                  <span className="ck-escala-cal__vazio">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
