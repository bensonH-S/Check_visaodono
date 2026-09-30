import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import { labelFixo, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';
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
  const [concessionaria, setConcessionaria] = useState('');
  const [concessionariaOutra, setConcessionariaOutra] = useState('');
  const [tipo, setTipo] = useState('');
  const [ocorrido] = useState(agoraDatetimeLocal);
  const [dataOcorrido, setDataOcorrido] = useState(() => ocorrido.slice(0, 10));
  const [horaOcorrido, setHoraOcorrido] = useState(() => ocorrido.slice(11, 16));
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

  const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaOcorrido);
  const formPronto =
    Boolean(idLoja) &&
    protocolo.trim().length > 0 &&
    Boolean(concessionaria) &&
    (concessionaria !== 'Outra' || concessionariaOutra.trim().length > 0) &&
    Boolean(tipo) &&
    Boolean(dataOcorrido) &&
    horaOk &&
    fotos.length > 0;

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
    if (!concessionaria) {
      setErr('Selecione a concessionária de energia.');
      return;
    }
    if (concessionaria === 'Outra' && !concessionariaOutra.trim()) {
      setErr('Informe o nome da concessionária.');
      return;
    }
    if (!tipo) {
      setErr('Selecione o que aconteceu.');
      return;
    }
    if (!fotos.length) {
      setErr('Tire ao menos uma foto da ocorrência.');
      return;
    }
    const nomeConcessionaria =
      concessionaria === 'Outra' ? concessionariaOutra.trim() : concessionaria;

    setSalvando(true);
    try {
      const criado = await api.energiaCriar({
        id_loja: Number(idLoja),
        protocolo: protocolo.trim(),
        concessionaria: nomeConcessionaria,
        tipo_ocorrencia: tipo,
        descricao: descricao.trim(),
        ocorrido_em: datetimeLocalParaIso(`${dataOcorrido}T${horaOcorrido}`),
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
    <EnergiaMobileChrome plusDisabled>
      <EnergiaMobileStage
        title="Registrar"
        sub="Anote o protocolo da ligação e anexe as fotos da ocorrência."
        onBack={() => navigate('/energia/mobile')}
      />

      <div className="ck-estoque-hub__scroll ck-energia-hub__scroll">
          {err ? <p className="ck-energia-hub__err">{err}</p> : null}
          <EnergiaLojaHead
            lojas={lojas}
            idLoja={idLoja}
            onChangeLoja={setIdLoja}
            podeTrocarLoja={podeTrocarLoja}
            lojaAtual={lojaAtual}
            dlgLoja={dlgLoja}
            setDlgLoja={setDlgLoja}
          />

          {salvando ? (
            <LinearProgress
              sx={{
                my: 1.5,
                borderRadius: 1,
                backgroundColor: 'rgba(255,154,92,0.18)',
                '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
              }}
            />
          ) : null}

          <Box className="ck-energia-hub__form" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField
              fullWidth
              required
              label="Protocolo da ligação"
              placeholder="Número gerado pela concessionária"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              disabled={salvando}
              autoComplete="off"
              sx={campoAlturaFrotaSx}
              slotProps={{ inputLabel: labelFixo.inputLabel }}
            />

            <TextField
              fullWidth
              select
              required
              label="Concessionária"
              value={concessionaria}
              onChange={(e) => setConcessionaria(e.target.value)}
              disabled={salvando}
              sx={campoAlturaFrotaSx}
              slotProps={{
                inputLabel: labelFixo.inputLabel,
                select: {
                  displayEmpty: true,
                  renderValue: (selected: unknown) => {
                    const v = String(selected ?? '');
                    if (!v) {
                      return (
                        <span className="ck-energia-hub__select-ph">Selecione a concessionária de energia</span>
                      );
                    }
                    return CONCESSIONARIAS.find((c) => c.value === v)?.label ?? v;
                  },
                  MenuProps: {
                    slotProps: {
                      paper: {
                        className: 'ck-energia-hub__menu',
                        sx: {
                          maxHeight: 280,
                          overflowY: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          bgcolor: '#1a222c',
                          color: '#f5f5f5',
                          backgroundImage: 'none',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                        },
                      },
                    },
                  },
                },
              }}
            >
              {CONCESSIONARIAS.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>

            {concessionaria === 'Outra' && (
              <TextField
                fullWidth
                required
                label="Nome da concessionária"
                placeholder="Qual concessionária"
                value={concessionariaOutra}
                onChange={(e) => setConcessionariaOutra(e.target.value)}
                disabled={salvando}
                autoComplete="off"
                sx={campoAlturaFrotaSx}
                slotProps={{ inputLabel: labelFixo.inputLabel }}
              />
            )}

            <TextField
              fullWidth
              select
              required
              label="O que aconteceu"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={salvando}
              sx={campoAlturaFrotaSx}
              slotProps={{
                inputLabel: labelFixo.inputLabel,
                select: {
                  displayEmpty: true,
                  renderValue: (selected: unknown) => {
                    const v = String(selected ?? '');
                    if (!v) {
                      return <span className="ck-energia-hub__select-ph">Selecione o que aconteceu</span>;
                    }
                    return TIPOS_OCORRENCIA.find((t) => t.value === v)?.label ?? v;
                  },
                  MenuProps: {
                    slotProps: {
                      paper: {
                        className: 'ck-energia-hub__menu',
                        sx: {
                          maxHeight: 280,
                          overflowY: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          bgcolor: '#1a222c',
                          color: '#f5f5f5',
                          backgroundImage: 'none',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                        },
                      },
                    },
                  },
                },
              }}
            >
              {TIPOS_OCORRENCIA.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 1.5 }}>
              <CampoDataFrota
                label="Data"
                value={dataOcorrido}
                onChange={setDataOcorrido}
                max={dataHojeIso()}
                disabled={salvando}
                sx={campoAlturaFrotaSx}
              />
              <TextField
                fullWidth
                type="text"
                inputMode="numeric"
                label="Hora"
                placeholder="14:30"
                value={horaOcorrido}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                  if (raw.length <= 2) {
                    setHoraOcorrido(raw);
                  } else {
                    setHoraOcorrido(`${raw.slice(0, 2)}:${raw.slice(2)}`);
                  }
                }}
                disabled={salvando}
                sx={campoAlturaFrotaSx}
                slotProps={{
                  inputLabel: labelFixo.inputLabel,
                  htmlInput: {
                    maxLength: 5,
                  },
                }}
              />
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Detalhes (opcional)"
              placeholder="Ex.: queda de energia, oscilação, equipamento queimou…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={salvando}
              slotProps={{ inputLabel: labelFixo.inputLabel }}
            />

            <div className="ck-energia-hub__fotos">
              <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} obrigatoria inlineActions hideCaption />
            </div>

            <button
              type="button"
              className="ck-energia-hub__cta"
              onClick={() => void salvar()}
              disabled={salvando || !formPronto}
            >
              {salvando ? 'Salvando…' : 'Registrar protocolo'}
            </button>
          </Box>
      </div>
    </EnergiaMobileChrome>
  );
}
