import type { ReactNode } from 'react';
import { assetUrl } from '../../config/paths';
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
  /** Se definido, mostra botão voltar no stage. */
  onBack?: () => void;
  /** Conteúdo do sheet. */
  children: ReactNode;
  /** Hub principal: reserva tab bar. Subpáginas: padding só no rodapé. */
  variant?: 'hub' | 'page';
  extraStage?: ReactNode;
};

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
  return (
    <div className={`ck-visitas ck-frota${variant === 'hub' ? '' : ' ck-frota--page'}`}>
      <div className="ck-visitas__scroll">
        <div className="ck-visitas__stage">
          <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
          <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
          <div className="ck-visitas__mesh" aria-hidden />

          <div className="ck-visitas__stage-inner">
            {onBack && (
              <div className="ck-visitas__toolbar ck-visitas__anim ck-visitas__anim--1">
                <button type="button" className="ck-visitas__back" aria-label="Voltar" onClick={onBack}>
                  ←
                </button>
                <span />
              </div>
            )}

            <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--2">
              <div>
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
              <img
                src={assetUrl('Logo_Icon-clear.png')}
                alt=""
                className="ck-visitas__mark-icon"
                width={56}
                height={56}
              />
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
        </div>

        <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">{children}</div>
      </div>
    </div>
  );
}
