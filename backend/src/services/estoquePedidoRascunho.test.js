/**
 * Rascunho de abastecimento — ritmo, caixas e teto de CMP.
 *   node --test src/services/estoquePedidoRascunho.test.js
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarTetoCmp,
  caixasParaCobrir,
  lojaForaDoPilotoPedido,
  ritmoBlend,
} from './estoquePedidoRascunho.js';
import { pool } from '../db.js';

after(async () => {
  await pool.end().catch(() => {});
});

describe('ritmoBlend', () => {
  it('mistura atual, 3 meses e ano passado', () => {
    const r = ritmoBlend({
      qAtual: 70,
      diasAtual: 7,
      q3m: 900,
      dias3m: 90,
      qAno: 140,
      diasAno: 7,
    });
    assert.equal(r.ritmo, 10 * 0.5 + 10 * 0.3 + 20 * 0.2);
    assert.equal(r.pesos.atual, 0.5);
  });

  it('item sem venda recente não volta por causa do ano passado', () => {
    const r = ritmoBlend({ qAtual: 0, q3m: 0, qAno: 100, diasAno: 7 });
    assert.equal(r.ritmo, 0);
  });

  it('renormaliza quando falta o ano passado', () => {
    const r = ritmoBlend({ qAtual: 70, diasAtual: 7, q3m: 900, dias3m: 90, qAno: 0 });
    assert.ok(Math.abs(r.ritmo - (10 * 0.5 + 10 * 0.3) / 0.8) < 1e-9);
  });
});

describe('caixasParaCobrir', () => {
  it('desconta saldo e nota a caminho', () => {
    const r = caixasParaCobrir({
      ritmo: 10,
      diasCobertura: 8,
      saldo: 20,
      aCaminho: 30,
      undConvertida: 10,
    });
    assert.equal(r.necessidade, 30);
    assert.equal(r.caixas, 3);
  });

  it('não pede quando a cobertura já fecha', () => {
    const r = caixasParaCobrir({
      ritmo: 5,
      diasCobertura: 8,
      saldo: 50,
      aCaminho: 0,
      undConvertida: 10,
    });
    assert.equal(r.caixas, 0);
  });
});

describe('aplicarTetoCmp', () => {
  it('corta primeiro quem tem mais cobertura', () => {
    const { itens, restante } = aplicarTetoCmp(
      [
        { codigo: 'A', caixas: 2, preco_caixa: 100, cobertura_dias: 1 },
        { codigo: 'B', caixas: 4, preco_caixa: 100, cobertura_dias: 12 },
      ],
      300,
    );
    const a = itens.find((i) => i.codigo === 'A');
    const b = itens.find((i) => i.codigo === 'B');
    assert.equal(a.caixas_pedidas, 2);
    assert.equal(a.cortado, false);
    assert.equal(b.caixas_pedidas, 1);
    assert.equal(b.motivo, 'teto_cmp');
    assert.equal(restante, 0);
  });

  it('zera o pedido quando o mês já estourou o teto', () => {
    const { itens } = aplicarTetoCmp(
      [{ codigo: 'A', caixas: 10, preco_caixa: 50, cobertura_dias: 0 }],
      0,
    );
    assert.equal(itens[0].caixas_pedidas, 0);
    assert.equal(itens[0].cortado, true);
  });
});

describe('lojaForaDoPilotoPedido', () => {
  it('segura 706 e Venâncio', () => {
    assert.equal(lojaForaDoPilotoPedido({ bk: '23531' }).nome, '706');
    assert.equal(lojaForaDoPilotoPedido({ esupri: '3375001' }).nome, 'Venâncio');
    assert.equal(lojaForaDoPilotoPedido({ nome: 'BK ASA SUL' }), null);
  });
});
