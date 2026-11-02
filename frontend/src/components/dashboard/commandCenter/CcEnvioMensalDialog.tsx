import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { api, type EstoqueContagemRedeItem } from '../../../api/client';

function nomeCurto(nome: string) {
  return String(nome || '')
    .replace(/^BURGER KING\s*-\s*/i, '')
    .replace(/^POPEYES\s*-\s*/i, '')
    .replace(/^POPYES\s*-\s*/i, '');
}

function nomeArquivoLoja(loja: EstoqueContagemRedeItem) {
  const nome = nomeCurto(loja.name).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const bk = String(loja.bk_number || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return `${[nome, bk, 'Contagem mensal'].filter(Boolean).join(' - ')}.pdf`;
}

function baixarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  return [n & 255, (n >>> 8) & 255];
}

function u32(n: number) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
}

function juntar(partes: Uint8Array[]) {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const parte of partes) {
    out.set(parte, pos);
    pos += parte.length;
  }
  return out;
}

/** ZIP sem compressão. O PDF já é compacto e o nome de cada loja fica intacto. */
function zipPdfs(arquivos: { nome: string; dados: Uint8Array }[]) {
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const encoder = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let offset = 0;
  for (const arquivo of arquivos) {
    const nome = encoder.encode(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const local = juntar([
      new Uint8Array([
        0x50, 0x4b, 0x03, 0x04,
        ...u16(20), ...u16(0x800), ...u16(0),
        ...u16(hora), ...u16(data),
        ...u32(crc), ...u32(arquivo.dados.length), ...u32(arquivo.dados.length),
        ...u16(nome.length), ...u16(0),
      ]),
      nome,
      arquivo.dados,
    ]);
    const central = juntar([
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20), ...u16(20), ...u16(0x800), ...u16(0),
        ...u16(hora), ...u16(data),
        ...u32(crc), ...u32(arquivo.dados.length), ...u32(arquivo.dados.length),
        ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
      ]),
      nome,
    ]);
    locais.push(local);
    centrais.push(central);
    offset += local.length;
  }
  const central = juntar(centrais);
  const fim = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(arquivos.length), ...u16(arquivos.length),
    ...u32(central.length), ...u32(offset),
    ...u16(0),
  ]);
  return new Blob([juntar([...locais, central, fim]).buffer], { type: 'application/zip' });
}

export function CcEnvioMensalDialog({
  aberto,
  onFechar,
  lojas,
  podeEnviar,
  mes,
  onEnviado,
}: {
  aberto: boolean;
  onFechar: () => void;
  lojas: EstoqueContagemRedeItem[];
  podeEnviar: boolean;
  mes: string;
  onEnviado: () => void;
}) {
  const contaram = lojas.filter((loja) => loja.status === 'contou' && loja.id_contagem);
  const pendentes = lojas.filter((loja) => loja.status !== 'contou');
  const [sel, setSel] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [vendo, setVendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setAviso('');
    setSel(
      lojas
        .filter((loja) => loja.status === 'contou' && loja.id_contagem && !loja.enviado)
        .map((loja) => Number(loja.id_contagem)),
    );
  }, [aberto, lojas]);

  const idsContaram = contaram.map((loja) => Number(loja.id_contagem));
  const todasMarcadas = idsContaram.length > 0 && idsContaram.every((id) => sel.includes(id));

  const ver = async (id: number) => {
    setVendo(id);
    setAviso('');
    try {
      await api.estoqueAbrirPdfMensal(id);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível abrir a contagem');
    } finally {
      setVendo(null);
    }
  };

  const baixar = async () => {
    const escolhidas = contaram.filter((loja) => sel.includes(Number(loja.id_contagem)));
    if (!escolhidas.length || baixando) return;
    setBaixando(true);
    setAviso('');
    const falhas: string[] = [];
    const arquivos: { nome: string; dados: Uint8Array }[] = [];
    for (let i = 0; i < escolhidas.length; i += 1) {
      const loja = escolhidas[i];
      setAviso(`Preparando ${i + 1} de ${escolhidas.length}…`);
      try {
        const blob = await api.estoquePdfMensal(Number(loja.id_contagem));
        arquivos.push({ nome: nomeArquivoLoja(loja), dados: new Uint8Array(await blob.arrayBuffer()) });
      } catch (e) {
        falhas.push(`${nomeCurto(loja.name)}: ${e instanceof Error ? e.message : 'falhou'}`);
      }
    }
    if (arquivos.length === 1) {
      baixarBlob(new Blob([arquivos[0].dados.buffer], { type: 'application/pdf' }), arquivos[0].nome);
    } else if (arquivos.length > 1) {
      baixarBlob(zipPdfs(arquivos), 'Contagem mensal.zip');
    }
    setAviso(
      falhas.length
        ? `Baixou ${arquivos.length} de ${escolhidas.length}. ${falhas[0]}`
        : arquivos.length === 1
          ? 'PDF baixado.'
          : `${arquivos.length} PDFs no arquivo Contagem mensal.zip.`,
    );
    setBaixando(false);
  };

  const enviar = async () => {
    if (!sel.length || enviando) return;
    setEnviando(true);
    setAviso('');
    try {
      const resp = await api.estoqueEnviarRelatoriosMensais(mes, sel);
      const falha = resp.falhas?.length ? ` ${resp.falhas.length} falha(s).` : '';
      setAviso(
        resp.enviados
          ? `${resp.enviados} relatório(s) enviado(s).${falha}`
          : `Nenhum relatório enviado.${falha}`,
      );
      onEnviado();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={enviando || baixando ? undefined : onFechar} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 3, pb: 0.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Contagem mensal</Typography>
        <Typography sx={{ mt: 0.35, fontSize: 12.5, color: 'text.secondary', fontWeight: 500 }}>
          {contaram.length} contaram · {pendentes.length} ainda não. Abra o PDF e marque quem recebe o relatório.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 1.5, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'text.secondary' }}>
            QUEM CONTOU
          </Typography>
          {contaram.length ? (
            <Button
              size="small"
              disabled={enviando || baixando}
              onClick={() => setSel(todasMarcadas ? [] : idsContaram)}
              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, minWidth: 0 }}
            >
              {todasMarcadas ? 'Limpar' : 'Marcar todas'}
            </Button>
          ) : null}
        </Box>
        {contaram.length ? contaram.map((loja) => {
          const id = Number(loja.id_contagem);
          const marcada = sel.includes(id);
          return (
            <Box
              key={loja.id_loja}
              sx={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0,1fr) auto auto',
                alignItems: 'center',
                gap: 0.5,
                minHeight: 36,
                px: 0.4,
                borderRadius: 1,
              }}
            >
              <Checkbox
                size="small"
                checked={marcada}
                disabled={enviando || baixando}
                onChange={() => setSel((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))}
                slotProps={{ input: { 'aria-label': `Selecionar ${nomeCurto(loja.name)}` } }}
              />
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>
                {nomeCurto(loja.name)}
              </Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: loja.enviado ? '#15803D' : '#B45309' }}>
                {loja.enviado ? 'enviado' : 'não enviado'}
              </Typography>
              <Button
                size="small"
                disabled={vendo === id}
                onClick={() => void ver(id)}
                sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, minWidth: 0 }}
              >
                {vendo === id ? 'Abrindo…' : 'Ver'}
              </Button>
            </Box>
          );
        }) : (
          <Typography sx={{ px: 0.5, py: 1, fontSize: 12.5, color: 'text.secondary' }}>
            Nenhuma loja fechou a contagem mensal ainda.
          </Typography>
        )}
        {pendentes.length ? (
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ mb: 0.4, fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'text.secondary' }}>
              AINDA NÃO CONTARAM
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {pendentes.map((loja) => (
                <Typography
                  key={loja.id_loja}
                  sx={{
                    px: 0.8,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#B91C1C',
                    bgcolor: 'rgba(220,38,38,.06)',
                  }}
                >
                  {nomeCurto(loja.name)}
                </Typography>
              ))}
            </Box>
          </Box>
        ) : null}
        {aviso ? (
          <Typography sx={{ mt: 1.25, fontSize: 12.5, fontWeight: 700 }}>{aviso}</Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.25 }}>
        <Button onClick={onFechar} disabled={enviando || baixando} sx={{ textTransform: 'none' }}>Fechar</Button>
        <Button
          variant="outlined"
          disabled={!sel.length || enviando || baixando}
          onClick={() => void baixar()}
          sx={{ textTransform: 'none', fontWeight: 800 }}
        >
          {baixando ? 'Baixando…' : `Baixar ${sel.length} selecionada${sel.length === 1 ? '' : 's'}`}
        </Button>
        {podeEnviar ? (
          <Button
            variant="contained"
            disabled={!sel.length || enviando}
            onClick={() => void enviar()}
            sx={{ textTransform: 'none', fontWeight: 800 }}
          >
            {enviando ? 'Enviando…' : `Enviar ${sel.length} selecionada${sel.length === 1 ? '' : 's'}`}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
