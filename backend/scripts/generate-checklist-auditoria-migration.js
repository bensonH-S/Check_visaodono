/**
 * Gera migration 031 com perguntas do PDF
 * "Checklist de Auditoria Operacional e Segurança dos Alimentos"
 */
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const categorias = [
  { nome: 'Tipo de coleta', icone: 'camera', perguntas: [1, 2] },
  { nome: 'Lavagem das mãos', icone: 'wash', perguntas: [3, 4, 5, 6, 7] },
  { nome: 'Qualidade operacional', icone: 'thermostat', perguntas: [8] },
  { nome: 'Experiência do cliente', icone: 'users', perguntas: [9, 10, 11, 12, 13, 14, 15, 16] },
  { nome: 'Máquina de sorvete', icone: 'icecream', perguntas: [17, 18, 19] },
  { nome: 'Free Refil', icone: 'local_drink', perguntas: [20, 21, 22] },
  { nome: 'Salão', icone: 'weekend', perguntas: [23, 24] },
  { nome: 'Área externa e drive', icone: 'directions_car', perguntas: [25, 26, 27, 28] },
  { nome: 'Mesa principal', icone: 'restaurant', perguntas: [29, 30, 31, 32, 33, 34, 35, 36, 37] },
  { nome: 'Broiler e coifa', icone: 'outdoor_grill', perguntas: [38, 39, 40] },
  { nome: 'Estação de batatas', icone: 'fastfood', perguntas: [41, 42] },
  { nome: 'Fritadeira', icone: 'oil_barrel', perguntas: [43, 44] },
  { nome: 'Refrigeradores', icone: 'kitchen', perguntas: [45, 46] },
  { nome: 'Segurança dos alimentos', icone: 'shield', perguntas: [47, 48] },
  { nome: 'Qualidade dos alimentos', icone: 'food', perguntas: [49, 54, 55] },
  { nome: 'Gerenciamento da cozinha', icone: 'menu_book', perguntas: [50, 51, 52, 53] },
  { nome: 'Câmaras', icone: 'ac_unit', perguntas: [56, 57, 58, 59] },
  { nome: 'Gerenciamento de estoques', icone: 'inventory', perguntas: [60, 61] },
  { nome: 'Pisos e azulejos', icone: 'grid_on', perguntas: [62] },
  { nome: 'Iluminação', icone: 'lightbulb', perguntas: [63] },
  { nome: 'Teto e forro', icone: 'roofing', perguntas: [64] },
  { nome: 'Sanitizante e químicos', icone: 'science', perguntas: [65, 66, 67, 68, 69, 70] },
  { nome: 'Produtos aprovados', icone: 'verified', perguntas: [71, 72] },
  { nome: 'Pragas', icone: 'pest_control', perguntas: [73, 74, 75] },
  { nome: 'Retenção e segurança', icone: 'warning', perguntas: [76, 77, 78, 79, 80, 81, 82] },
  { nome: 'King Board', icone: 'dashboard', perguntas: [83] },
  { nome: 'Gente e labor', icone: 'groups', perguntas: [84, 85, 86] },
];

const textos = {
  1: 'Qual coleta será realizada? (Imagens Gerais)',
  2: 'Insira uma imagem da fachada do restaurante',
  3: 'A lavagem das mãos é feita quando necessário?',
  4: 'Os padrões de lavagem das mãos são seguidos corretamente?',
  5: 'Existe relógio ou dispositivo para controle do tempo de lavagem das mãos, ativo e funcionando?',
  6: 'Os dispensadores de papel toalha, sabão e álcool em gel estão abastecidos e em boas condições?',
  7: 'A pia para lavar as mãos possui alguma obstrução?',
  8: 'Existe um pirômetro disponível na loja, em boas condições, com sensores de agulha e superfície?',
  9: 'Os colaboradores estão disponíveis para atender os clientes e agem de maneira atenciosa?',
  10: 'Os 5 passos de atendimento são seguidos corretamente?',
  11: 'Todos os totens estão limpos e funcionam normalmente?',
  12: 'Todos os itens do menu estão disponíveis para compra dos clientes? (Verificar ruptura no totem.)',
  13: 'O tempo de atendimento está dentro do padrão de TMA/TME (03:30)?',
  14: 'O Líder de Experiência do Cliente interage diretamente com os clientes, estando presente no salão ou à frente do balcão?',
  15: 'A liderança responsável está posicionada no balcão nos horários de pico?',
  16: 'O tempo médio do drive está de acordo com os padrões?',
  17: 'A máquina de sorvete está limpa?',
  18: 'A máquina de sorvete está bem conservada e funcionando corretamente, oferecendo os sabores Baunilha e Doce de Leite?',
  19: 'O restaurante realiza o cálculo de Overrun diariamente?',
  20: 'Todos os sabores de bebidas no sistema Free Refil estão disponíveis para consumo dos clientes?',
  21: 'O dispensador de gelo da máquina Free Refil está limpo?',
  22: 'Máquina de gelo e Post Mix estão em boas condições de manutenção?',
  23: 'Os itens do salão (mesas, cadeiras e decoração) estão em boas condições de limpeza e manutenção?',
  24: 'Os banheiros do restaurante estão em bom estado de limpeza e conservação?',
  25: 'O estacionamento está limpo, iluminado, conservado e com placas de sinalização em bom estado?',
  26: 'O material de marketing está completo e visível para os clientes?',
  27: 'A pista do drive está em boas condições de limpeza e manutenção?',
  28: 'Durante a visita foram identificados carros sendo colocados em espera?',
  29: 'As tostadeiras estão em bom estado de conservação?',
  30: 'As tostadeiras estão limpas?',
  31: 'A tostagem dos pães está dentro dos padrões de qualidade?',
  32: 'Os pães em uso estão em boas condições e armazenados adequadamente?',
  33: 'Os PHUs estão em bom estado de conservação e programados corretamente?',
  34: 'Os PHUs estão limpos?',
  35: 'A qualidade das carnes na PHU está de acordo com os padrões exigidos?',
  36: 'Os micro-ondas estão em bom estado de conservação e limpeza?',
  37: 'A mesa de preparação de sanduíches está limpa?',
  38: 'O Broiler está limpo e bem conservado?',
  39: 'A coifa está limpa e bem conservada?',
  40: 'O detergente da coifa está abastecido?',
  41: 'A estação de batatas fritas atende aos padrões de limpeza e manutenção?',
  42: 'A retenção da batata frita na estufa está sendo controlada através de dispositivo apropriado?',
  43: 'A fritadeira está limpa e bem conservada?',
  44: 'A qualidade do óleo está em conformidade com os padrões exigidos?',
  45: 'Os refrigeradores e freezers de apoio estão limpos e funcionando adequadamente?',
  46: 'O dispensador de batatas está limpo e funcionando adequadamente?',
  47: 'As pinças estão em bom estado de conservação?',
  48: 'Produtos potencialmente perigosos atendem aos padrões mínimos de temperatura?',
  49: 'As lixeiras da área interna estão limpas, conservadas e identificadas corretamente?',
  50: 'Gerentes e equipe sabem utilizar a tabela de condimentos (Fresco & Pronto)?',
  51: 'A quantidade do PREP pronto está de acordo com a tabela de condimentos?',
  52: 'O Sistema de Gerenciamento de Cozinha (Tabela PLS) está atualizado e em uso?',
  53: 'O guia de posicionamento possui posições individuais e específicas para o expediente?',
  54: 'A qualidade dos hortifrutis está de acordo com os padrões?',
  55: 'O restaurante possui um fatiador de tomates em boas condições?',
  56: 'As câmaras de refrigeração e congelados estão limpas?',
  57: 'As câmaras de refrigeração e congelados estão em boas condições de manutenção?',
  58: 'As estantes de apoio da câmara fria estão em boas condições de manutenção e limpeza?',
  59: 'Os alimentos dos funcionários estão devidamente armazenados e identificados?',
  60: 'Todos os produtos estão armazenados com o distanciamento correto?',
  61: 'O sistema PVPS é aplicado corretamente?',
  62: 'Pisos e paredes da área interna estão limpos e conservados?',
  63: 'As luzes da área interna estão limpas e funcionando?',
  64: 'O teto e as saídas de ar da área interna estão limpos e conservados?',
  65: 'Todos os produtos químicos presentes são aprovados?',
  66: 'Todos os produtos químicos presentes são rotulados e armazenados adequadamente?',
  67: 'A concentração da solução sanitizante atende ao mínimo de 100 ppm?',
  68: 'Os baldes e borrifadores de sanitizante estão disponíveis em todas as estações?',
  69: 'Os panos aprovados e limpos estão submersos na solução sanitizante?',
  70: 'Existem tiras de teste sanitizantes disponíveis?',
  71: 'Todos os utensílios e ferramentas presentes são aprovados?',
  72: 'Todos os produtos presentes são aprovados?',
  73: 'Foi encontrado durante a visita algum roedor vivo ou morto?',
  74: 'Foram observadas baratas vivas ou mortas?',
  75: 'Há presença excessiva de moscas?',
  76: 'Foi encontrado algum vencimento primário?',
  77: 'Foi encontrado algum vencimento secundário?',
  78: 'Foi identificada a revalidação de algum produto durante a visita?',
  79: 'Foi identificada alguma oportunidade de contaminação cruzada durante a visita?',
  80: 'O kit de escovas da máquina de sorvete está completo, limpo e em boas condições?',
  81: 'Algum produto vencido foi servido ao cliente?',
  82: 'A liderança executa corretamente o processo de cocção de carnes?',
  83: 'O King Board está atualizado corretamente?',
  84: 'O quadro de lideranças do restaurante está completo?',
  85: 'O quadro de equipe do restaurante está completo?',
  86: 'A quantidade de colaboradores é suficiente para o fluxo de clientes?',
};

const comFoto = new Set([2, 7, 10, 12, 13, 20, 23, 24, 26, 30, 32, 34, 35, 37, 38, 41, 42, 43, 46, 51, 52, 54, 55, 56, 58, 62, 64, 80, 83]);
const criticas = new Set([10, 12, 48, 73, 74, 75, 76, 77, 78, 79, 81, 82]);

function esc(s) {
  return s.replace(/'/g, "''");
}

function meta(n) {
  const foto = comFoto.has(n);
  const critica = criticas.has(n);
  const tipo = foto ? 'sim_nao_foto' : 'sim_nao';
  const requerFoto = n === 2;
  const requerObs = foto && n !== 2;
  return { tipo, requerFoto, requerObs, critica };
}

const lines = [
  'BEGIN;',
  '',
  '-- Checklist de Auditoria Operacional e Segurança dos Alimentos (86 perguntas)',
  'TRUNCATE respostas, perguntas, categorias_checklist RESTART IDENTITY;',
  '',
];

categorias.forEach((cat, ci) => {
  lines.push(
    `INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('${esc(cat.nome)}', '${cat.icone}', ${ci + 1});`,
  );
});

lines.push('');

let ordemGlobal = 0;
categorias.forEach((cat, ci) => {
  const idCat = ci + 1;
  cat.perguntas.forEach((n) => {
    ordemGlobal += 1;
    const { tipo, requerFoto, requerObs, critica } = meta(n);
    const codigo = String(n).padStart(2, '0');
    lines.push(
      `INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES (${idCat}, '${codigo}', '${esc(textos[n])}', '${tipo}', TRUE, 1.0, ${ordemGlobal}, ${requerFoto}, ${requerObs}, ${critica});`,
    );
  });
});

lines.push('', 'COMMIT;', '');

const out = path.join(__dirname, '..', 'migrations', '031_checklist_auditoria_operacional.sql');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log('OK —', out, `(${ordemGlobal} perguntas, ${categorias.length} seções)`);
