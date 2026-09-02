/**
 * Motor de conversão da contagem (Etapa 1).
 *   node --test src/services/estoqueContagem.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQtdContagem,
  resolverQtdContagem,
  sqlFiltroItensContagem,
  statusConversaoFracionada,
  unidadeFracionadaEfetiva,
  validarUnidadeFracionadaCadastro,
} from './estoqueContagem.js';
import {
  MOTIVO_CONVERSAO,
  aplicarConversaoUnidades,
  converterQuantidade,
} from './estoqueConsumo.js';

describe('unidadeFracionadaEfetiva', () => {
  it('herda unidade_contagem quando fracionada está vazia', () => {
    assert.equal(unidadeFracionadaEfetiva(null, 'KG'), 'KG');
    assert.equal(unidadeFracionadaEfetiva('', 'UND'), 'UND');
    assert.equal(unidadeFracionadaEfetiva('UND', 'KG'), 'UND');
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
