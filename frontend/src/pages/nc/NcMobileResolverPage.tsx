import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { NcDetalhe } from '../../api/client';
import { parseNcDescricao } from '../../components/nc/ncPageUtils';
import { getUsuario, logout, podeResolverNc } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import AppHubDock from '../../components/hub/AppHubDock';
import '../../components/estoque/estoque-hub.css';
import '../../components/nc/nc-mobile.css';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function NcMobileResolverPage() {
  const { idNc } = useParams();
  const navigate = useNavigate();
  const user = getUsuario();
  const [nc, setNc] = useState<NcDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const podeResolver = podeResolverNc();

  useEffect(() => {
    if (!idNc) return;
    api
      .ncDetalhe(Number(idNc))
      .then(setNc)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [idNc]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nc || !podeResolver) return;
    const texto = observacao.trim();
    if (texto.length < 10) {
      setErr('Descreva o que foi feito (mínimo 10 caracteres).');
      return;
    }
    if (!fotos.length) {
      setErr('Tire pelo menos uma foto da correção.');
      return;
    }

    setSalvando(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('observacao_resolucao', texto);
      fotos.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl);
        fd.append('fotos', blob, `correcao-${i}${extensaoMidia(blob)}`);
      });
      await api.ncResolver(nc.id_nc, fd);
      setConcluido(true);
      showToast('Não conformidade encerrada.', 'success');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao encerrar');
    } finally {
      setSalvando(false);
    }
  }

  const voltar = () => navigate('/nc/mobile', { replace: true });

  const shell = (titulo: string, body: ReactNode) => (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-nc-hub ck-nc-hub--resolver"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
          <div className="ck-estoque-hub__actions">
            <button
              type="button"
              className="ck-estoque-hub__icon-btn ck-nc-hub__btn-voltar"
              aria-label="Voltar"
              onClick={voltar}
            >
              <ArrowBackIcon />
            </button>
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
            <h1>{titulo}</h1>
          </div>
        </div>
      </header>
      <div className="ck-estoque-hub__scroll ck-nc-hub__scroll">{body}</div>
      <AppHubDock ativo={null} plusLabel="Sem ação nesta tela" plusDisabled onPlus={() => {}} />
    </div>
  );

  if (loading) {
    return shell(
      'Resolver NC',
      <LinearProgress
        sx={{
          my: 1.5,
          borderRadius: 1,
          backgroundColor: 'rgba(255,154,92,0.18)',
          '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
        }}
      />,
    );
  }

  if ((err && !nc) || !nc) {
    return shell('Resolver NC', <Alert severity="error">{err || 'NC não encontrada'}</Alert>);
  }

  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);
  const tituloArea = nc.area === 'Resultado geral' ? nc.descricao : texto;

  if (concluido || nc.status === 'Resolvida') {
    return shell(
      'NC encerrada',
      <div className="ck-nc-hub__done">
        <CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e' }} />
        <strong>Correção registrada</strong>
        <p>A não conformidade foi encerrada com sucesso.</p>
        <Button fullWidth className="ck-nc-hub__cta" onClick={voltar}>
          Voltar à lista
        </Button>
      </div>,
    );
  }

  return shell(
    'Resolver NC',
    <form onSubmit={enviar} className="ck-nc-hub__form">
      <div className="ck-nc-hub__kpis" aria-live="polite">
        <div className={`ck-nc-hub__kpi${nc.gravidade === 'Crítica' ? ' is-crit' : ''}`}>
          <strong className="ck-nc-hub__kpi-text">{nc.gravidade}</strong>
          <span>Gravidade</span>
        </div>
        <div className="ck-nc-hub__kpi is-on">
          <strong className="ck-nc-hub__kpi-text">
            {nc.nome_loja || nc.name || '—'}
          </strong>
          <span>Loja</span>
        </div>
      </div>

      <div className="ck-nc-hub__card">
        <p className="ck-nc-hub__meta">
          {nc.area}
          {codigo ? ` · ${codigo}` : ''}
        </p>
        <h2>{tituloArea}</h2>
        {obs ? <p className="ck-nc-hub__obs">Obs. da visita: {obs}</p> : null}
      </div>

      {!podeResolver ? (
        <Alert severity="info" className="ck-nc-hub__alert">
          Você pode visualizar, mas não tem permissão para encerrar NCs.
        </Alert>
      ) : (
        <>
          <div className="ck-nc-hub__card">
            <p className="ck-nc-hub__label">O que foi feito?</p>
            <TextField
              fullWidth
              multiline
              minRows={4}
              placeholder="Descreva a correção realizada na loja..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={salvando}
              onFocus={(e) => {
                window.setTimeout(() => {
                  e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 350);
              }}
            />
          </div>

          <div className="ck-nc-hub__card">
            <p className="ck-nc-hub__label">Foto da correção</p>
            <p className="ck-nc-hub__hint">Registre evidência do que foi corrigido.</p>
            <PhotoCaptureMulti
              fotos={fotos}
              onChange={setFotos}
              max={3}
              inlineActions
              disabled={salvando}
            />
          </div>

          {err ? (
            <Alert severity="error" className="ck-nc-hub__alert">
              {err}
            </Alert>
          ) : null}

          <div className="ck-nc-hub__acoes">
            <Button type="submit" fullWidth variant="contained" size="large" disabled={salvando} className="ck-nc-hub__cta">
              {salvando ? 'Enviando...' : 'Encerrar não conformidade'}
            </Button>
          </div>
        </>
      )}
    </form>,
  );
}
