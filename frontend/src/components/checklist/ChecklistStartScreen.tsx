import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtData, fmtNota, scoreColorTema, type Loja, type TipoChecklist, type VisitaResumo } from '../../api/client';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, CHECKLIST_FUNDO_BK, LOGO_GA_LOCKUP } from '../../config/paths';
import { nomeLojaCurta } from '../estoque/estoqueHub';
import MobileUsuarioMenu from '../MobileUsuarioMenu';
import NotificacoesSino from '../NotificacoesSino';
import ChecklistPickSheet from './ChecklistPickSheet';
import AppHubDock from '../hub/AppHubDock';
import '../estoque/estoque-hub.css';
import './checklist-hub.css';

type Props = {
  msg: string;
  onClearMsg: () => void;
  saving: boolean;
  lojas: Loja[];
  idLoja: number | '';
  onSelecionarLoja: (id: number) => void;
  tiposChecklist: TipoChecklist[];
  onIniciar: (opts?: { codigo?: string; idLoja?: number }) => void;
  onAbrirRascunho: (idVisita: number) => void;
};

export default function ChecklistStartScreen({
  msg,
  onClearMsg,
  saving,
  lojas,
  idLoja,
  onSelecionarLoja,
  tiposChecklist,
  onIniciar,
  onAbrirRascunho,
}: Props) {
  const navigate = useNavigate();
  const user = getUsuario();
  const [pickLoja, setPickLoja] = useState(false);
  const [pickInicio, setPickInicio] = useState(false);
  const [codigoAposLoja, setCodigoAposLoja] = useState<string | null>(null);
  const podeTrocarLoja = lojas.length > 1;

  const lojaOptions = useMemo(
    () =>
      lojas.map((l) => ({
        id: l.id_loja,
        label: l.name,
        meta: l.bk_number ? `BKN ${l.bk_number}` : undefined,
      })),
    [lojas],
  );

  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  useEffect(() => {
    let vivo = true;
    api
      .visitas()
      .then((lista) => {
        if (!vivo) return;
        const ordenada = [...lista].sort((a, b) => {
          const aAberta = a.status === 'Rascunho' ? 0 : 1;
          const bAberta = b.status === 'Rascunho' ? 0 : 1;
          if (aAberta !== bAberta) return aAberta - bAberta;
          return b.id_visita - a.id_visita;
        });
        setVisitas(ordenada.slice(0, 40));
      })
      .catch(() => {
        if (vivo) setVisitas([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function abrirVisita(v: VisitaResumo) {
    if (v.status === 'Rascunho') {
      onAbrirRascunho(v.id_visita);
      return;
    }
    navigate(`/relatorio/mobile/visita/${v.id_visita}`);
  }

  function pedirTipoOuLoja() {
    if (podeTrocarLoja) {
      setCodigoAposLoja('__escolher__');
      setPickLoja(true);
      return;
    }
    setPickInicio(true);
  }

  function comecar(codigo: string, lojaId: number) {
    onIniciar({ codigo, idLoja: lojaId });
  }

  return (
    <>
      <div
        className="ck-estoque-hub ck-checklist-hub ck-checklist-hub--hero"
        style={{ ['--ck-hero' as string]: `url(${assetUrl(CHECKLIST_FUNDO_BK)})` }}
      >
        <div className="ck-estoque-hub__scroll">
          <header className="ck-estoque-hub__top">
            <div className="ck-estoque-hub__brand-row">
              <img className="ck-estoque-hub__mark" src={assetUrl(LOGO_GA_LOCKUP)} alt="Grupo Alvim" />
              <div className="ck-estoque-hub__actions">
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
            <div className="ck-estoque-hub__store-row">
              <h1>Checklist</h1>
            </div>
          </header>

          <div className="ck-checklist-hub__body">
            {msg ? (
              <div className="ck-checklist-hub__banner ck-checklist-hub__banner--err" role="alert">
                <p>{msg}</p>
                <button type="button" onClick={onClearMsg}>
                  Fechar
                </button>
              </div>
            ) : null}

            <section className="ck-checklist-hub__recente" aria-label="Visitas">
              <div className="ck-checklist-hub__recente-head">
                <h2>Visitas</h2>
                <span>{visitas.length ? visitas.length : ''}</span>
              </div>
              {visitas.length ? (
                visitas.map((v) => {
                  const aberta = v.status === 'Rascunho';
                  const titulo = nomeLojaCurta(v.name, v.bk_number);
                  const meta = `${fmtData(v.data_visita)} · ${v.tipo_checklist_nome || 'Checklist'}`;
                  const nota = v.nota_final == null ? null : Number(v.nota_final);
                  return (
                    <button
                      key={v.id_visita}
                      type="button"
                      className="ck-checklist-hub__visita"
                      onClick={() => abrirVisita(v)}
                    >
                      <span className="ck-checklist-hub__visita-copy">
                        <strong>{titulo}</strong>
                        <small>{meta}</small>
                      </span>
                      {aberta ? (
                        <span className="ck-checklist-hub__visita-side is-open">Aberta</span>
                      ) : (
                        <span
                          className="ck-checklist-hub__visita-side"
                          style={nota != null ? { color: scoreColorTema(nota, true) } : undefined}
                        >
                          {fmtNota(nota)}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="ck-checklist-hub__recente-empty">Nenhuma visita ainda. O + começa uma.</p>
              )}
            </section>
          </div>
        </div>

        <AppHubDock ativo="checklist" plusLabel="Iniciar visita" plusDisabled={saving} onPlus={pedirTipoOuLoja} />
      </div>

      <ChecklistPickSheet
        open={pickLoja}
        title="Escolher loja"
        options={lojaOptions}
        selectedId={idLoja === '' ? null : idLoja}
        onSelect={(id) => {
          const lojaId = Number(id);
          onSelecionarLoja(lojaId);
          const proximo = codigoAposLoja;
          setCodigoAposLoja(null);
          if (proximo && proximo !== '__escolher__') {
            comecar(proximo, lojaId);
            return;
          }
          if (proximo === '__escolher__') setPickInicio(true);
        }}
        onClose={() => {
          setCodigoAposLoja(null);
          setPickLoja(false);
        }}
      />
      <ChecklistPickSheet
        open={pickInicio}
        title="Iniciar visita"
        options={tiposChecklist.map((t) => ({
          id: t.codigo,
          label: t.nome,
          meta: t.descricao,
        }))}
        onSelect={(id) => {
          const codigo = String(id);
          const lojaUnica = !podeTrocarLoja ? lojas[0]?.id_loja : null;
          const lojaId = lojaUnica ?? (idLoja === '' ? null : Number(idLoja));
          if (!lojaId) {
            setCodigoAposLoja(codigo);
            setPickInicio(false);
            setPickLoja(true);
            return;
          }
          comecar(codigo, lojaId);
        }}
        onClose={() => setPickInicio(false)}
      />
    </>
  );
}
