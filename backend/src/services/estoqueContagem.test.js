/**
 * Motor de conversão da contagem (Etapa 1).
 *   node --test src/services/estoqueContagem.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQtdContagem,
  chaveCodigoRede,
  sqlMatchCodigoSku,
  classificarCasoRevisaoUnidade,
  classificarUnidadeContagem,
  resolverQtdContagem,
  sqlFiltroItensContagem,
  statusConversaoFracionada,
  linhaDiffNaUnidadeDaContagem,
  unidadeFracionadaEfetiva,
  validarUnidadeFracionadaCadastro,
} from './estoqueContagem.js';
import {
  MOTIVO_CONVERSAO,
  aplicarConversaoUnidades,
  converterQuantidade,
} from './estoqueConsumo.js';

describe('chaveCodigoRede', () => {
  it('034754 e 34754 são o mesmo SKU na rede', () => {
    assert.equal(chaveCodigoRede('034754'), '34754');
    assert.equal(chaveCodigoRede('34754'), '34754');
    assert.equal(chaveCodigoRede('RCNT-BALDEPAPEL900MLBKC'), 'RCNT-BALDEPAPEL900MLBKC');
  });
});

describe('sqlMatchCodigoSku', () => {
  it('não junta 010947 com 10947 pelo zero à esquerda', () => {
    const sql = sqlMatchCodigoSku('dest', '$10', '$11');
    assert.match(sql, /NOT EXISTS/);
    assert.match(sql, /colisao/);
  });
});

describe('classificarUnidadeContagem', () => {
  it('papel toalha com fator 6 não vira KG', () => {
    assert.equal(classificarUnidadeContagem('PAPEL TOALHA BK CX 6X200M', 6), 'UND');
  });
  it('copo 550 é UND', () => {
    assert.equal(classificarUnidadeContagem('COPO 550 ML BK DELIVERY CX C/1200UN', 1200), 'UND');
  });
  it('lacre é UND', () => {
    assert.equal(classificarUnidadeContagem('ETIQ LACRE DE SEGURANCA BKC', 1), 'UND');
  });
  it('carne em caixa de kg continua KG', () => {
    assert.equal(classificarUnidadeContagem('CARNE CONG MOIDA WHOPPER BK CX 17,2KG', 17.2), 'KG');
  });
  it('óleo a granel é L', () => {
    assert.equal(classificarUnidadeContagem('OLEO ESPECIAL SUPREMA BK CX 18KG', 18), 'L');
  });
  it('saquinho de batata é UND, não KG', () => {
    assert.equal(classificarUnidadeContagem('SAQUINHO DE BATATA BK 22X11FD 6000UND', 6000), 'UND');
  });
  it('saco in box de refrigerante é L, não UND', () => {
    assert.equal(classificarUnidadeContagem('FANTA GUARANA SACO IN BOX 10000ML', 10), 'L');
    assert.equal(classificarUnidadeContagem('SPRITE SEM ACUCAR SACO IN BOX 10000ML', 10), 'L');
  });
  it('bebida láctea bag é L', () => {
    assert.equal(classificarUnidadeContagem('BEBIDA LACTEA DOCE DE LEITE UHT BK CX10X2UN', 20), 'L');
    assert.equal(classificarUnidadeContagem('BEBIDA LACTEA UHT BAUNILHA BK 10 L X 2 UN', 20), 'L');
  });
  it('bebida láctea 22,2 KG dispenser continua KG', () => {
    assert.equal(classificarUnidadeContagem('BEBIDA LACTEA BAUNILHA UHT 22,2 KG DIS', 22.2), 'KG');
  });
});

describe('classificarCasoRevisaoUnidade', () => {
  it('KG/KG de copo é peça óbvia', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'COPO 550 ML BK DELIVERY CX C/1200UN',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 6,
    });
    assert.equal(r.caso, 'peca_obvia');
  });
  it('cartonagem batata KG/KG é peça óbvia', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'CART BATATA MEDIA DLV CX 500UN',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 500,
    });
    assert.equal(r.caso, 'peca_obvia');
  });
  it('pazinha KG/KG é peça óbvia', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'PAZINHA SORVETE BK CX 3000UN BRANCA',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 3000,
    });
    assert.equal(r.caso, 'peca_obvia');
  });
  it('água em fardo KG/KG é peça óbvia', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'AGUA GASEIFICADA H2OH LIMAO BK FD 12 X 500ML',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 12,
    });
    assert.equal(r.caso, 'peca_obvia');
  });
  it('lápis de cera KG/KG é peça óbvia', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'LAPIS CERA CX 12 UNIDADES',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 12,
    });
    assert.equal(r.caso, 'peca_obvia');
  });
  it('calda em balde não vira peça', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'CALDA DE PISTACHE BK Balde  1x4 kilos',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 4,
    });
    assert.equal(r.caso, 'peso_ok');
  });
  it('saco in box KG/KG não aplica como peça', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'FANTA GUARANA SACO IN BOX 10000ML',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 10,
    });
    assert.equal(r.caso, 'duvida');
    assert.equal(r.sugerida, 'L');
  });
  it('cheddar fatia KG/UND não mexe', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'QUEIJO CHEDDAR CLEAN NAC BK CX 17,66 KG',
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
    });
    assert.equal(r.caso, 'manter_kg_und');
  });
  it('filme PVC KG/KG fica em dúvida', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'FILME PELICULA PVC 1000MT 40CM WIDE',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
    });
    assert.equal(r.caso, 'duvida');
  });
  it('bebida láctea KG/KG é litro óbvio', () => {
    const r = classificarCasoRevisaoUnidade({
      descricao: 'BEBIDA LACTEA UHT BAUNILHA BK 10 L X 2 UN',
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      und_convertida: 20,
    });
    assert.equal(r.caso, 'litro_obvio');
    assert.equal(r.sugerida, 'L');
  });
});

describe('unidadeFracionadaEfetiva', () => {
  it('herda unidade_contagem quando fracionada está vazia', () => {
    assert.equal(unidadeFracionadaEfetiva(null, 'KG'), 'KG');
    assert.equal(unidadeFracionadaEfetiva('', 'UND'), 'UND');
    assert.equal(unidadeFracionadaEfetiva('UND', 'KG'), 'UND');
  });
});

describe('linhaDiffNaUnidadeDaContagem', () => {
  it('pão UND/UND permanece em peça', () => {
    const r = linhaDiffNaUnidadeDaContagem({
      sistema: 411,
      contado: 480,
      unidade_contagem: 'UND',
      unidade_fracionada: 'UND',
    });
    assert.equal(r.unidade, 'UND');
    assert.equal(r.sistema, 411);
    assert.equal(r.contado, 480);
    assert.equal(r.diff, 69);
  });

  it('cheddar KG/UND vira fatia, não 0,807 kg', () => {
    const r = linhaDiffNaUnidadeDaContagem({
      sistema: 22.887,
      contado: 22.08,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      fator_fracionada: 0.0115,
    });
    assert.equal(r.unidade, 'UND');
    assert.equal(r.diff, -70);
  });

  it('Whopper KG/UND vira hambúrguer', () => {
    const r = linhaDiffNaUnidadeDaContagem({
      sistema: 39.843,
      contado: 51.6,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      fator_fracionada: 17.2 / 152,
    });
    assert.equal(r.unidade, 'UND');
    assert.equal(r.diff, 104);
  });

  it('bacon KG/KG continua em quilo', () => {
    const r = linhaDiffNaUnidadeDaContagem({
      sistema: 16.772,
      contado: 17,
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
    });
    assert.equal(r.unidade, 'KG');
    assert.equal(r.diff, 0.228);
  });

  it('sem fator não inventa peça — mostra KG', () => {
    const r = linhaDiffNaUnidadeDaContagem({
      sistema: 22.887,
      contado: 22.08,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
    });
    assert.equal(r.unidade, 'KG');
    assert.equal(r.diff, -0.807);
  });
});

describe('calcularQtdContagem — retrocompat (fracionada = canônica)', () => {
  it('KG → KG: 2 caixas + 1,5 kg = 2×17,2 + 1,5', () => {
    const qtd = calcularQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 1.5,
      und_convertida: 17.2,
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
    });
    assert.equal(qtd, 35.9);
  });

  it('sem unidades informadas mantém a fórmula antiga', () => {
    const qtd = calcularQtdContagem({
      contagem_caixa: 2,
      contagem_pc_fd: 3,
      contagem_kg_und: 1.5,
      und_convertida: 10,
      und_parcial: 2,
    });
    assert.equal(qtd, 2 * 10 + 3 * 2 + 1.5);
  });
});

describe('resolverQtdContagem — UND avulsa → KG canônico', () => {
  it('Whopper: 2 caixas + 37 UND = 2×17,2 + 37×(17,2/152)', () => {
    const fator = 17.2 / 152;
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 37,
      und_convertida: 17.2,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      fator_fracionada: fator,
      fator_fracionada_status: 'validado',
      id_insumo: 1,
      codigo: '021403',
    });
    assert.equal(r.ok, true);
    const esperado = Math.round((2 * 17.2 + 37 * fator) * 10000) / 10000;
    assert.equal(r.qtd, esperado);
    assert.notEqual(r.qtd, 2 * 17.2 + 37);
  });

  it('unidade_entrada=KG ignora fracionada UND (32 kg = 32)', () => {
    const r = resolverQtdContagem({
      contagem_kg_und: 32,
      und_convertida: 12,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      unidade_entrada: 'KG',
      fator_fracionada: 0.09836066,
      fator_fracionada_status: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(r.qtd, 32);
  });

  it('unidade_entrada=UND converte peça → kg', () => {
    const fator = 0.09836066;
    const r = resolverQtdContagem({
      contagem_kg_und: 32,
      und_convertida: 12,
      unidade_contagem: 'KG',
      unidade_fracionada: 'KG',
      unidade_entrada: 'UND',
      fator_fracionada: fator,
      fator_fracionada_status: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(r.qtd, Math.round(32 * fator * 10000) / 10000);
  });

  it('cadastro UND com rascunho legado KG conta como peça', () => {
    const r = resolverQtdContagem({
      contagem_caixa: 3,
      contagem_kg_und: 4,
      und_convertida: 12,
      unidade_contagem: 'UND',
      unidade_fracionada: 'UND',
      unidade_entrada: 'KG',
      codigo: '35046',
    });
    assert.equal(r.ok, true);
    assert.equal(r.qtd, 40);
  });

  it('sem fator validado não assume 1 UND = 1 KG', () => {
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 37,
      und_convertida: 17.2,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      id_insumo: 9,
      codigo: '021403',
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro.motivo, MOTIVO_CONVERSAO.NAO_ENCONTRADA);
    assert.equal(r.erro.id_insumo, 9);
    assert.equal(r.erro.codigo, '021403');
    assert.equal(r.erro.unidade_origem, 'und');
    assert.equal(r.erro.unidade_destino, 'kg');
  });
});

describe('aplicarConversaoUnidades', () => {
  it('1,7 KG → 1,7 KG (identidade)', () => {
    const r = aplicarConversaoUnidades({
      quantidade: 1.7,
      unidadeOrigem: 'KG',
      unidadeDestino: 'kg',
      permitirZero: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidade, 1.7);
    assert.equal(r.origemConversao, 'identidade');
  });

  it('0 é permitido na contagem quando identidade', () => {
    const r = aplicarConversaoUnidades({
      quantidade: 0,
      unidadeOrigem: 'UND',
      unidadeDestino: 'UND',
      permitirZero: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidade, 0);
  });

  it('0 UND → L na contagem não exige fator (finalizar com sobra zerada)', () => {
    const r = aplicarConversaoUnidades({
      quantidade: 0,
      unidadeOrigem: 'UND',
      unidadeDestino: 'L',
      permitirZero: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidade, 0);
    assert.equal(r.origemConversao, 'zero');
  });
});

describe('resolverQtdContagem — bag em litros', () => {
  it('2 caixas + 0 UND sem fator = só as caixas', () => {
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 0,
      und_convertida: 10,
      unidade_contagem: 'L',
      unidade_fracionada: 'L',
      unidade_entrada: 'UND',
      codigo: 'BK-COCA-ZERO-BAG-18',
    });
    assert.equal(r.ok, true);
    assert.equal(r.qtd, 20);
  });

  it('1 bag avulso UND → L com fator da caixa', () => {
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 1,
      und_convertida: 10,
      unidade_contagem: 'L',
      unidade_fracionada: 'L',
      unidade_entrada: 'UND',
      fator_fracionada: 10,
      fator_fracionada_status: 'validado',
      codigo: 'BK-COCA-ZERO-BAG-18',
    });
    assert.equal(r.ok, true);
    assert.equal(r.qtd, 30);
  });

  it('bag avulso sem fator continua bloqueado', () => {
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 1,
      und_convertida: 10,
      unidade_contagem: 'L',
      unidade_fracionada: 'L',
      unidade_entrada: 'UND',
      codigo: 'BK-SEM-0014',
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro.motivo, MOTIVO_CONVERSAO.NAO_ENCONTRADA);
    assert.equal(r.erro.unidade_origem, 'und');
    assert.equal(r.erro.unidade_destino, 'l');
  });
});

describe('converterQuantidade — lookup em estoque_conversoes', () => {
  it('UND → KG com fator validado (Whopper)', async () => {
    const fator = 17.2 / 152;
    const client = {
      query: async () => ({
        rows: [{ fator, status: 'validado', unidade_origem: 'und' }],
      }),
    };
    const r = await converterQuantidade(client, {
      idInsumo: 10,
      codigo: '021403',
      quantidade: 37,
      unidadeOrigem: 'UND',
      unidadeDestino: 'KG',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidade, Math.round(37 * fator * 1e6) / 1e6);
    assert.equal(r.origemConversao, 'fator_validado');
  });

  it('sem linha validada retorna conversao_nao_encontrada', async () => {
    const client = { query: async () => ({ rows: [] }) };
    const r = await converterQuantidade(client, {
      idInsumo: 10,
      codigo: '021403',
      quantidade: 37,
      unidadeOrigem: 'UND',
      unidadeDestino: 'KG',
    });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, MOTIVO_CONVERSAO.NAO_ENCONTRADA);
    assert.equal(r.id_insumo, 10);
    assert.equal(r.codigo, '021403');
    assert.equal(r.unidade_origem, 'und');
    assert.equal(r.unidade_destino, 'kg');
  });
});

describe('sqlFiltroItensContagem', () => {
  it('mensal exige participa_contagem', () => {
    const sql = sqlFiltroItensContagem('completa');
    assert.match(sql, /participa_contagem/);
    assert.doesNotMatch(sql, /contagem_diaria/);
    assert.doesNotMatch(sql, /contagem_critica/);
  });

  it('diária exige participa + contagem_diaria', () => {
    const sql = sqlFiltroItensContagem('diaria');
    assert.match(sql, /participa_contagem/);
    assert.match(sql, /contagem_diaria = TRUE/);
  });

  it('semanal exige participa + contagem_critica', () => {
    const sql = sqlFiltroItensContagem('critica_semanal');
    assert.match(sql, /participa_contagem/);
    assert.match(sql, /contagem_critica = TRUE/);
  });
});

describe('statusConversaoFracionada', () => {
  it('identidade não exige fator', () => {
    assert.equal(statusConversaoFracionada('KG', 'KG', false), 'nao_aplicavel');
  });

  it('par distinto sem fator fica pendente', () => {
    assert.equal(statusConversaoFracionada('UND', 'KG', false), 'pendente');
  });

  it('par distinto com fator validado', () => {
    assert.equal(statusConversaoFracionada('UND', 'KG', true), 'validada');
  });
});

describe('validarUnidadeFracionadaCadastro', () => {
  it('identidade KG→KG passa sem banco', async () => {
    const r = await validarUnidadeFracionadaCadastro(null, {
      unidadeFracionada: 'KG',
      unidadeContagem: 'KG',
    });
    assert.equal(r.ok, true);
  });

  it('UND→KG sem conversão é bloqueado', async () => {
    const client = { query: async () => ({ rows: [] }) };
    const r = await validarUnidadeFracionadaCadastro(client, {
      idInsumo: 1,
      codigo: 'NOCONV',
      unidadeFracionada: 'UND',
      unidadeContagem: 'KG',
    });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, MOTIVO_CONVERSAO.NAO_ENCONTRADA);
  });

  it('UND→KG com fator validado passa', async () => {
    const client = {
      query: async () => ({
        rows: [{ fator: 0.0115, status: 'validado', unidade_origem: 'und' }],
      }),
    };
    const r = await validarUnidadeFracionadaCadastro(client, {
      idInsumo: 99,
      codigo: '35619',
      unidadeFracionada: 'UND',
      unidadeContagem: 'KG',
    });
    assert.equal(r.ok, true);
  });
});

describe('snapshot × saldo vivo (regra numérica)', () => {
  it('tela = contado − snapshot; ajuste = contado − vivo', () => {
    const snapshot = 50;
    const contado = 45;
    const vivo = 48;
    assert.equal(contado - snapshot, -5);
    assert.equal(contado - vivo, -3);
    assert.equal(vivo + (contado - vivo), contado);
  });
});
