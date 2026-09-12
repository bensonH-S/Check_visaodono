import { assetUrl } from '../../config/paths';
import { ehLojaDeliveryNome, ehLojaPopeyes, rotuloBkLoja } from './escalaVisitasUtils';
import './loja-bk-marca.css';

type Props = {
  bk?: string | null;
  nome?: string | null;
  delivery?: boolean;
  className?: string;
  size?: number;
};

export default function LojaBkMarca({ bk, nome, delivery, className, size = 18 }: Props) {
  const rotulo = rotuloBkLoja(bk, nome, { delivery });
  const popeyes = ehLojaPopeyes(nome);
  const marca = !delivery && !ehLojaDeliveryNome(nome);
  const icone = popeyes ? 'Popeyes.png' : 'BK_logo.png';
  return (
    <span className={`ck-loja-bk${className ? ` ${className}` : ''}`}>
      {marca ? <img src={assetUrl(icone)} alt="" width={size} height={size} /> : null}
      <span>{rotulo}</span>
    </span>
  );
}
