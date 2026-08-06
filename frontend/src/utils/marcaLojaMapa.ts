import { assetUrl } from '../config/paths';

export type MarcaLojaMapa = 'burger-king' | 'popeyes' | 'escritorio';

export function detectarMarcaLoja(
  nomeOuLoja: string | { name: string; corporate_name?: string | null },
): MarcaLojaMapa {
  const nome = typeof nomeOuLoja === 'string' ? nomeOuLoja : nomeOuLoja.name;
  const corporate = typeof nomeOuLoja === 'string' ? '' : nomeOuLoja.corporate_name ?? '';
  const n = `${nome} ${corporate}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (
    n.includes('POPEYES') ||
    n.includes('POPYES') ||
    /\bPOP VAL\b/.test(n)
  ) {
    return 'popeyes';
  }
  if (n.includes('BURGER KING') || /\bBK\b/.test(n)) return 'burger-king';
  if (n.includes('ESCRITORIO') || /\bGA\b/.test(n)) return 'escritorio';
  return 'escritorio';
}

export function iconeMarcaLojaUrl(marca: MarcaLojaMapa): string {
  switch (marca) {
    case 'burger-king':
      return assetUrl('BK_logo.png');
    case 'popeyes':
      return assetUrl('Popeyes.png');
    default:
      return assetUrl('Logo_Alvim_Icone.png');
  }
}

export function iconeMarcaLojaPorNome(
  nomeOuLoja: string | { name: string; corporate_name?: string | null },
): string {
  return iconeMarcaLojaUrl(detectarMarcaLoja(nomeOuLoja));
}
