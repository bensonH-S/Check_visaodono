import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useMobileMais } from '../MobileTabBar';

export type AppHubAba = 'inicio' | 'checklist' | 'estoque' | 'visitas';

type Props = {
  ativo?: AppHubAba | null;
  /** Quarta aba do dock (padrão: estoque). */
  slot?: 'estoque' | 'visitas';
  plusLabel: string;
  plusDisabled?: boolean;
  onPlus: () => void;
};

export default function AppHubDock({
  ativo,
  slot = 'estoque',
  plusLabel,
  plusDisabled,
  onPlus,
}: Props) {
  const navigate = useNavigate();
  const { openMais } = useMobileMais();

  return (
    <nav className="ck-estoque-hub__dock" aria-label="App">
      <button type="button" className={ativo === 'inicio' ? 'is-on' : ''} onClick={() => navigate('/inicio/mobile')}>
        <HomeOutlinedIcon />
        Início
      </button>
      <button
        type="button"
        className={ativo === 'checklist' ? 'is-on' : ''}
        onClick={() => navigate('/checklist/mobile')}
      >
        <AssignmentOutlinedIcon />
        Checklist
      </button>
      <button
        type="button"
        className="ck-estoque-hub__dock-plus"
        aria-label={plusLabel}
        disabled={plusDisabled}
        onClick={onPlus}
      >
        <AddIcon />
      </button>
      {slot === 'visitas' ? (
        <button
          type="button"
          className={ativo === 'visitas' ? 'is-on' : ''}
          onClick={() => navigate('/visitas/mobile')}
        >
          <HistoryOutlinedIcon />
          Visitas
        </button>
      ) : (
        <button type="button" className={ativo === 'estoque' ? 'is-on' : ''} onClick={() => navigate('/estoque/mobile')}>
          <Inventory2OutlinedIcon />
          Estoque
        </button>
      )}
      <button type="button" aria-label="Mais módulos" onClick={openMais}>
        <MoreHorizIcon />
        Mais
      </button>
    </nav>
  );
}
