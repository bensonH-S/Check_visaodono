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
    .replace(/^POPYES\s*-\s*/i, '');
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
    <Dialog open={aberto} onClose={enviando ? undefined : onFechar} fullWidth maxWidth="sm">
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
          {podeEnviar && contaram.length ? (
            <Button
              size="small"
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
                gridTemplateColumns: podeEnviar ? '28px minmax(0,1fr) auto auto' : 'minmax(0,1fr) auto auto',
                alignItems: 'center',
                gap: 0.5,
                minHeight: 36,
                px: 0.4,
                borderRadius: 1,
              }}
            >
              {podeEnviar ? (
                <Checkbox
                  size="small"
                  checked={marcada}
                  onChange={() => setSel((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]))}
                  slotProps={{ input: { 'aria-label': `Selecionar ${nomeCurto(loja.name)}` } }}
                />
              ) : null}
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
        <Button onClick={onFechar} disabled={enviando} sx={{ textTransform: 'none' }}>Fechar</Button>
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
