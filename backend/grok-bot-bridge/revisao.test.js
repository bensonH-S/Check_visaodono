import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarRevisao, montarPrompt } from './prompt.js';

describe('revisão Grok Bot', () => {
  it('ignora quantidade nova e código que não veio na lista', () => {
    const texto = JSON.stringify({
      itens: [
        { codigo: '28582', flag: 'errado', motivo: 'Estoque alto para esse ritmo.', caixas: 99 },
        { codigo: '99999', flag: 'ajustar', motivo: 'Fora da lista.' },
        { codigo: '34580', flag: 'inventado', motivo: 'Não.' },
      ],
    });
    const marcas = interpretarRevisao(texto, ['28582', '34580']);
    assert.deepEqual(marcas, [
      { codigo: '28582', flag: 'errado', motivo: 'Estoque alto para esse ritmo.' },
    ]);
  });

  it('o prompt não pede para recalcular caixas', () => {
    const texto = montarPrompt('408 Sul', [{ codigo: '1', descricao: 'Bacon', caixas: 2, estoque: 10, unidade: 'kg', ritmo_dia: 1, cobertura_dias: 4 }]);
    assert.match(texto, /Não recalcule/);
    assert.match(texto, /28582|Bacon|caixas/);
  });
});
