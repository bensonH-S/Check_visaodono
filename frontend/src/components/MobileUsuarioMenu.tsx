import { useEffect, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { iniciaisUsuario, type UsuarioSessao } from '../lib/auth';
import { compressImage } from '../utils/compressImage';
import {
  FOTO_PERFIL_ATUALIZADA_EVENT,
  getFotoPerfil,
  notificarFotoPerfilAtualizada,
  removerFotoPerfil,
  setFotoPerfil,
} from '../utils/fotoPerfil';
import { showToast } from '../utils/toast';
import SobreSistemaDialog from './SobreSistemaDialog';
import FotoPerfilCropDialog from './FotoPerfilCropDialog';
import CameraCaptureOverlay from './CameraCaptureOverlay';

const NAVY = '#1B2A6B';

type Props = {
  user: UsuarioSessao | null;
  onLogout: () => void;
};

export default function MobileUsuarioMenu({ user, onLogout }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [origemFotoAberta, setOrigemFotoAberta] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropAberto, setCropAberto] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [foto, setFoto] = useState<string | null>(() =>
    user ? getFotoPerfil(user.id_usuario) : null,
  );
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const iniciais = iniciaisUsuario(user);

  useEffect(() => {
    if (!user) {
      setFoto(null);
      return;
    }
    const idUsuario = user.id_usuario;
    setFoto(getFotoPerfil(idUsuario));
    function onFotoAtualizada() {
      setFoto(getFotoPerfil(idUsuario));
    }
    window.addEventListener(FOTO_PERFIL_ATUALIZADA_EVENT, onFotoAtualizada);
    return () => window.removeEventListener(FOTO_PERFIL_ATUALIZADA_EVENT, onFotoAtualizada);
  }, [user]);

  function fecharMenu() {
    setAnchor(null);
  }

  async function abrirCropComArquivo(file: File | undefined) {
    if (!file || !user) return;
    try {
      const dataUrl = await compressImage(file);
      setCropSrc(dataUrl);
      setCropAberto(true);
    } catch {
      showToast('Não foi possível carregar a imagem', 'error');
    } finally {
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraFallbackRef.current) cameraFallbackRef.current.value = '';
    }
  }

  function salvarFotoRecortada(dataUrl: string) {
    if (!user) return;
    setFotoPerfil(user.id_usuario, dataUrl);
    setFoto(dataUrl);
    notificarFotoPerfilAtualizada();
    setCropAberto(false);
    setCropSrc(null);
    showToast('Foto de perfil atualizada', 'success');
  }

  function abrirCamera() {
    setOrigemFotoAberta(false);
    if (navigator.mediaDevices) {
      setCameraAberta(true);
      return;
    }
    cameraFallbackRef.current?.click();
  }

  function removerFoto() {
    if (!user) return;
    removerFotoPerfil(user.id_usuario);
    setFoto(null);
    notificarFotoPerfilAtualizada();
    setOrigemFotoAberta(false);
    showToast('Foto de perfil removida', 'success');
  }

  return (
    <>
      <IconButton
        aria-label="Menu do utilizador"
        aria-haspopup="true"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ p: 0.15, ml: 0.35 }}
      >
        <Avatar
          src={foto ?? undefined}
          alt={user?.nome ?? 'Utilizador'}
          sx={{
            width: 46,
            height: 46,
            bgcolor: foto ? 'transparent' : 'rgba(27, 42, 107, 0.12)',
            color: NAVY,
            fontWeight: 800,
            fontSize: '0.88rem',
            border: 'none',
          }}
        >
          {!foto && iniciais}
        </Avatar>
      </IconButton>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void abrirCropComArquivo(e.target.files?.[0])}
      />
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={(e) => void abrirCropComArquivo(e.target.files?.[0])}
      />

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={fecharMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2.5,
              mt: 0.75,
              boxShadow: '0 12px 32px rgba(27, 42, 107, 0.16)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            fecharMenu();
            setOrigemFotoAberta(true);
          }}
        >
          <ListItemIcon>
            <PhotoCameraOutlinedIcon fontSize="small" sx={{ color: NAVY }} />
          </ListItemIcon>
          <ListItemText
            primary="Atualizar foto"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            fecharMenu();
            setSobreAberto(true);
          }}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" sx={{ color: NAVY }} />
          </ListItemIcon>
          <ListItemText
            primary="Sobre"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            fecharMenu();
            onLogout();
          }}
          sx={{ color: '#DC2626' }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#DC2626' }} />
          </ListItemIcon>
          <ListItemText
            primary="Terminar sessão"
            slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: 600 } } }}
          />
        </MenuItem>
      </Menu>

      <Dialog
        open={origemFotoAberta}
        onClose={() => setOrigemFotoAberta(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, color: NAVY, pb: 0.5 }}>Foto de perfil</DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PhotoCameraOutlinedIcon />}
              onClick={abrirCamera}
              sx={{
                py: 1.1,
                px: 1,
                borderColor: 'rgba(27, 42, 107, 0.2)',
                color: NAVY,
                fontWeight: 600,
                fontSize: '0.76rem',
                textTransform: 'none',
              }}
            >
              Tirar foto
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PhotoLibraryOutlinedIcon />}
              onClick={() => {
                setOrigemFotoAberta(false);
                galleryRef.current?.click();
              }}
              sx={{
                py: 1.1,
                px: 1,
                borderColor: 'rgba(27, 42, 107, 0.2)',
                color: NAVY,
                fontWeight: 600,
                fontSize: '0.76rem',
                textTransform: 'none',
              }}
            >
              Galeria
            </Button>
          </Box>
          {foto && (
            <Button
              fullWidth
              variant="text"
              startIcon={<DeleteOutlinedIcon />}
              onClick={removerFoto}
              sx={{
                mt: 1.25,
                color: '#DC2626',
                fontWeight: 600,
                fontSize: '0.82rem',
                textTransform: 'none',
              }}
            >
              Remover foto atual
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <CameraCaptureOverlay
        open={cameraAberta}
        onClose={() => setCameraAberta(false)}
        facingMode="user"
        allowFlipCamera
        onCapture={(file) => {
          setCameraAberta(false);
          void abrirCropComArquivo(file);
        }}
      />

      <FotoPerfilCropDialog
        open={cropAberto}
        imageSrc={cropSrc}
        onClose={() => {
          setCropAberto(false);
          setCropSrc(null);
        }}
        onConfirm={salvarFotoRecortada}
      />

      <SobreSistemaDialog open={sobreAberto} onClose={() => setSobreAberto(false)} />
    </>
  );
}
