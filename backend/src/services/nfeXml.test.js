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
});
