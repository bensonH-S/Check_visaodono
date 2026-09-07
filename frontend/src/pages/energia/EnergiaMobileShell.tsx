import type { ReactNode } from 'react';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import type { Loja } from '../../api/client';
import { nomeLoja, persistirLoja, rotuloLoja } from './energiaMobileLoja';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';
import '../../components/energia/energia-mobile.css';

export function EnergiaMobileChrome({ children }: { children: ReactNode }) {
  return <div className="ck-visitas ck-visitas--lista ck-estoque ck-energia">{children}</div>;
}

export function EnergiaMobileStage({
  title,
  sub,
  kpis,
}: {
  title: string;
  sub: string;
  kpis?: ReactNode;
}) {
  return (
    <div className="ck-visitas__stage">
      <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
      <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
      <div className="ck-visitas__mesh" aria-hidden />
      <div className="ck-visitas__stage-inner">
        <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <p className="ck-visitas__mark-text">Grupo Alvim</p>
            <h1 className="ck-visitas__title">{title}</h1>
            <p className="ck-visitas__sub">{sub}</p>
          </div>
          <CkMarkLogoMenu size={78} className="ck-visitas__mark-icon" />
        </div>
        {kpis}
      </div>
    </div>
  );
}

export function EnergiaLojaHead({
  lojas,
  idLoja,
  onChangeLoja,
  podeTrocarLoja,
  lojaAtual,
  dlgLoja,
  setDlgLoja,
  onVoltar,
  lojaFixa,
}: {
  lojas: Loja[];
  idLoja: number | '';
  onChangeLoja?: (id: number) => void;
  podeTrocarLoja: boolean;
  lojaAtual: Loja | null;
  dlgLoja: boolean;
  setDlgLoja: (v: boolean | ((prev: boolean) => boolean)) => void;
  onVoltar?: () => void;
  /** Loja só leitura (detalhe de um protocolo já registrado). */
  lojaFixa?: { bk_number?: string | null; nome: string } | null;
}) {
  const wrapClass = onVoltar ? 'ck-estoque__loja ck-estoque__loja--com-voltar' : 'ck-estoque__loja';

  const seletor = podeTrocarLoja && onChangeLoja ? (
    <div className="ck-energia__loja-seletor" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button type="button" className="ck-estoque__loja-btn" onClick={() => setDlgLoja((v) => !v)}>
        <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
        <span aria-hidden>{dlgLoja ? '▴' : '▾'}</span>
      </button>
      {dlgLoja && (
        <>
          <div className="ck-estoque__dropdown-backdrop" onClick={() => setDlgLoja(false)} />
          <div className="ck-estoque__loja-dropdown">
            {lojas.map((l) => {
              const ativa = l.id_loja === idLoja;
              return (
                <button
                  key={l.id_loja}
                  type="button"
                  className={`ck-estoque__loja-item${ativa ? ' is-on' : ''}`}
                  onClick={() => {
                    onChangeLoja(l.id_loja);
                    persistirLoja(l.id_loja);
                    setDlgLoja(false);
                  }}
                >
                  {rotuloLoja(l)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  ) : (lojaFixa || lojaAtual) ? (
    <div className="ck-estoque__loja-fix" style={{ flex: 1, minWidth: 0, justifyContent: 'center' }} aria-label="Loja">
      <StorefrontOutlinedIcon className="ck-estoque__loja-fix-icon" />
      <div className="ck-estoque__loja-fix-text">
        {(lojaFixa?.bk_number || lojaAtual?.bk_number) ? (
          <small>{lojaFixa?.bk_number || lojaAtual?.bk_number}</small>
        ) : null}
        <strong>{lojaFixa?.nome || (lojaAtual ? nomeLoja(lojaAtual) : 'Loja')}</strong>
      </div>
    </div>
  ) : (
    <div className="ck-estoque__loja-fix" style={{ flex: 1, minWidth: 0, justifyContent: 'center' }} aria-label="Loja">
      <StorefrontOutlinedIcon className="ck-estoque__loja-fix-icon" />
      <div className="ck-estoque__loja-fix-text">
        <strong>Selecione a loja</strong>
      </div>
    </div>
  );

  return (
    <div
      className={wrapClass}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        marginBottom: 14,
      }}
    >
      {onVoltar ? (
        <button
          type="button"
          className="ck-estoque__voltar"
          onClick={onVoltar}
          style={{ position: 'relative', left: 'auto', top: 'auto', transform: 'none', flexShrink: 0 }}
          aria-label="Voltar"
        >
          <span aria-hidden>‹</span>
        </button>
      ) : null}
      {seletor}
    </div>
  );
}
