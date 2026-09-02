/**
 * Testes do motor operacional (Etapa 6) — erros de conversão e quantidade canônica.
 *   node --test src/services/estoqueMotor.test.js
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVO_CONVERSAO,
  erroConversaoOperacional,
  rotuloUnidadeOperacional,
} from './estoqueConsumo.js';
import { resolverQtdOperacionalInsumo } from './estoqueMotor.js';
import { pool } from '../db.js';

after(async () => {
  await pool.end().catch(() => {});
});

const fatCheddar = {
  id_insumo: 99,
  codigo: '35619',
  descricao: 'Cheddar',
  unidade_contagem: 'KG',
  unidade_fracionada: 'UND',
  und_convertida: 1,
  und_parcial: 1,
  permite_contagem_caixa: true,
  permite_contagem_pc_fd: true,
  permite_contagem_kg_und: true,
  fator_fracionada: 0.0115,
  fator_fracionada_status: 'validado',
};

function fatIdentidade(codigo, unidade) {
  return {
    ...fatCheddar,
    codigo,
    descricao: codigo,
    unidade_contagem: unidade,
    unidade_fracionada: unidade,
    fator_fracionada: 1,
    fator_fracionada_status: 'validado',
  };
}

describe('rotuloUnidadeOperacional', () => {
  it('normaliza UND / KG / L', () => {
    assert.equal(rotuloUnidadeOperacional('und'), 'UND');
    assert.equal(rotuloUnidadeOperacional('UN'), 'UND');
    assert.equal(rotuloUnidadeOperacional('kg'), 'KG');
    assert.equal(rotuloUnidadeOperacional('litro'), 'L');
  });
});

describe('erroConversaoOperacional', () => {
  it('HTTP 400 com conversao_nao_encontrada e unidades', () => {
    const e = erroConversaoOperacional({
      codigo: '021403',
      descricao: 'Carne Whopper',
      unidade_origem: 'und',
      unidade_destino: 'kg',
    });
    assert.equal(e.status, 400);
    assert.equal(e.motivo, MOTIVO_CONVERSAO.NAO_ENCONTRADA);
    assert.equal(e.codigo, '021403');
    assert.equal(e.unidade_origem, 'und');
    assert.equal(e.unidade_destino, 'kg');
    assert.equal(e.message, 'Falta conversão validada UND → KG para 021403');
  });
});

describe('resolverQtdOperacionalInsumo', () => {
  it('UND → UND (4 peças)', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatIdentidade('PAO', 'UND'), {
      quantidade: 4,
      unidade: 'UND',
    });
    assert.equal(r.qtd, 4);
  });

  it('KG → KG', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatIdentidade('TOMATE', 'KG'), {
      quantidade: 3,
      unidade: 'KG',
    });
    assert.equal(r.qtd, 3);
  });

  it('L → L', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatIdentidade('SUCO', 'L'), {
      quantidade: 2,
      unidade: 'L',
    });
    assert.equal(r.qtd, 2);
  });

  it('UND → KG com fator 0,0115: 2 UND = 0,023 KG', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatCheddar, { contagem_kg_und: 2 });
    assert.equal(r.qtd, 0.023);
  });

  it('20 UND empréstimo → 0,230 KG', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatCheddar, { contagem_kg_und: 20 });
    assert.equal(r.qtd, 0.23);
  });

  it('UND → KG sem fator bloqueia', async () => {
    await assert.rejects(
      () =>
        resolverQtdOperacionalInsumo(
          null,
          { ...fatCheddar, fator_fracionada: null, fator_fracionada_status: null, codigo: '021403' },
          { contagem_kg_und: 10 },
        ),
      (e) =>
        e.status === 400 &&
        e.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA &&
        String(e.message).includes('021403'),
    );
  });

  it('quantidade 2 UND consulta conversão validada', async () => {
    const client = {
      query: async () => ({
        rows: [{ fator: 0.0115, status: 'validado', unidade_origem: 'und' }],
      }),
    };
    const r = await resolverQtdOperacionalInsumo(
      client,
      { ...fatCheddar, fator_fracionada: null, fator_fracionada_status: null },
      { quantidade: 2, unidade: 'UND' },
    );
    assert.equal(r.qtd, 0.023);
    assert.equal(r.kg, 2);
  });

  it('quantidade 2 UND sem linha de conversão bloqueia', async () => {
    const client = { query: async () => ({ rows: [] }) };
    await assert.rejects(
      () =>
        resolverQtdOperacionalInsumo(
          client,
          { ...fatCheddar, fator_fracionada: null, fator_fracionada_status: null, codigo: 'NOCONV' },
          { quantidade: 2, unidade: 'UND' },
        ),
      (e) => e.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA && e.codigo === 'NOCONV',
    );
  });

  it('decimal 1,7 KG', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatIdentidade('TOMATE', 'KG'), {
      quantidade: 1.7,
      unidade: 'KG',
    });
    assert.equal(r.qtd, 1.7);
  });

  it('decimal 0,5 L', async () => {
    const r = await resolverQtdOperacionalInsumo(null, fatIdentidade('OLEO', 'L'), {
      quantidade: 0.5,
      unidade: 'L',
    });
    assert.equal(r.qtd, 0.5);
  });
});
