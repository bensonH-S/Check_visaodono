import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { api, type EmailRelatorioConfig, type EmailRelatorioTipo } from '../../api/client';
import { configPageSx, finBtnContainedSx, finPaperSx } from './configPageSx';

const ROTULOS: Record<EmailRelatorioTipo, { titulo: string; texto: string }> = {
  escala: {
    titulo: 'Escala dos gestores',
    texto: 'Sai quando a escala da semana é enviada.',
  },
  estoque: {
    titulo: 'Contagem de estoque',
    texto: 'Sai no envio do relatório mensal da loja.',
  },
  visita: {
    titulo: 'Relatório de visita',
    texto: 'O gerente da loja recebe no Para. Os demais vão na cópia.',
  },
};

const VAZIO: EmailRelatorioConfig[] = [];

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

export default function EmailRelatoriosPage() {
  const [tipos, setTipos] = useState<EmailRelatorioConfig[]>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState<EmailRelatorioTipo | null>(null);
  const [aviso, setAviso] = useState('');
  const [rascunho, setRascunho] = useState<Record<EmailRelatorioTipo, { email: string; nome: string }>>({
    escala: { email: '', nome: '' },
    estoque: { email: '', nome: '' },
    visita: { email: '', nome: '' },
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await api.emailRelatoriosObter();
      setTipos(data.tipos || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atualizar = (tipo: EmailRelatorioTipo, patch: Partial<EmailRelatorioConfig>) => {
    setTipos((atual) => atual.map((item) => (item.tipo === tipo ? { ...item, ...patch } : item)));
  };

  const adicionar = (tipo: EmailRelatorioTipo) => {
    const email = rascunho[tipo].email.trim().toLowerCase();
    const nome = rascunho[tipo].nome.trim();
    if (!emailValido(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    const bloco = tipos.find((item) => item.tipo === tipo);
    if (bloco?.destinatarios.some((d) => d.email === email)) {
      setErro('Esse e-mail já está na lista.');
      return;
    }
    setErro('');
    atualizar(tipo, {
      destinatarios: [...(bloco?.destinatarios || []), { email, nome, ativo: true }],
    });
    setRascunho((atual) => ({ ...atual, [tipo]: { email: '', nome: '' } }));
  };

  const salvar = async (bloco: EmailRelatorioConfig) => {
    setSalvando(bloco.tipo);
    setErro('');
    setAviso('');
    try {
      const salvo = await api.emailRelatorioSalvar(bloco.tipo, bloco);
      setTipos((atual) => atual.map((item) => (item.tipo === bloco.tipo ? salvo : item)));
      setAviso(`${ROTULOS[bloco.tipo].titulo} salvo.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Box sx={configPageSx}>
      <Box sx={{ flexShrink: 0 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Quem recebe e-mail</Typography>
        <Typography sx={{ mt: 0.3, fontSize: 13, color: 'text.secondary' }}>
          A lista fixa recebe sempre. Gerente, regional e cargo entram só quando o interruptor está ligado.
        </Typography>
        {erro ? <Typography sx={{ mt: 0.8, fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{erro}</Typography> : null}
        {aviso ? <Typography sx={{ mt: 0.8, fontSize: 13, fontWeight: 700, color: '#15803D' }}>{aviso}</Typography> : null}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25, pb: 1 }}>
        {loading ? <CircularProgress size={22} /> : null}
        {tipos.map((bloco) => (
          <Paper key={bloco.tipo} elevation={0} sx={{ ...finPaperSx, p: 1.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{ROTULOS[bloco.tipo].titulo}</Typography>
            <Typography sx={{ mt: 0.2, mb: 1, fontSize: 12.5, color: 'text.secondary' }}>{ROTULOS[bloco.tipo].texto}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {([
                ['incluir_gerente', 'Gerente da loja'],
                ['incluir_regional', 'Regional da região'],
                ['incluir_cargo_ti', 'Cargo TI'],
                ['incluir_cargo_diretor', 'Cargo diretor'],
                ['incluir_cargo_ceo', 'Cargo CEO'],
              ] as const).map(([chave, label]) => (
                <FormControlLabel
                  key={chave}
                  control={
                    <Switch
                      size="small"
                      checked={Boolean(bloco[chave])}
                      onChange={(_, ligado) => atualizar(bloco.tipo, { [chave]: ligado })}
                    />
                  }
                  label={<Typography sx={{ fontSize: 12.5 }}>{label}</Typography>}
                />
              ))}
            </Box>
            {bloco.destinatarios.map((pessoa) => (
              <Box
                key={pessoa.email}
                sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto auto', gap: 1, alignItems: 'center', mb: 0.6 }}
              >
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{pessoa.email}</Typography>
                <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{pessoa.nome || '—'}</Typography>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={pessoa.ativo}
                      onChange={(_, ligado) => atualizar(bloco.tipo, {
                        destinatarios: bloco.destinatarios.map((item) => (
                          item.email === pessoa.email ? { ...item, ativo: ligado } : item
                        )),
                      })}
                    />
                  }
                  label={<Typography sx={{ fontSize: 11 }}>{pessoa.ativo ? 'recebe' : 'pausado'}</Typography>}
                />
                <IconButton
                  size="small"
                  aria-label={`Remover ${pessoa.email}`}
                  onClick={() => atualizar(bloco.tipo, {
                    destinatarios: bloco.destinatarios.filter((item) => item.email !== pessoa.email),
                  })}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr auto' }, gap: 1, mt: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label="E-mail"
                value={rascunho[bloco.tipo].email}
                onChange={(e) => setRascunho((atual) => ({ ...atual, [bloco.tipo]: { ...atual[bloco.tipo], email: e.target.value } }))}
              />
              <TextField
                size="small"
                label="Nome"
                value={rascunho[bloco.tipo].nome}
                onChange={(e) => setRascunho((atual) => ({ ...atual, [bloco.tipo]: { ...atual[bloco.tipo], nome: e.target.value } }))}
              />
              <Button onClick={() => adicionar(bloco.tipo)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                Adicionar
              </Button>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
              <Button
                variant="contained"
                disabled={salvando === bloco.tipo}
                onClick={() => void salvar(bloco)}
                sx={finBtnContainedSx}
              >
                {salvando === bloco.tipo ? 'Salvando…' : 'Salvar'}
              </Button>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
