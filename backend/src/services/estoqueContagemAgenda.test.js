import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agendaContagem } from './estoqueContagemAgenda.js';

function emSp(y, m, d, hora = 12) {
  return new Date(Date.UTC(y, m - 1, d, hora + 3, 0, 0));
}

describe('agenda da contagem', () => {
  it('quinta não é segunda nem dia 1: só a diária, mensal fechada', () => {
    const a = agendaContagem(emSp(2026, 10, 29));
    assert.equal(a.diaria, true);
    assert.equal(a.semanal, false);
    assert.equal(a.mensal, false);
    assert.equal(a.tipo, 'diaria');
  });

  it('segunda que não é dia 1: só a semanal', () => {
    const a = agendaContagem(emSp(2026, 11, 2));
    assert.equal(a.segunda, true);
    assert.equal(a.dia1, false);
    assert.equal(a.diaria, false);
    assert.equal(a.semanal, true);
    assert.equal(a.mensal, false);
    assert.equal(a.tipo, 'critica_semanal');
  });

  it('dia 1 que não é segunda: diária e semanal desligadas, mensal disponível', () => {
    const a = agendaContagem(emSp(2026, 11, 1));
    assert.equal(a.dia1, true);
    assert.equal(a.segunda, false);
    assert.equal(a.diaria, false);
    assert.equal(a.semanal, false);
    assert.equal(a.mensal, true);
    assert.equal(a.tipo, 'completa');
  });

  it('dia 1 que cai na segunda: a mensal fica, a semanal não abre', () => {
    const a = agendaContagem(emSp(2026, 6, 1));
    assert.equal(a.dia1, true);
    assert.equal(a.segunda, true);
    assert.equal(a.diaria, false);
    assert.equal(a.semanal, false);
    assert.equal(a.mensal, true);
  });
});
