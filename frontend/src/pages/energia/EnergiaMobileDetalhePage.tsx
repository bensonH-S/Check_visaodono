import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import ChamadoAnexosGaleria from '../../components/manutencao/ChamadoAnexosGaleria';
import { api, type EnergiaChamadoDetalhe, type ManutAnexo } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { formatDataHoraBalaoMapa } from '../../utils/dateBr';
import { extensaoMidia } from '../../utils/mediaFile';
import { gerarPdfEnergia } from '../../utils/gerarPdfEnergia';
import { showToast } from '../../utils/toast';
import {
  STATUS_ABERTOS,
  rotuloStatusEnergia,
  rotuloTipoOcorrencia,
  type EnergiaStatus,
  dataUrlToBlob,
} from './energiaConstants';
import { EnergiaLojaHead, EnergiaMobileChrome, EnergiaMobileStage } from './EnergiaMobileShell';

function classeStatus(status: string) {
  if (status === 'finalizado') return 'is-ok';
  if (status === 'em_andamento') return 'is-andamento';
  if (status === 'cancelado') return 'is-cancelado';
  return 'is-aberta';
}

export default function EnergiaMobileDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const podeAbrir = podeAbrirEnergia(getUsuario());
  const [item, setItem] = useState<EnergiaChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fotosNovas, setFotosNovas] = useState<string[]>([]);
  const [observacaoFinal, setObservacaoFinal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = Number(idChamado);
    if (!id) return;
    api
      .energiaDetalhe(id)
      .then(setItem)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [idChamado]);

  const aberto = item ? STATUS_ABERTOS.has(item.status as EnergiaStatus) : false;

  async function mudarStatus(status: 'aberto' | 'em_andamento') {
    if (!item) return;
    setBusy(true);
    try {
      setItem(await api.energiaAtualizar(item.id_chamado, { status }));
      showToast('Status atualizado.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setBusy(false);
    }
  }

  async function enviarFotos() {
    if (!item || !fotosNovas.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fotosNovas.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      setItem(await api.energiaEnviarFotos(item.id_chamado, fd));
      setFotosNovas([]);
      showToast('Fotos anexadas.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar fotos');
    } finally {
      setBusy(false);
    }
  }

  async function finalizar() {
    if (!item) return;
    setBusy(true);
    try {
      const atualizado = await api.energiaFinalizar(item.id_chamado, {
        observacao_final: observacaoFinal.trim(),
      });
      setItem(atualizado);
      showToast('Finalizado. Gerando relatório…');
      await gerarPdfEnergia(atualizado);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao finalizar');
    } finally {
      setBusy(false);
    }
  }

  async function baixarPdf() {
    if (!item) return;
    setBusy(true);
    try {
      await gerarPdfEnergia(await api.energiaDetalhe(item.id_chamado));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar PDF');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <EnergiaMobileChrome>
        <LinearProgress />
      </EnergiaMobileChrome>
    );
  }

  if (!item) {
    return (
      <EnergiaMobileChrome>
        <EnergiaMobileStage title="Energia" sub="Protocolo não encontrado." />
        <div className="ck-visitas__sheet">
          <div className="ck-estoque__sheet-head">
            <EnergiaLojaHead
              lojas={[]}
              idLoja=""
              podeTrocarLoja={false}
              lojaAtual={null}
              dlgLoja={false}
              setDlgLoja={() => undefined}
              onVoltar={() => navigate('/energia/mobile')}
            />
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem' }}>
              {err || 'Não encontrado.'}
            </p>
          </div>
        </div>
      </EnergiaMobileChrome>
    );
  }

  return (
    <EnergiaMobileChrome>
      <EnergiaMobileStage
        title="Energia"
        sub={`Protocolo ${item.protocolo} · ${rotuloTipoOcorrencia(item.tipo_ocorrencia)}`}
        kpis={
          <div
            className="ck-estoque__kpis ck-estoque__kpis--2 ck-visitas__anim ck-visitas__anim--3"
            aria-live="polite"
          >
            <div className="ck-estoque__kpi ck-estoque__kpi--accent">
              <strong>#{item.numero}</strong>
              <span>Chamado</span>
            </div>
            <div className="ck-estoque__kpi">
              <strong>{item.anexos.length}</strong>
              <span>{item.anexos.length === 1 ? 'foto' : 'fotos'}</span>
            </div>
          </div>
        }
      />

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-estoque__sheet-head">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}
          <EnergiaLojaHead
            lojas={[]}
            idLoja={item.id_loja}
            podeTrocarLoja={false}
            lojaAtual={null}
            dlgLoja={false}
            setDlgLoja={() => undefined}
            onVoltar={() => navigate('/energia/mobile')}
            lojaFixa={{ bk_number: item.bk_number, nome: item.nome_loja }}
          />
        </div>

        <div className="ck-visitas__sheet-body">
          {busy && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          <div className="ck-estoque__card ck-estoque__card--lista ck-estoque__card--static">
            <div className="ck-estoque__card-top">
              <div className="ck-estoque__card-title">
                <strong>Protocolo {item.protocolo}</strong>
                <span className="ck-estoque__card-tipo">{item.concessionaria}</span>
              </div>
              <span className={`ck-estoque__status ${classeStatus(item.status)}`}>
                {rotuloStatusEnergia(item.status)}
              </span>
            </div>
            <dl className="ck-energia__dl" style={{ marginTop: 14 }}>
              <div>
                <dt>Tipo</dt>
                <dd>{rotuloTipoOcorrencia(item.tipo_ocorrencia)}</dd>
              </div>
              <div>
                <dt>Quando</dt>
                <dd>{formatDataHoraBalaoMapa(item.ocorrido_em)}</dd>
              </div>
              <div>
                <dt>Registrado por</dt>
                <dd>{item.nome_abriu}</dd>
              </div>
              {item.descricao ? (
                <div>
                  <dt>Detalhes</dt>
                  <dd>{item.descricao}</dd>
                </div>
              ) : null}
              {item.status === 'finalizado' ? (
                <>
                  <div>
                    <dt>Finalizado</dt>
                    <dd>{formatDataHoraBalaoMapa(item.finalizado_em)}</dd>
                  </div>
                  {item.observacao_final ? (
                    <div>
                      <dt>Encerramento</dt>
                      <dd>{item.observacao_final}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </div>

          <ChamadoAnexosGaleria
            anexos={item.anexos as ManutAnexo[]}
            emptyText="Nenhuma foto ainda."
            tamanhoMiniatura={72}
          />

          {podeAbrir && aberto && (
            <div className="ck-estoque__break-form">
              <label className="ck-estoque__field">
                <span>Status</span>
                <select
                  value={item.status}
                  onChange={(e) => void mudarStatus(e.target.value as 'aberto' | 'em_andamento')}
                  disabled={busy}
                >
                  <option value="aberto">Aberto</option>
                  <option value="em_andamento">Em andamento</option>
                </select>
              </label>

              <PhotoCaptureMulti
                fotos={fotosNovas}
                onChange={setFotosNovas}
                max={10}
                inlineActions
                compactThumbs
                hideCaption
              />

              <div className="ck-energia__acoes">
                {fotosNovas.length > 0 && (
                  <button
                    type="button"
                    className="ck-estoque__btn ck-estoque__btn--ghost"
                    onClick={() => void enviarFotos()}
                    disabled={busy}
                  >
                    Anexar fotos
                  </button>
                )}

                <label className="ck-estoque__field">
                  <span>Observação ao finalizar (opcional)</span>
                  <textarea
                    value={observacaoFinal}
                    onChange={(e) => setObservacaoFinal(e.target.value)}
                    disabled={busy}
                  />
                </label>

                <button
                  type="button"
                  className="ck-estoque__btn ck-estoque__btn--ok ck-estoque__btn--break-cta"
                  disabled={busy || !item.anexos.length}
                  onClick={() => void finalizar()}
                >
                  Finalizar e gerar relatório
                </button>
              </div>
            </div>
          )}

          {item.status === 'finalizado' && (
            <div className="ck-energia__acoes">
              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--primary ck-estoque__btn--break-cta"
                disabled={busy}
                onClick={() => void baixarPdf()}
              >
                Baixar relatório PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </EnergiaMobileChrome>
  );
}
