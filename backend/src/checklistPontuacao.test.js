/**
 * Polaridade Sim/Não das perguntas de achado.
 *   node --test src/checklistPontuacao.test.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PADROES_SIM_INDICA_PROBLEMA_SQL,
  SQL_PONTUACAO_RESPOSTA,
  perguntaSimIndicaProblema,
  textoIndicaSimRuim,
} from './checklistPontuacao.js';
import { respostaIndicaNc } from './naoConformidadesChecklist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACHADOS = [
  'Foram observadas baratas vivas ou mortas?',
  'Evidenciou barata durante a visita?',
  'Foi identificada a revalidação de algum produto durante a visita?',
  'Foi identificada alguma oportunidade de contaminação cruzada durante a visita?',
  'Algum produto vencido foi servido ao cliente?',
  'Foi encontrado algum vencimento secundário?',
  'Há presença excessiva de moscas?',
  'Durante a visita foram identificados carros sendo colocados em espera?',
  'A pia para lavar as mãos possui alguma obstrução?',
  'Há risco de acidente visível para colaboradores ou clientes?',
  'Existe algum equipamento com defeito? Anexe foto.',
];

const CONFORMES = [
  'As tostadeiras estão em bom estado de conservação?',
  'O kit de escovas da máquina de sorvete está completo, limpo e em boas condições?',
  'A liderança executa corretamente o processo de cocção de carnes?',
  'Existe um pirômetro disponível na loja, em boas condições, com sensores de agulha e superfície?',
  'Sem achados críticos em queijo (contaminação/pontinho preto)?',
  'Todos os produtos estão dentro do prazo de validade?',
];

describe('perguntas de achado', () => {
  for (const texto of ACHADOS) {
    it(`Sim é problema: ${texto}`, () => {
      const p = { texto, sim_indica_problema: false, tipo_resposta: 'sim_nao', critica: true };
      assert.equal(textoIndicaSimRuim(texto), true);
      assert.equal(perguntaSimIndicaProblema(p), true);
      assert.equal(respostaIndicaNc(p, { resposta: 'Não' }), false);
      assert.equal(respostaIndicaNc(p, { resposta: 'Sim' }), true);
      assert.equal(respostaIndicaNc(p, { resposta: 'N/A' }), false);
    });
  }

  for (const texto of CONFORMES) {
    it(`Não é problema: ${texto}`, () => {
      const p = { texto, sim_indica_problema: false, tipo_resposta: 'sim_nao', critica: false };
      assert.equal(textoIndicaSimRuim(texto), false);
      assert.equal(perguntaSimIndicaProblema(p), false);
      assert.equal(respostaIndicaNc(p, { resposta: 'Não' }), true);
      assert.equal(respostaIndicaNc(p, { resposta: 'Sim' }), false);
    });
  }

  it('a pontuação SQL trata Não do achado como 100', () => {
    assert.match(SQL_PONTUACAO_RESPOSTA, /foi identificad/);
    assert.match(SQL_PONTUACAO_RESPOSTA, /foi servid/);
    assert.match(SQL_PONTUACAO_RESPOSTA, /r\.resposta = 'Não' THEN 100/);
  });

  it('a migration 213 repete os mesmos padrões', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '213_checklist_sim_nao_achado.sql'),
      'utf8',
    );
    for (const fonte of PADROES_SIM_INDICA_PROBLEMA_SQL) {
      assert.ok(sql.includes(fonte), `padrão ausente na migration: ${fonte}`);
    }
  });
});
