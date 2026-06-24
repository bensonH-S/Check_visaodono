import { useCallback, useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { showToast } from '../utils/toast';
import { deveRastrearGpsTecnico, getUsuario } from '../lib/auth';
import {
  GPS_ATUALIZADO_EVENT,
  consultarPermissaoGps,
  geolocalizacaoDisponivel,
  mensagemErroGps,
  obterPosicaoAtual,
} from '../utils/geolocation';
import { api } from '../api/client';

type Props = {
  gpsAtivo?: boolean;
};

export default function AtivarGpsHeaderButton({ gpsAtivo = true }: Props) {
  const [visivel, setVisivel] = useState(false);
  const [ativando, setAtivando] = useState(false);

  const atualizar = useCallback(async () => {
    const user = getUsuario();
    if (!gpsAtivo || !deveRastrearGpsTecnico(user) || !geolocalizacaoDisponivel()) {
      setVisivel(false);
      return;
    }
    const permissao = await consultarPermissaoGps();
    setVisivel(permissao !== 'granted');
  }, [gpsAtivo]);

  useEffect(() => {
    void atualizar();
    window.addEventListener(GPS_ATUALIZADO_EVENT, atualizar);
    return () => window.removeEventListener(GPS_ATUALIZADO_EVENT, atualizar);
  }, [atualizar]);

  if (!visivel) return null;

  async function ativar() {
    setAtivando(true);
    try {
      const pos = await obterPosicaoAtual();
      await api.frotaAtualizarPosicao({
        latitude: pos.latitude,
        longitude: pos.longitude,
        precisao_metros: pos.precisao_metros ?? undefined,
      });
      showToast('Localização ativada com sucesso', 'success');
      window.dispatchEvent(new Event(GPS_ATUALIZADO_EVENT));
    } catch (err) {
      showToast(mensagemErroGps(err), 'error');
    } finally {
      setAtivando(false);
    }
  }

  const titulo = ativando ? 'Ativando GPS…' : 'Ativar localização';

  return (
    <Tooltip title={titulo}>
      <IconButton
        size="small"
        aria-label="Ativar localização"
        onClick={ativar}
        disabled={ativando}
        sx={{
          color: '#E8520A',
          animation: ativando ? 'none' : 'pulse-gps 2s ease-in-out infinite',
          '@keyframes pulse-gps': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.55 },
          },
        }}
      >
        <MyLocationIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
