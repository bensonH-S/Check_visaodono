/**
 * Janela de pedido Platlog.
 *   node --test src/services/platlogJanela.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularJanelaCompra, janelaDaLoja } from './platlogJanela.js';

const ASA_SUL = {
  bk: '18915',
  loja: 'Asa Sul',
  regional: 'Fagno',
  pedido: 'Terça e Quinta',
  recebe: 'Terça e Sexta',
};

function emSP(iso, hora, minuto = 0) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hora + 3, minuto));
}

describe('janela Asa Sul', () => {
  it('terça de manhã: o pedido chega 7 dias depois, na outra terça', () => {
    const j = calcularJanelaCompra(ASA_SUL, emSP('2026-10-27', 10));
    assert.equal(j.janela_aberta, true);
    assert.equal(j.prazo_entrega_dias, 7);
    assert.equal(j.proximo_pedido, '2026-10-27');
    assert.equal(j.entrega_deste, '2026-11-03');
    assert.equal(j.entrega_seguinte, '2026-11-05');
    assert.equal(j.dias_ate_entrega_seguinte, 9);
    assert.deepEqual(
      j.pares.map((p) => `${p.pedido}->${p.entrega} ${p.lead_dias}`),
      ['terça->terça 7', 'quinta->quinta 7'],
    );
  });

  it('terça depois das 11h empurra o pedido para quinta, que chega 7 dias depois', () => {
    const j = calcularJanelaCompra(ASA_SUL, emSP('2026-10-27', 14));
    assert.equal(j.janela_aberta, false);
    assert.equal(j.proximo_pedido, '2026-10-29');
    assert.equal(j.entrega_deste, '2026-11-05');
    assert.equal(j.entrega_seguinte, '2026-11-10');
    assert.equal(j.dias_ate_entrega_seguinte, 14);
  });

  it('às 11h em ponto a janela ainda está aberta', () => {
    const j = calcularJanelaCompra(ASA_SUL, emSP('2026-10-27', 11, 0));
    assert.equal(j.janela_aberta, true);
    assert.equal(j.proximo_pedido, '2026-10-27');
  });
});

describe('agenda da loja', () => {
  it('408 Sul usa a linha da Asa Sul', () => {
    const j = janelaDaLoja({ bk: '18915', nome: 'BURGER KING - 408 SUL' }, emSP('2026-10-27', 10));
    assert.equal(j.loja, 'Asa Sul');
    assert.equal(j.dias_pedido, 'terça e quinta');
  });

  it('201 Norte não usa a linha do PLK', () => {
    const j = janelaDaLoja({ bk: '19929', nome: 'BURGER KING - 201 NORTE' }, emSP('2026-10-27', 10));
    assert.equal(j.loja, '201');
    assert.equal(j.dias_entrega, 'terça e quinta');
    assert.equal(j.prazo_entrega_dias, 7);
  });

  it('loja fora da planilha não inventa janela', () => {
    assert.equal(janelaDaLoja({ bk: '00000', nome: 'Fantasma' }), null);
  });
});
