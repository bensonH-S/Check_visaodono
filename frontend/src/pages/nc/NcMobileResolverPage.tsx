import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { assetUrl } from '../../config/paths';
import { api } from '../../api/client';
import type { NcDetalhe } from '../../api/client';
import { parseNcDescricao } from '../../components/nc/ncPageUtils';
import { podeResolverNc } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
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

  if (loading) {
    return (
      <div className="ck-visitas ck-nc ck-nc--page">
        <div className="ck-visitas__scroll">
          <div className="ck-visitas__stage">
            <div className="ck-visitas__stage-inner">
              <div className="ck-visitas__toolbar">
                <button type="button" className="ck-visitas__back" aria-label="Voltar" onClick={voltar}>
                  ←
                </button>
                <span />
              </div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Resolver
                <br />
                NC
              </h1>
              <p className="ck-visitas__sub">Carregando…</p>
            </div>
          </div>
          <div className="ck-visitas__sheet">
            <LinearProgress />
          </div>
        </div>
      </div>
    );
  }

  if ((err && !nc) || !nc) {
    return (
      <div className="ck-visitas ck-nc ck-nc--page">
        <div className="ck-visitas__scroll">
          <div className="ck-visitas__stage">
            <div className="ck-visitas__stage-inner">
              <div className="ck-visitas__toolbar">
                <button type="button" className="ck-visitas__back" aria-label="Voltar" onClick={voltar}>
                  ←
                </button>
                <span />
              </div>
              <h1 className="ck-visitas__title">
                Resolver
                <br />
                NC
              </h1>
            </div>
          </div>
          <div className="ck-visitas__sheet">
            <Alert severity="error">{err || 'NC não encontrada'}</Alert>
          </div>
        </div>
      </div>
    );
  }

  const { codigo, texto, obs } = parseNcDescricao(nc.descricao);
  const tituloArea = nc.area === 'Resultado geral' ? nc.descricao : texto;

  if (concluido || nc.status === 'Resolvida') {
    return (
      <div className="ck-visitas ck-nc ck-nc--page">
        <div className="ck-visitas__scroll">
          <div className="ck-visitas__stage">
            <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
            <div className="ck-visitas__mesh" aria-hidden />
            <div className="ck-visitas__stage-inner">
              <div className="ck-visitas__toolbar">
                <button type="button" className="ck-visitas__back" aria-label="Voltar" onClick={voltar}>
                  ←
                </button>
                <span />
              </div>
              <div className="ck-visitas__hero-row">
                <div>
                  <p className="ck-visitas__mark-text">Grupo Alvim</p>
                  <h1 className="ck-visitas__title">
                    NC
                    <br />
                    encerrada
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
              <p className="ck-visitas__sub">{nc.nome_loja || nc.name}</p>
            </div>
          </div>
          <div className="ck-visitas__sheet">
            <div className="ck-nc__done">
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
              <strong>Correção registrada</strong>
              <p>A não conformidade foi encerrada com sucesso.</p>
              <Button fullWidth className="ck-nc__cta" onClick={voltar}>
                Voltar à lista
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-visitas ck-nc ck-nc--page">
      <div className="ck-visitas__scroll">
        <div className="ck-visitas__stage">
          <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
          <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
          <div className="ck-visitas__mesh" aria-hidden />

          <div className="ck-visitas__stage-inner">
            <div className="ck-visitas__toolbar ck-visitas__anim ck-visitas__anim--1">
              <button type="button" className="ck-visitas__back" aria-label="Voltar" onClick={voltar}>
                ←
              </button>
              <span />
            </div>

            <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--2">
              <div>
                <p className="ck-visitas__mark-text">Grupo Alvim</p>
                <h1 className="ck-visitas__title">
                  Resolver
                  <br />
                  NC
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

            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--3">
              Descreva a correção e anexe a evidência fotográfica.
            </p>

            <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3">
              <div
                className={`ck-visitas__metric${nc.gravidade === 'Crítica' ? ' ck-visitas__metric--accent' : ''}`}
              >
                <strong style={{ fontSize: '0.85rem' }}>{nc.gravidade}</strong>
                <span>gravidade</span>
              </div>
              <div className="ck-visitas__metric">
                <strong style={{ fontSize: '0.75rem', lineHeight: 1.15 }}>
                  {(nc.nome_loja || nc.name || '—').slice(0, 14)}
                </strong>
                <span>loja</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
          <form onSubmit={enviar}>
            <div className="ck-nc__form-card">
              <p className="ck-nc__meta">
                {nc.area}
                {codigo ? ` · ${codigo}` : ''}
              </p>
              <h2>{tituloArea}</h2>
              {obs && (
                <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'rgba(20,32,72,0.55)' }}>
                  Obs. da visita: {obs}
                </p>
              )}
            </div>

            {!podeResolver ? (
              <Alert severity="info">Você pode visualizar, mas não tem permissão para encerrar NCs.</Alert>
            ) : (
              <>
                <div className="ck-nc__form-card">
                  <p style={{ margin: '0 0 10px', fontWeight: 800, color: '#142048', fontSize: '0.9rem' }}>
                    O que foi feito?
                  </p>
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

                <div className="ck-nc__form-card">
                  <p style={{ margin: '0 0 4px', fontWeight: 800, color: '#142048', fontSize: '0.9rem' }}>
                    Foto da correção
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'rgba(20,32,72,0.5)' }}>
                    Registre evidência do que foi corrigido.
                  </p>
                  <PhotoCaptureMulti
                    fotos={fotos}
                    onChange={setFotos}
                    max={3}
                    inlineActions
                    disabled={salvando}
                  />
                </div>

                {err && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {err}
                  </Alert>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={salvando}
                  className="ck-nc__cta"
                >
                  {salvando ? 'Enviando...' : 'Encerrar não conformidade'}
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
