/**
 * Casamento NF × insumo não pode inventar produto por cor.
 *   node --test src/services/nfeXml.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { casarItensNfe } from './nfeXml.js';

const cesto = {
  id_insumo: 38112,
  codigo: '38112',
  descricao: 'CESTO PARA PAO PRETO UM',
  und_convertida: 1,
};

const batata = {
  id_insumo: 10,
  codigo: '21055',
  descricao: 'BATATA PRE FRITA',
  und_convertida: 1,
};

function item(descricao, codigo = '999') {
  return { codigo, ean: '', descricao, uCom: 'PC', qCom: 1, vUnCom: 10, vProd: 10 };
}

describe('casarItensNfe', () => {
  it('não casa uniforme preto com cesto de pão', () => {
    const linhas = casarItensNfe(
      [
        item('CAMISETA POLO UNISSEX - PRETO - M', '101017151'),
        item('CINTO PROFISSIONAL - PRETO - G', '101017564'),
        item('CALCA PROFISSIONAL MASCULINA - PRETO - G', '101003632'),
        item('CABO 450/750V FLEX 1,5 MM PRETO - CARRETEL', '53622'),
      ],
      [cesto, batata],
    );
    for (const ln of linhas) assert.equal(ln.match, null);
  });

  it('mantém o cesto quando a nota realmente traz cesto', () => {
    const [ln] = casarItensNfe([item('CESTO PARA PAO PRETO UM', '38112')], [cesto, batata]);
    assert.equal(ln.match.id_insumo, 38112);
  });

  it('mantém casamento de produto por nome, mesmo com cor no texto', () => {
    const [ln] = casarItensNfe([item('BATATA CONG PRE FRITA MCCAIN NV', '1')], [cesto, batata]);
    assert.equal(ln.match.id_insumo, 10);
    assert.equal(ln.match_tipo, 'descricao_parcial');
  });

  it('casa código de NF trocado pelo fornecedor via alias NF: com fator da caixa', () => {
    const paoBk5 = { id_insumo: 9207, codigo: '034754', descricao: 'PAO BK 5 CL CXG CONG 10500G UNB', und_convertida: 120, aliases_nf: ['039141'] };
    const chicken = { id_insumo: 9509, codigo: '031777', descricao: 'CHICKEN JR CLEAN BK', und_convertida: 9.88, aliases_nf: ['036204'] };
    const [p, c] = casarItensNfe(
      [
        { codigo: '039141', ean: '', descricao: 'PAO CONG BK5 TESTE CX 120UN', uCom: 'cx', qCom: 4, vUnCom: 130, vProd: 520 },
        { codigo: '036204', ean: '', descricao: 'CHICKEN JR SEARA BK CX 9,88 KG', uCom: 'cx', qCom: 2, vUnCom: 170, vProd: 340 },
      ],
      [cesto, batata, paoBk5, chicken],
    );
    assert.equal(p.match.id_insumo, 9207);
    assert.equal(p.match_tipo, 'codigo_alias');
    assert.equal(p.sugerido.qtd_estoque, 480);
    assert.equal(c.match.id_insumo, 9509);
    assert.equal(c.match_tipo, 'codigo_alias');
    assert.equal(c.sugerido.qtd_estoque, 19.76);
  });

  it('código exato do catálogo vence o alias NF:', () => {
    const proprio = { id_insumo: 20624, codigo: '039141', descricao: 'PAO BK5 TESTE', und_convertida: 120 };
    const paoBk5 = { id_insumo: 9207, codigo: '034754', descricao: 'PAO BK 5', und_convertida: 120, aliases_nf: ['039141'] };
    const [ln] = casarItensNfe([{ codigo: '039141', ean: '', descricao: 'PAO CONG BK5 TESTE CX 120UN', uCom: 'cx', qCom: 1, vUnCom: 1, vProd: 1 }], [paoBk5, proprio]);
    assert.equal(ln.match.id_insumo, 20624);
    assert.equal(ln.match_tipo, 'codigo');
  });

  it('sem alias NF: o comportamento antigo não muda', () => {
    const [ln] = casarItensNfe([item('CAMISETA POLO UNISSEX - PRETO - M', '039141')], [cesto, batata]);
    assert.equal(ln.match, null);
  });
});
