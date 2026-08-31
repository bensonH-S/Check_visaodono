import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api, type Loja } from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile, podeAbrirEnergia } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { showToast } from '../../utils/toast';
import {
  CONCESSIONARIAS,
  TIPOS_OCORRENCIA,
  agoraDatetimeLocal,
  datetimeLocalParaIso,
  dataUrlToBlob,
} from './energiaConstants';
import { EnergiaLojaHead, EnergiaMobileChrome, EnergiaMobileStage } from './EnergiaMobileShell';
import {
  idLojaInicialStorage,
  preferenciaLojaInicial,
  persistirLoja,
  travarScrollPagina,
} from './energiaMobileLoja';

export default function EnergiaMobileNovoPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(idLojaInicialStorage);
  const [protocolo, setProtocolo] = useState('');
  const [concessionaria, setConcessionaria] = useState('Concessionária de energia');
  const [concessionariaOutra, setConcessionariaOutra] = useState('');
  const [tipo, setTipo] = useState('falta_energia');
  const [ocorrido, setOcorrido] = useState(agoraDatetimeLocal);
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [dlgLoja, setDlgLoja] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await api.lojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        const preferida = preferenciaLojaInicial(rows);
        if (!preferida) return;
        if (!idLoja || !rows.some((l) => l.id_loja === idLoja)) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        } else if (lojaTravada && preferida !== idLoja) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dlgLoja) {
      travarScrollPagina(false);
      return;
    }
    travarScrollPagina(true);
    return () => travarScrollPagina(false);
  }, [dlgLoja]);

  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;

  async function salvar() {
    setErr('');
    if (!podeAbrirEnergia(user)) {
      setErr('Sem permissão para registrar.');
      return;
    }
    if (!idLoja) {
      setErr('Selecione a loja.');
      return;
    }
    if (!protocolo.trim()) {
      setErr('Informe o protocolo da ligação.');
      return;
    }
    if (!fotos.length) {
      setErr('Tire ao menos uma foto da ocorrência.');
      return;
    }
    const nomeConcessionaria =
      concessionaria === 'Outra' ? concessionariaOutra.trim() || 'Concessionária de energia' : concessionaria;

    setSalvando(true);
    try {
      const criado = await api.energiaCriar({
        id_loja: Number(idLoja),
        protocolo: protocolo.trim(),
        concessionaria: nomeConcessionaria,
        tipo_ocorrencia: tipo,
        descricao: descricao.trim(),
        ocorrido_em: datetimeLocalParaIso(ocorrido),
      });
      const fd = new FormData();
      fotos.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      await api.energiaEnviarFotos(criado.id_chamado, fd);
      showToast('Protocolo registrado.');
      navigate(`/energia/mobile/${criado.id_chamado}`, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <EnergiaMobileChrome>
      <EnergiaMobileStage
        title="Registrar"
        sub="Anote o protocolo da ligação e anexe as fotos da ocorrência."
      />

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-estoque__sheet-head">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}
          <EnergiaLojaHead
            lojas={lojas}
            idLoja={idLoja}
            onChangeLoja={setIdLoja}
            podeTrocarLoja={podeTrocarLoja}
            lojaAtual={lojaAtual}
            dlgLoja={dlgLoja}
            setDlgLoja={setDlgLoja}
            onVoltar={() => navigate('/energia/mobile')}
          />
        </div>

        <div className="ck-visitas__sheet-body">
          {salvando && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          <div className="ck-estoque__break-form">
            <label className="ck-estoque__field">
              <span>Protocolo da ligação</span>
              <input
                type="text"
                required
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
                placeholder="Número gerado pela concessionária"
                autoComplete="off"
                disabled={salvando}
              />
            </label>

            <label className="ck-estoque__field">
              <span>Concessionária</span>
              <select
                value={concessionaria}
                onChange={(e) => setConcessionaria(e.target.value)}
                disabled={salvando}
              >
                {CONCESSIONARIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {concessionaria === 'Outra' && (
              <label className="ck-estoque__field">
                <span>Nome da concessionária</span>
                <input
                  type="text"
                  value={concessionariaOutra}
                  onChange={(e) => setConcessionariaOutra(e.target.value)}
                  placeholder="Qual concessionária"
                  autoComplete="off"
                  disabled={salvando}
                />
              </label>
            )}

            <label className="ck-estoque__field">
              <span>O que aconteceu</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={salvando}>
                {TIPOS_OCORRENCIA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ck-estoque__field">
              <span>Data e hora</span>
              <input
                type="datetime-local"
                required
                value={ocorrido}
                onChange={(e) => setOcorrido(e.target.value)}
                disabled={salvando}
              />
            </label>

            <label className="ck-estoque__field">
              <span>Detalhes (opcional)</span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: queda de energia, oscilação, equipamento queimou…"
                disabled={salvando}
              />
            </label>

            <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} obrigatoria inlineActions hideCaption />

            <button
              type="button"
              className="ck-estoque__btn ck-estoque__btn--primary ck-estoque__btn--break-cta"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Registrar protocolo'}
            </button>
          </div>
        </div>
      </div>
    </EnergiaMobileChrome>
  );
}
