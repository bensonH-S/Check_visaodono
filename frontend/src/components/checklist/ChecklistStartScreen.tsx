import { useMemo, useState } from 'react';
import type { Loja, TipoChecklist, Usuario, MetaVisitaTimeCampo } from '../../api/client';
import type { ChecklistSessaoLocal } from '../../utils/checklistSessao';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import TimeCampoMetaForm from './TimeCampoMetaForm';
import ChecklistIonicShell from './ChecklistIonicShell';
import ChecklistPickSheet from './ChecklistPickSheet';

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

function monogramaTipo(codigo: string, nome: string) {
  if (codigo.includes('time')) return 'TC';
  if (codigo.includes('visao') || codigo.includes('dono')) return 'VD';
  if (codigo.includes('oper')) return 'OP';
  const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return (letras.slice(0, 2) || 'CK').toUpperCase();
}

/** Tela inicial do checklist — composição própria (marca + fluxo). */
export default function ChecklistStartScreen(props: Props) {
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

  const [pickLoja, setPickLoja] = useState(false);
  const auditorAtual = auditores.find((u) => u.id_usuario === idAuditor);
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja);
  const nomeAuditor = auditorAtual?.nome ?? nomeAuditorFallback;
  const nomeLoja = lojaAtual?.name ?? null;
  const bkn = lojaAtual?.bk_number;

  const lojaOptions = useMemo(
    () =>
      lojas.map((l) => ({
        id: l.id_loja,
        label: l.name,
        meta: l.bk_number ? `BKN ${l.bk_number}` : undefined,
      })),
    [lojas],
  );

  return (
    <ChecklistIonicShell scrollY={false}>
      <div className="ck-start ck-start--fixed">
        <div className="ck-start__stage">
          <div className="ck-start__glow ck-start__glow--a" aria-hidden />
          <div className="ck-start__glow ck-start__glow--b" aria-hidden />
          <div className="ck-start__mesh" aria-hidden />

          <div className="ck-start__stage-inner">
            <div className="ck-start__hero-row ck-start__anim ck-start__anim--1">
              <div className="ck-start__hero-copy">
                <p className="ck-start__mark-text">Grupo Alvim</p>
                <h1 className="ck-start__title ck-start__title--oneline">Nova visita</h1>
              </div>
              <CkMarkLogoMenu size={72} className="ck-start__mark-icon" />
            </div>

            <p className="ck-start__sub ck-start__anim ck-start__anim--2">
              Escolha a loja e o tipo de avaliação para começar.
            </p>

            <div className="ck-start__metrics ck-start__anim ck-start__anim--3" aria-live="polite">
              <div className="ck-start__metric">
                <strong>{carregandoTipo ? '—' : totalPerguntas}</strong>
                <span>perguntas</span>
              </div>
              <div className="ck-start__metric">
                <strong>{carregandoTipo ? '—' : totalSecoes}</strong>
                <span>seções</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ck-start__sheet ck-start__sheet--fill ck-start__anim ck-start__anim--4">
            {msg && (
              <div className="ck-start__banner ck-start__banner--err" role="alert">
                <p>{msg}</p>
                <button type="button" onClick={onClearMsg}>
                  Fechar
                </button>
              </div>
            )}

            {sessaoLocal && (
              <div className="ck-start__banner ck-start__banner--warn">
                <div>
                  <strong>Visita pausada</strong>
                  <p>Protocolo #{sessaoLocal.visitaId}</p>
                </div>
                <div className="ck-start__banner-actions">
                  <button type="button" className="ck-start__btn-navy" disabled={saving || retomando} onClick={onContinuar}>
                    Continuar
                  </button>
                  <button type="button" className="ck-start__btn-ghost" disabled={saving || retomando} onClick={onEsquecer}>
                    Esquecer
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className={`ck-start__destino${nomeLoja ? ' is-set' : ''}`}
              onClick={() => {
                if (lojas.length > 1) setPickLoja(true);
              }}
              disabled={lojas.length <= 1}
            >
              <span className="ck-start__destino-kicker">Unidade</span>
              <span className="ck-start__destino-nome">{nomeLoja ?? 'Escolher loja'}</span>
              {bkn ? <span className="ck-start__destino-meta">BKN {bkn}</span> : null}
              {lojas.length > 1 && <span className="ck-start__destino-go">Trocar</span>}
            </button>

            <div className="ck-start__auditor ck-start__auditor--locked" aria-label={`Auditor: ${nomeAuditor}`}>
              <span>Auditor</span>
              <strong>{nomeAuditor}</strong>
              <em className="ck-start__auditor-tag">você</em>
            </div>

            <div className="ck-start__tipos-head">
              <h2>Tipo de checklist</h2>
              {carregandoTipo && <span className="ck-start__loading">carregando…</span>}
            </div>

            <div className="ck-start__tipos" role="listbox" aria-label="Tipo de checklist">
              {tiposChecklist.map((t) => {
                const on = tipoCodigo === t.codigo;
                return (
                  <button
                    key={t.codigo}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ck-start__tipo${on ? ' is-on' : ''}`}
                    onClick={() => onSelecionarTipo(t.codigo)}
                  >
                    <span className="ck-start__tipo-mono" aria-hidden>
                      {monogramaTipo(t.codigo, t.nome)}
                    </span>
                    <span className="ck-start__tipo-copy">
                      <strong>{t.nome}</strong>
                      {t.descricao ? <small>{t.descricao}</small> : null}
                    </span>
                    <span className={`ck-start__tipo-check${on ? ' is-on' : ''}`} aria-hidden>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {tipoCodigo === 'time_de_campo' && (
              <div className="ck-start__meta">
                <h2>Time de campo</h2>
                <TimeCampoMetaForm value={metaVisita} onChange={onMetaChange} />
              </div>
            )}
        </div>

        <footer className="ck-start__dock">
          <button
            type="button"
            className={`ck-start__cta${podeIniciar && !saving && !carregandoTipo ? ' is-ready' : ''}`}
            disabled={saving || carregandoTipo || !podeIniciar}
            onClick={onIniciar}
          >
            <span>{saving ? 'Abrindo visita…' : 'Iniciar visita'}</span>
            {!saving && (
              <span className="ck-start__cta-arrow" aria-hidden>
                →
              </span>
            )}
          </button>
          {!podeIniciar && (
            <p className="ck-start__hint">Selecione a loja e o tipo para continuar</p>
          )}
        </footer>
      </div>

      <ChecklistPickSheet
        open={pickLoja}
        title="Escolher loja"
        options={lojaOptions}
        selectedId={idLoja === '' ? null : idLoja}
        onSelect={(id) => onSelecionarLoja(Number(id))}
        onClose={() => setPickLoja(false)}
      />
    </ChecklistIonicShell>
  );
}
