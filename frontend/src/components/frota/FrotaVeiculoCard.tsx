import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type { FrotaVeiculo } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

function tituloVeiculo(v: FrotaVeiculo) {
  const mm = [v.marca, v.modelo].filter(Boolean).join(' ');
  return mm || 'Veículo';
}

function InfoLinha({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.35 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 88, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

type Props = {
  veiculo: FrotaVeiculo;
  onEditar: (v: FrotaVeiculo) => void;
};

export default function FrotaVeiculoCard({ veiculo: v, onEditar }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [infoAberto, setInfoAberto] = useState(false);

  function abrirInfo() {
    setInfoAberto(true);
  }

  return (
    <>
      <Paper
        ref={cardRef}
        elevation={0}
        onClick={abrirInfo}
        sx={{
          position: 'relative',
          p: 1.5,
          pr: 4.5,
          cursor: 'pointer',
          border: '1px solid',
          borderColor: infoAberto ? colors.navy : colors.border,
          borderLeft: `4px solid ${colors.navy}`,
          borderRadius: 2,
          transition: 'box-shadow 0.2s, border-color 0.2s',
          '&:hover': {
            borderColor: colors.navy,
            boxShadow: '0 4px 16px rgba(27, 42, 107, 0.08)',
          },
        }}
      >
        <IconButton
          size="small"
          aria-label="Editar veículo"
          onClick={(e) => {
            e.stopPropagation();
            setInfoAberto(false);
            onEditar(v);
          }}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: colors.navy,
            bgcolor: 'rgba(27, 42, 107, 0.06)',
            '&:hover': { bgcolor: 'rgba(27, 42, 107, 0.12)' },
          }}
        >
          <EditOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <Chip
          label={v.placa}
          size="small"
          sx={{ fontWeight: 700, bgcolor: 'rgba(27, 42, 107, 0.08)', mb: 1 }}
        />
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.25, lineHeight: 1.3 }}>
          {tituloVeiculo(v)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
          {v.ano ? `Ano ${v.ano}` : 'Ano —'}
          {v.cor ? ` · ${v.cor}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          KM: {v.km_atual != null ? v.km_atual.toLocaleString('pt-BR') : '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {v.nome_responsavel ? v.nome_responsavel : 'Sem responsável'}
          {v.nome_regiao ? ` · ${v.nome_regiao}` : ''}
        </Typography>
      </Paper>

      <Popover
        open={infoAberto}
        anchorEl={cardRef.current}
        onClose={() => setInfoAberto(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.25,
              px: 2,
              py: 1.75,
              width: 300,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'rgba(27, 42, 107, 0.12)',
              boxShadow: '0 12px 40px rgba(27, 42, 107, 0.16)',
              position: 'relative',
              overflow: 'visible',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -8,
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: 14,
                height: 14,
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'rgba(27, 42, 107, 0.12)',
                borderBottom: 'none',
                borderRight: 'none',
              },
            },
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.navy, mb: 0.5 }}>
          {tituloVeiculo(v)}
        </Typography>
        <Chip label={v.placa} size="small" sx={{ fontWeight: 700, mb: 1.25 }} />
        <Divider sx={{ mb: 1 }} />
        <InfoLinha label="RENAVAM" value={v.renavam || '—'} />
        <InfoLinha label="Chassi" value={v.chassi || '—'} />
        <InfoLinha label="Ano" value={v.ano ? String(v.ano) : '—'} />
        <InfoLinha label="Cor" value={v.cor || '—'} />
        <InfoLinha label="Combustível" value={v.combustivel || '—'} />
        <InfoLinha
          label="KM atual"
          value={v.km_atual != null ? `${v.km_atual.toLocaleString('pt-BR')} km` : '—'}
        />
        <InfoLinha label="Responsável" value={v.nome_responsavel || 'Sem responsável'} />
        <InfoLinha
          label="Assunção"
          value={v.assuncao_em ? formatDataHoraBrasilia(v.assuncao_em) : '—'}
        />
        {v.observacoes && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
              Observações
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.45 }}>
              {v.observacoes}
            </Typography>
          </>
        )}
      </Popover>
    </>
  );
}
