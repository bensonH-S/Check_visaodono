import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import {
  getUsuario,
  modoAppTecnicoFrotaRestrito,
  podeAssinarTermoFerramentasMobile,
} from '../../lib/auth';

type Props = {
  open: boolean;
  onClose: () => void;
  temVeiculo?: boolean;
  termoAssinado?: boolean;
};

export default function FrotaPlusSheet({
  open,
  onClose,
  temVeiculo = true,
  termoAssinado,
}: Props) {
  const navigate = useNavigate();
  const user = getUsuario();
  const modoRestrito = modoAppTecnicoFrotaRestrito(user);
  const exibeTermo = !modoRestrito && podeAssinarTermoFerramentasMobile(user);

  if (!open) return null;

  function ir(path: string) {
    onClose();
    navigate(path);
  }

  return createPortal(
    <div className="ck-frota-hub__ops" role="presentation">
      <button type="button" className="ck-frota-hub__ops-backdrop" aria-label="Fechar" onClick={onClose} />
      <div className="ck-frota-hub__ops-card" role="dialog" aria-modal="true" aria-label="Operações da frota">
        <div className="ck-frota-hub__ops-head">
          <strong>Operações</strong>
          <button type="button" className="ck-frota-hub__ops-fechar" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="ck-frota-hub__ops-text">Escolha o que deseja fazer:</p>
        <div className="ck-frota-hub__ops-actions">
          <button
            type="button"
            className={`ck-frota-hub__ops-btn is-fuel${!temVeiculo ? ' is-off' : ''}`}
            disabled={!temVeiculo}
            onClick={() => ir('/frota/mobile/abastecimento')}
          >
            <LocalGasStationIcon />
            <span>
              <strong>Combustível</strong>
              <small>
                {temVeiculo
                  ? 'Registrar abastecimento com KM, valor e nota'
                  : 'Disponível após assumir um veículo'}
              </small>
            </span>
          </button>

          {!modoRestrito ? (
            <button
              type="button"
              className={`ck-frota-hub__ops-btn${temVeiculo ? ' is-off' : ' is-pri'}`}
              disabled={temVeiculo}
              onClick={() => ir('/frota/mobile/veiculo')}
            >
              <DirectionsCarIcon />
              <span>
                <strong>Assumir veículo</strong>
                <small>
                  {temVeiculo
                    ? 'Você já tem um veículo sob sua responsabilidade'
                    : 'Assumir o carro com CNH e fotos'}
                </small>
              </span>
            </button>
          ) : null}

          {exibeTermo ? (
            <button
              type="button"
              className="ck-frota-hub__ops-btn is-termo"
              onClick={() => ir('/frota/mobile/termo')}
            >
              <AssignmentIcon />
              <span>
                <strong>
                  Termo de ferramentas
                  {termoAssinado != null ? (
                    <span className={`ck-frota-hub__badge${termoAssinado ? ' is-ok' : ' is-warn'}`}>
                      {termoAssinado ? 'Assinado' : 'Pendente'}
                    </span>
                  ) : null}
                </strong>
                <small>Assinatura digital e fotos dos equipamentos</small>
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className={`ck-frota-hub__ops-btn is-maint${!temVeiculo ? ' is-off' : ''}`}
            disabled={!temVeiculo}
            onClick={() => ir('/frota/mobile/manutencao')}
          >
            <BuildIcon />
            <span>
              <strong>Manutenção</strong>
              <small>
                {temVeiculo
                  ? 'Registrar serviços, KM e fatura do veículo'
                  : 'Disponível após assumir um veículo'}
              </small>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
