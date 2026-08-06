import type { ReactNode } from 'react';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import '../visitas/visitas-mobile.css';
import './frota-mobile.css';

export type FrotaMetric = {
  value: ReactNode;
  label: string;
  accent?: boolean;
};

type Props = {
  /** Linha 1 do título (Fraunces). */
  titleLine1: string;
  /** Linha 2 do título. */
  titleLine2?: string;
  sub: string;
  metrics?: FrotaMetric[];
  /** Se definido, mostra botão voltar ao lado da logo. */
  onBack?: () => void;
  /** Conteúdo do sheet. */
  children: ReactNode;
  /** Hub principal: reserva tab bar. Subpáginas: header fixo + sheet com scroll interno. */
  variant?: 'hub' | 'page';
  extraStage?: ReactNode;
};

function StageContent({
  titleLine1,
  titleLine2,
  sub,
  metrics,
  onBack,
  extraStage,
}: Omit<Props, 'children' | 'variant'>) {
  return (
    <div className="ck-visitas__stage-inner">
      <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--2">
        <div className="ck-frota__hero-text">
          <p className="ck-visitas__mark-text">Grupo Alvim</p>
          <h1 className="ck-visitas__title">
            {titleLine1}
            {titleLine2 ? (
              <>
                <br />
                {titleLine2}
              </>
            ) : null}
          </h1>
        </div>
        <div className="ck-frota__hero-end">
          {onBack ? (
            <button
              type="button"
              className="ck-visitas__back ck-frota__back-beside-logo"
              aria-label="Voltar"
              onClick={onBack}
            >
              ←
            </button>
          ) : null}
          <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
        </div>
      </div>

      <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--3">{sub}</p>

      {metrics && metrics.length > 0 && (
        <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
          {metrics.map((m) => (
            <div
              key={m.label}
              className={`ck-visitas__metric${m.accent ? ' ck-visitas__metric--accent' : ''}`}
            >
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      )}

      {extraStage}
    </div>
  );
}

/** Casca immersive da Frota — mesmo modelo Checklist / Visitas. */
export default function FrotaMobileShell({
  titleLine1,
  titleLine2,
  sub,
  metrics,
  onBack,
  children,
  variant = 'page',
  extraStage,
}: Props) {
  const stage = (
    <div className="ck-visitas__stage">
      <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
      <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
      <div className="ck-visitas__mesh" aria-hidden />
      <StageContent
        titleLine1={titleLine1}
        titleLine2={titleLine2}
        sub={sub}
        metrics={metrics}
        onBack={onBack}
        extraStage={extraStage}
      />
    </div>
  );

  if (variant === 'hub') {
    return (
      <div className="ck-visitas ck-frota">
        <div className="ck-visitas__scroll">
          {stage}
          <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-visitas ck-frota ck-frota--page">
      {stage}
      <div className="ck-visitas__sheet ck-frota__sheet--fill ck-visitas__anim ck-visitas__anim--4">
        {children}
      </div>
    </div>
  );
}
