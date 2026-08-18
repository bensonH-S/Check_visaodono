/** Cadernos BK 2024 — Break, Desperdício Completo e Desperdício Incompleto. */

export const TIPOS_LANCAMENTO = [
  'refeicao',
  'outro',
  'desperdicio_completo',
  'desperdicio_incompleto',
  'emprestimo',
];

export const TURNOS = [
  { codigo: 'manha', nome: 'Manhã' },
  { codigo: 'tarde', nome: 'Tarde' },
  { codigo: 'noite', nome: 'Noite' },
];

export const MOTIVOS_DC = [
  { codigo: 'fora_padrao', nome: 'Fora do padrão' },
  { codigo: 'pedido_cancelado', nome: 'Pedido cancelado' },
  { codigo: 'dlv_motoboy', nome: 'DLV motoboy' },
  { codigo: 'dlv_cancelado', nome: 'DLV cancelado' },
  { codigo: 'erro_preparo', nome: 'Erro de preparo' },
  { codigo: 'troca_moeda', nome: 'Troca / moeda' },
  { codigo: 'filmagem_teste', nome: 'Filmagem / teste' },
  { codigo: 'degust_campanha', nome: 'Degustação / campanha' },
];

export const MOTIVOS_DI = [
  { codigo: 'nivel_tempo_ret', nome: 'Nível / tempo de retenção' },
  { codigo: 'qualid_impropria', nome: 'Qualidade imprópria' },
  { codigo: 'qualid_fornecedor', nome: 'Qualidade do fornecedor' },
  { codigo: 'itens_faltando_caixa', nome: 'Itens faltando na caixa' },
  { codigo: 'venc_primario', nome: 'Vencimento primário' },
  { codigo: 'sobra_venc_sec', nome: 'Sobra / venc. secundário' },
  { codigo: 'praga_hortif', nome: 'Praga hortifruti' },
  { codigo: 'mont_maq_sorv', nome: 'Montagem máquina de sorvete' },
  { codigo: 'mal_func_equip', nome: 'Mau funcionamento de equipamento' },
  { codigo: 'prod_descont', nome: 'Produto descontinuado' },
  { codigo: 'filmagem_testes', nome: 'Filmagem / testes' },
  { codigo: 'loja_fechada', nome: 'Loja fechada' },
];

const ITENS_BREAK = [
  { nome: 'WHOPPER/Q', aliases: ['whopper q', 'whopper queijo', 'whopper'] },
  { nome: 'WHOP JR/Q', aliases: ['whop jr', 'whopper jr', 'whopper junior'] },
  { nome: 'WHOPPER FURIOSO', aliases: ['whopper furioso'] },
  { nome: 'CHICKEN JUNIOR', aliases: ['chicken junior', 'chicken jr'] },
  { nome: 'CHS BURGER', aliases: ['chs burger', 'cheeseburger', 'cheese burger'] },
  { nome: 'CHS BURGER DP', aliases: ['cheeseburger duplo', 'cheese burger duplo', 'chs burger dp'] },
  { nome: 'CHS BURGER DP/B', aliases: ['cheeseburger duplo bacon', 'chs burger dp b'] },
  { nome: 'STACKER DP', aliases: ['stacker duplo', 'stacker dp', 'stacker'] },
  { nome: 'BIG KING', aliases: ['big king'] },
  { nome: 'RODEIO DUPLO', aliases: ['rodeio duplo'] },
  { nome: 'REBEL WHOPPER', aliases: ['rebel whopper', 'whopper plant'] },
  { nome: 'CHICKEN DUPLO', aliases: ['chicken duplo'] },
  { nome: 'WHOPPER BBQ BACON', aliases: ['whopper bbq bacon', 'whopper barbecue bacon'] },
  { nome: 'BK ORIGINAL', aliases: ['bk original'] },
  { nome: 'BK CHEDDAR', aliases: ['bk cheddar'] },
  { nome: 'CBK', aliases: ['cbk', 'chicken bk'] },
  { nome: 'CHICKEN SALAD BACON', aliases: ['chicken salad bacon', 'chicken salad'] },
  { nome: 'BK LEVISSIMA BREAK C/ CHICKEN CRISPY', aliases: ['levissima chicken', 'bk levissima chicken'] },
  { nome: 'BK LEVISSIMA BREAK C/ CARNE HB', aliases: ['levissima carne', 'bk levissima carne', 'bk levissima'] },
  { nome: 'MARMITA 1', aliases: ['marmita 1', 'marmita'] },
  { nome: 'MARMITA 2', aliases: ['marmita 2'] },
  { nome: 'MARMITA 3', aliases: ['marmita 3'] },
  { nome: 'MARMITA 4', aliases: ['marmita 4'] },
  { nome: 'MARMITA 5', aliases: ['marmita 5'] },
  { nome: 'CASQUINHA BAUNILHA', aliases: ['casquinha baunilha'] },
  { nome: 'CASQUINHA MISTA', aliases: ['casquinha mista'] },
  { nome: 'BATATA PEQUENA', aliases: ['batata pequena', 'batata peq'] },
  { nome: 'BATATA MEDIA', aliases: ['batata media', 'batata med'] },
  { nome: 'CASQUINHA DOCE DE LEITE', aliases: ['casquinha doce de leite'] },
  { nome: 'FREE REFIL', aliases: ['free refil', 'refil', 'refill'] },
  { nome: 'REFRI COCA LATA', aliases: ['coca lata', 'refrigerante coca', 'coca-cola lata'] },
  { nome: 'REFRI GUARANA LATA', aliases: ['guarana lata', 'refrigerante guarana'] },
  { nome: 'AGUA MINERAL BURGER KING', aliases: ['agua mineral', 'agua bk'] },
  { nome: 'SUNDAE BAUNILHA', aliases: ['sundae baunilha'] },
  { nome: 'SUNDAE DOCE DE LEITE', aliases: ['sundae doce de leite', 'sundae d leite'] },
  { nome: 'SUNDAE MORANGO', aliases: ['sundae morango'] },
];

const ITENS_DC = [
  { nome: 'WHOPPER', aliases: ['whopper'] },
  { nome: 'WHOPPER JR', aliases: ['whopper jr', 'whopper junior'] },
  { nome: 'BIG KING', aliases: ['big king'] },
  { nome: 'RODEIO', aliases: ['rodeio'] },
  { nome: 'RODEIO DUPLO', aliases: ['rodeio duplo'] },
  { nome: 'CHEESEBURGER', aliases: ['cheeseburger', 'cheese burger', 'chs burger'] },
  { nome: 'CH DUPLO', aliases: ['cheeseburger duplo', 'ch duplo'] },
  { nome: 'STACKER DUP BACON', aliases: ['stacker dup', 'stacker bacon', 'stacker'] },
  { nome: 'BK ORIGINAL', aliases: ['bk original'] },
  { nome: 'BK CHEDDAR', aliases: ['bk cheddar'] },
  { nome: 'BACON BK CHEDDAR', aliases: ['bacon bk cheddar'] },
  { nome: 'WHOPPER PLANTAS', aliases: ['whopper plant', 'rebel whopper'] },
  { nome: 'CHICKEN SALAD BAC', aliases: ['chicken salad'] },
  { nome: 'BK CHICKEN CRISP', aliases: ['chicken crisp', 'chicken crispy'] },
  { nome: 'CHICKEN DUPLO', aliases: ['chicken duplo'] },
  { nome: 'CHICKEN JR', aliases: ['chicken jr', 'chicken junior'] },
  { nome: 'CBK', aliases: ['cbk'] },
  { nome: 'BATATA PEQ', aliases: ['batata peq', 'batata pequena'] },
  { nome: 'BATATA MED', aliases: ['batata med', 'batata media'] },
  { nome: 'BATATA GRA', aliases: ['batata gra', 'batata grande'] },
  { nome: 'BK CHICKEN CX4', aliases: ['chicken cx4', 'bk chicken 4'] },
  { nome: 'BK CHICKEN CX6', aliases: ['chicken cx6', 'bk chicken 6'] },
  { nome: 'BK CHICKEN CX10', aliases: ['chicken cx10', 'bk chicken 10'] },
  { nome: 'ONION RINGS M', aliases: ['onion rings m', 'onion rings media'] },
  { nome: 'ONION RINGS G', aliases: ['onion rings g', 'onion rings grande', 'onion rings'] },
  { nome: 'CASQUINHA', aliases: ['casquinha'] },
  { nome: 'SHAKE', aliases: ['shake', 'milk shake'] },
  { nome: 'SUNDAE', aliases: ['sundae'] },
  { nome: 'BK MIX', aliases: ['bk mix'] },
  { nome: 'MAIONESE SACHET', aliases: ['maionese sachet', 'maionese sachê'] },
  { nome: 'MAIONESE S. BACON', aliases: ['maionese bacon'] },
  { nome: 'MAIONESE VERDE S.', aliases: ['maionese verde'] },
  { nome: 'MOLHO BARBECUE B.', aliases: ['molho barbecue', 'molho bbq'] },
  { nome: 'MOLHO FURIOSO B.', aliases: ['molho furioso'] },
];

const ITENS_DI = [
  { nome: 'ALFACE AMERICANA', aliases: ['alface americana', 'alface'] },
  { nome: 'AMENDOIM', aliases: ['amendoim'] },
  { nome: 'BACON EM CUBOS', aliases: ['bacon cubos', 'bacon'] },
  { nome: 'BATATA', aliases: ['batata'] },
  { nome: 'BEBIDA LACTEA', aliases: ['bebida lactea'] },
  { nome: 'BK CHICKEN', aliases: ['bk chicken'] },
  { nome: 'BROWNIE', aliases: ['brownie'] },
  { nome: 'CALDA MORANGO', aliases: ['calda morango'] },
  { nome: 'CALDA OVOMALTINE', aliases: ['calda ovomaltine'] },
  { nome: 'CARNE GOURMET', aliases: ['carne gourmet'] },
  { nome: 'CARNE HB 2', aliases: ['carne hb', 'carne hamburger'] },
  { nome: 'CARNE WHOPPER', aliases: ['carne whopper'] },
  { nome: 'CASQUINHA', aliases: ['casquinha'] },
  { nome: 'CEBOLA', aliases: ['cebola'] },
  { nome: 'CHICKEN CRISPY', aliases: ['chicken crispy', 'chicken crisp'] },
  { nome: 'COBERTURAS', aliases: ['cobertura'] },
  { nome: 'CONFEITO', aliases: ['confeito'] },
  { nome: 'KETCHUP GRANEL', aliases: ['ketchup'] },
  { nome: 'MACA', aliases: ['maca', 'maçã'] },
  { nome: 'MAIONESE GRANEL', aliases: ['maionese granel', 'maionese'] },
  { nome: 'MAIONESE VERDE', aliases: ['maionese verde'] },
  { nome: 'MILK SHAKE', aliases: ['milk shake', 'milkshake', 'shake'] },
  { nome: 'MOLHO BARBECUE GRAN.', aliases: ['molho barbecue', 'molho bbq'] },
  { nome: 'MOLHO FURIOSO GRANEL', aliases: ['molho furioso'] },
  { nome: 'MOLHO QUEIJO CHEDDAR', aliases: ['molho cheddar', 'molho queijo'] },
  { nome: 'MOLHO STACKER GRANEL', aliases: ['molho stacker'] },
  { nome: 'MOSTARDA HEINZ', aliases: ['mostarda'] },
  { nome: 'NUTELLA', aliases: ['nutella'] },
  { nome: 'ONION RINGS', aliases: ['onion rings', 'onion'] },
  { nome: 'OVOMALTINE', aliases: ['ovomaltine'] },
  { nome: 'PAO CONG BRIOCHE', aliases: ['pao brioche', 'pao cong brioche'] },
  { nome: 'PAO CONG HAMBURGER', aliases: ['pao hamburger', 'pao hamburguer'] },
  { nome: 'PAO CONG SUPREMO', aliases: ['pao supremo'] },
  { nome: 'PAO CONG WHOPPER', aliases: ['pao whopper'] },
  { nome: 'PEPINO FATIADO', aliases: ['pepino'] },
  { nome: 'PIMENTA', aliases: ['pimenta'] },
  { nome: 'QUEIJO CHEDDAR', aliases: ['queijo cheddar', 'cheddar'] },
  { nome: 'TENDER CRISP FILE', aliases: ['tender crisp'] },
  { nome: 'TOMATE CARMEM', aliases: ['tomate'] },
];

export function normalizarCatalogo(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function aliasesDoItem(item) {
  const lista = [item.nome, ...(item.aliases || [])];
  return [...new Set(lista.map(normalizarCatalogo).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
}

function casaComItem(textoNorm, item) {
  if (!textoNorm) return false;
  return aliasesDoItem(item).some((a) => textoNorm.includes(a) || a.includes(textoNorm));
}

export function motivosDoTipo(tipo) {
  if (tipo === 'desperdicio_completo') return MOTIVOS_DC;
  if (tipo === 'desperdicio_incompleto') return MOTIVOS_DI;
  return [];
}

export function filtrarPorCaderno(rows, tipo) {
  const lista =
    tipo === 'desperdicio_completo' ? ITENS_DC : tipo === 'desperdicio_incompleto' ? ITENS_DI : ITENS_BREAK;
  return (rows || []).filter((row) => {
    const texto = normalizarCatalogo(`${row.descricao || ''} ${row.codigo || ''}`);
    return lista.some((item) => casaComItem(texto, item));
  });
}

export function labelTipoLancamento(tipo) {
  if (tipo === 'desperdicio_completo') return 'Desperdício completo';
  if (tipo === 'desperdicio_incompleto') return 'Desperdício incompleto';
  if (tipo === 'emprestimo') return 'Empréstimo';
  if (tipo === 'outro') return 'Outro';
  return 'Break';
}
