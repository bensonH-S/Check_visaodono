import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { FOLGA_GESTOR_OPCOES } from './escalaVisitasUtils';

export type LojaOpcaoGestor = {
  id_loja: number;
  name?: string;
  nome?: string;
  bk_number?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lojas: LojaOpcaoGestor[];
  initial?: {
    id_gestor?: number;
    nome?: string;
    id_loja?: number | null;
    folga_padrao?: string | null;
  } | null;
  onSalvar: (payload: {
    id_gestor?: number;
    nome: string;
    id_loja: number | null;
    folga_padrao: string | null;
  }) => Promise<void>;
  onDesativar?: (idGestor: number) => Promise<void>;
};

export default function EscalaGestorCadastroDialog({
  open,
  onClose,
  lojas,
  initial,
  onSalvar,
  onDesativar,
}: Props) {
  const editando = Boolean(initial?.id_gestor);
  const [nome, setNome] = useState('');
  const [idLoja, setIdLoja] = useState<number | null>(null);
  const [folga, setFolga] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(initial?.nome || '');
    setIdLoja(initial?.id_loja ?? null);
    setFolga(initial?.folga_padrao || '');
  }, [open, initial]);

  const lojaSelecionada =
    lojas.find((l) => Number(l.id_loja) === Number(idLoja)) || null;

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await onSalvar({
        id_gestor: initial?.id_gestor,
        nome: nome.trim(),
        id_loja: idLoja,
        folga_padrao: folga || null,
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editando ? 'Alterar gestor' : 'Adicionar gestor'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Nome do gestor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            fullWidth
            autoFocus
          />
          <Autocomplete
            options={lojas}
            value={lojaSelecionada}
            onChange={(_, v) => setIdLoja(v?.id_loja ?? null)}
            getOptionLabel={(l) => {
              const n = l.name || l.nome || `Loja ${l.id_loja}`;
              return l.bk_number ? `${n} · BKN ${l.bk_number}` : n;
            }}
            isOptionEqualToValue={(a, b) => a.id_loja === b.id_loja}
            renderInput={(params) => <TextField {...params} label="Loja" />}
          />
          <TextField
            select
            label="Folga padrão"
            value={folga}
            onChange={(e) => setFolga(e.target.value)}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            {FOLGA_GESTOR_OPCOES.map((op) => (
              <MenuItem key={op} value={op}>
                {op}
              </MenuItem>
            ))}
            <MenuItem value="combinado com Camilla">combinado com Camilla</MenuItem>
            {folga &&
              !(FOLGA_GESTOR_OPCOES as readonly string[]).includes(folga) &&
              folga !== 'combinado com Camilla' && <MenuItem value={folga}>{folga}</MenuItem>}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <span>
          {editando && onDesativar && initial?.id_gestor ? (
            <Button
              color="error"
              disabled={salvando}
              onClick={async () => {
                setSalvando(true);
                try {
                  await onDesativar(initial.id_gestor!);
                  onClose();
                } finally {
                  setSalvando(false);
                }
              }}
            >
              Remover
            </Button>
          ) : null}
        </span>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void salvar()} disabled={salvando || !nome.trim()}>
            Salvar
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
