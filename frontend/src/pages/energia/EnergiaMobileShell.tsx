import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import AppHubDock from '../../components/hub/AppHubDock';
import type { Loja } from '../../api/client';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';
import { nomeLoja, persistirLoja, rotuloLoja } from './energiaMobileLoja';
import '../../components/estoque/estoque-hub.css';
import '../../components/energia/energia-mobile.css';

export function EnergiaMobileChrome({
  children,
  plusLabel = 'Registrar protocolo',
  plusDisabled,
  onPlus,
}: {
  children: ReactNode;
  plusLabel?: string;
  plusDisabled?: boolean;
  onPlus?: () => void;
}) {
  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-energia-hub"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      {children}
      <AppHubDock
        ativo={null}
        plusLabel={plusLabel}
        plusDisabled={plusDisabled || !onPlus}
        onPlus={onPlus ?? (() => {})}
      />
    </div>
  );
}

export function EnergiaMobileStage({
  title,
  sub,
  onBack,
  tabs,
  kpis,
}: {
  title: string;
  sub: string;
  onBack?: () => void;
  tabs?: ReactNode;
  kpis?: ReactNode;
}) {
  const navigate = useNavigate();
  const user = getUsuario();

  return (
    <>
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
          <div className="ck-estoque-hub__actions">
            {onBack ? (
              <button
                type="button"
                className="ck-estoque-hub__icon-btn ck-energia-hub__btn-voltar"
                aria-label="Voltar"
                onClick={onBack}
              >
                <ArrowBackIcon />
              </button>
            ) : null}
            <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
            <MobileUsuarioMenu
              user={user}
              onLogout={() => {
                logout();
                navigate('/login/mobile');
              }}
            />
          </div>
        </div>

        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>{title}</h1>
          </div>
          <p className="ck-energia-hub__sub">{sub}</p>
        </div>

        {tabs}
      </header>

      {kpis ? <div className="ck-estoque-hub__panel">{kpis}</div> : null}
    </>
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
  lojaFixa?: { bk_number?: string | null; nome: string } | null;
}) {
  const seletor =
    podeTrocarLoja && onChangeLoja ? (
      <div className="ck-energia-hub__loja-seletor">
        <button type="button" className="ck-energia-hub__loja-btn" onClick={() => setDlgLoja((v) => !v)}>
          <span className="ck-energia-hub__loja-btn-main">
            {lojaAtual ? (
              <img className="ck-energia-hub__loja-ico" src={iconeMarcaLojaPorNome(lojaAtual)} alt="" />
            ) : (
              <StorefrontOutlinedIcon className="ck-energia-hub__loja-ico-fallback" fontSize="small" />
            )}
            <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
          </span>
          <ExpandMoreIcon
            className={`ck-energia-hub__loja-chev${dlgLoja ? ' is-open' : ''}`}
            fontSize="small"
          />
        </button>
        {dlgLoja ? (
          <>
            <div className="ck-energia-hub__dropdown-backdrop" onClick={() => setDlgLoja(false)} />
            <div className="ck-energia-hub__loja-dropdown">
              {lojas.map((l) => {
                const ativa = l.id_loja === idLoja;
                return (
                  <button
                    key={l.id_loja}
                    type="button"
                    className={`ck-energia-hub__loja-item${ativa ? ' is-on' : ''}`}
                    onClick={() => {
                      onChangeLoja(l.id_loja);
                      persistirLoja(l.id_loja);
                      setDlgLoja(false);
                    }}
                  >
                    <img className="ck-energia-hub__loja-ico" src={iconeMarcaLojaPorNome(l)} alt="" />
                    <span>{rotuloLoja(l)}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    ) : lojaFixa || lojaAtual ? (
      <div className="ck-energia-hub__loja-fix" aria-label="Loja">
        {lojaAtual || lojaFixa ? (
          <img
            className="ck-energia-hub__loja-ico"
            src={iconeMarcaLojaPorNome(lojaAtual || { name: lojaFixa?.nome || '' })}
            alt=""
          />
        ) : (
          <StorefrontOutlinedIcon fontSize="small" />
        )}
        <div>
          {lojaFixa?.bk_number || lojaAtual?.bk_number ? (
            <small>{lojaFixa?.bk_number || lojaAtual?.bk_number}</small>
          ) : null}
          <strong>{lojaFixa?.nome || (lojaAtual ? nomeLoja(lojaAtual) : 'Loja')}</strong>
        </div>
      </div>
    ) : (
      <div className="ck-energia-hub__loja-fix" aria-label="Loja">
        <StorefrontOutlinedIcon fontSize="small" />
        <div>
          <strong>Selecione a loja</strong>
        </div>
      </div>
    );

  return (
    <div className={`ck-energia-hub__loja${onVoltar ? ' has-back' : ''}`}>
      {onVoltar ? (
        <button type="button" className="ck-energia-hub__loja-voltar" onClick={onVoltar} aria-label="Voltar">
          ‹
        </button>
      ) : null}
      {seletor}
    </div>
  );
}
