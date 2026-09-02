/**
 * Testes do resolvedor de consumo (piloto de baixa).
 *   node --test src/services/estoqueConsumo.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVO_BAIXA,
  nucleoCodigoNumerico,
  normalizarUnidade,
  resolverConsumoEstoque,
} from './estoqueConsumo.js';

describe('normalizarUnidade', () => {
  it('agrupa UN / UND / peça', () => {
    assert.equal(normalizarUnidade('UN'), 'und');
    assert.equal(normalizarUnidade('und'), 'und');
    assert.equal(normalizarUnidade('peça'), 'und');
  });
  it('agrupa KG', () => {
    assert.equal(normalizarUnidade('KG'), 'kg');
    assert.equal(normalizarUnidade('kilo'), 'kg');
  });
});

describe('resolverConsumoEstoque — cheddar', () => {
  it('2 UN × 0,0115 kg = 0,023 kg por produto', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'und',
      unidadeEstoque: 'KG',
      fatorConversao: 0.0115,
      fatorStatus: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.023);
    assert.equal(r.origemConversao, 'fator_validado');
  });

  it('10 Whoppers = -0,230 kg', () => {
    const porProduto = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'UN',
      unidadeEstoque: 'kg',
      fatorConversao: 0.0115,
      fatorStatus: 'validado',
    });
    assert.equal(porProduto.ok, true);
    const baixa = Math.round(10 * porProduto.quantidadeEstoque * 1e6) / 1e6;
    assert.equal(baixa, 0.23);
  });
});

describe('resolverConsumoEstoque — KG → KG', () => {
  it('0,014 KG permanece 0,014 (bacon)', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 0.014,
      unidadeReceita: 'kg',
      unidadeEstoque: 'KG',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.014);
    assert.equal(r.origemConversao, 'identidade');
  });

  it('não usa fator quando as unidades já batem', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 0.014,
      unidadeReceita: 'kg',
      unidadeEstoque: 'kg',
      fatorConversao: 99,
      fatorStatus: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.014);
  });
});

describe('resolverConsumoEstoque — g → KG (SI)', () => {
  it('14 g = 0,014 kg sem cadastro de fator', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 14,
      unidadeReceita: 'g',
      unidadeEstoque: 'KG',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.014);
    assert.equal(r.origemConversao, 'si');
  });
});

describe('resolverConsumoEstoque — UN → UND', () => {
  it('1 UN com estoque UND = 1; 10 vendas = 10', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 1,
      unidadeReceita: 'un',
      unidadeEstoque: 'UND',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 1);
    assert.equal(Math.round(10 * r.quantidadeEstoque), 10);
  });
});

describe('resolverConsumoEstoque — conversão ausente', () => {
  it('2 UN → KG sem fator não baixa e não assume 2 KG', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'und',
      unidadeEstoque: 'KG',
    });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA);
    assert.equal(r.quantidadeEstoque, undefined);
  });

  it('fator pendente também bloqueia', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'und',
      unidadeEstoque: 'kg',
      fatorConversao: 0.0115,
      fatorStatus: 'pendente',
    });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA);
  });

  it('fator bloqueado', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'und',
      unidadeEstoque: 'kg',
      fatorConversao: 0.0115,
      fatorStatus: 'bloqueado',
    });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, MOTIVO_BAIXA.CONVERSAO_BLOQUEADA);
  });
});

describe('nucleoCodigoNumerico — Excel come zero', () => {
  it('034754 e 34754 são o mesmo núcleo', () => {
    assert.equal(nucleoCodigoNumerico('034754'), '34754');
    assert.equal(nucleoCodigoNumerico('34754'), '34754');
    assert.equal(nucleoCodigoNumerico('036252'), '36252');
  });
  it('não mexe em código com letra ou hífen', () => {
    assert.equal(nucleoCodigoNumerico('35205-2'), null);
    assert.equal(nucleoCodigoNumerico('ABC'), null);
  });
});

describe('fatores NF + ficha', () => {
  it('nugget: 10 UN × 12kg/588 = 0,20408 kg', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 10,
      unidadeReceita: 'und',
      unidadeEstoque: 'KG',
      fatorConversao: 12 / 588,
      fatorStatus: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(Math.round(r.quantidadeEstoque * 1e5) / 1e5, 0.20408);
  });

  it('chicken jr: 1 UN × 9,88kg/152 = 0,065 kg', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 1,
      unidadeReceita: 'und',
      unidadeEstoque: 'KG',
      fatorConversao: 9.88 / 152,
      fatorStatus: 'validado',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.065);
  });
});

describe('nunca UN = KG', () => {
  it('qtde_estoque cru não entra nesta função — 2 und não vira 2 kg', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 2,
      unidadeReceita: 'und',
      unidadeEstoque: 'kg',
      fatorConversao: null,
    });
    assert.equal(r.ok, false);
  });
});

describe('resolverConsumoEstoque — L → L', () => {
  it('0,5 L permanece 0,5', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 0.5,
      unidadeReceita: 'L',
      unidadeEstoque: 'l',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 0.5);
    assert.equal(r.origemConversao, 'identidade');
  });
});

describe('resolverConsumoEstoque — decimal KG', () => {
  it('1,7 KG permanece 1,7', () => {
    const r = resolverConsumoEstoque({
      quantidadeReceita: 1.7,
      unidadeReceita: 'KG',
      unidadeEstoque: 'kg',
    });
    assert.equal(r.ok, true);
    assert.equal(r.quantidadeEstoque, 1.7);
  });
});
