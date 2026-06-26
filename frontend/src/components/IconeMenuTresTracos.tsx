type Props = {
  ativo?: boolean;
};

const ORANGE = '#E8520A';
const INATIVO = '#1a1a1a';

/** Três traços finos; o do meio começa à esquerda e termina curto à direita. */
export default function IconeMenuTresTracos({ ativo = false }: Props) {
  const cor = ativo ? ORANGE : INATIVO;

  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden fill="none">
      <line x1="0" y1="1" x2="20" y2="1" stroke={cor} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0" y1="7" x2="13" y2="7" stroke={cor} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0" y1="13" x2="20" y2="13" stroke={cor} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
