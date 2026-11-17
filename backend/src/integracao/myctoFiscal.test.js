/**
 * API Mycto: filtros, cursor, token, cota e leitura de XML. Sem banco.
 *   node --test src/integracao/myctoFiscal.test.js
 */
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { pool } from '../db.js';
import {
  consumirCota,
  hashToken,
  limitePorMinuto,
  tokensIguais,
} from './myctoAuth.js';
import {
  classificarRef,
  cnpjsDoXml,
  decodeCursor,
  documentoDeLinha,
  encodeCursor,
  lerFiltros,
  MOTIVO_VENDA_SEM_XML,
  respostaVenda,
  temXmlNoDisco,
  xmlNoDiscoDaNota,
  xmlPareceNfe,
} from './myctoFiscal.js';
import myctoRouter from '../routes/myctoFiscal.js';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00"><NFe><infNFe Id="NFe53123456789012345678901234567890123456789012">
<emit><CNPJ>04.252.011/0001-10</CNPJ></emit>
<dest><CNPJ>00.000.000/0001-91</CNPJ></dest>
<det><prod><xProd>Pao</xProd></prod></det>
</infNFe></NFe></nfeProc>`;

after(async () => {
  await pool.end().catch(() => {});
});

describe('filtros e cursor', () => {
  it('aceita compra com período e rejeita tipo desconhecido', () => {
    const f = lerFiltros({ tipo: 'compra', de: '2026-11-01', ate: '2026-11-16', limit: '50', id_loja: '21' });
    assert.equal(f.tipo, 'compra');
    assert.equal(f.limit, 50);
    assert.equal(f.id_loja, 21);
    assert.throws(() => lerFiltros({ tipo: 'saida' }), /compra ou venda/);
    assert.throws(() => lerFiltros({ de: '01-11-2026' }), /YYYY-MM-DD/);
    assert.throws(() => lerFiltros({ de: '2026-11-20', ate: '2026-11-01' }), /maior/);
  });

  it('cursor opaco não repete o último id', () => {
    const cursor = encodeCursor('2026-11-10T18:02:11.000Z', 18420);
    const dec = decodeCursor(cursor);
    assert.equal(dec.id, 18420);
    assert.equal(dec.atualizado_em, '2026-11-10T18:02:11.000Z');
    const filtros = lerFiltros({ cursor });
    assert.equal(filtros.desde, null);
    assert.equal(filtros.desde_id, null);
    assert.equal(filtros.cursor.id, 18420);
    assert.throws(() => decodeCursor('nao-e-cursor'), /cursor inválido/);
  });

  it('data em desde vira meia-noite de São Paulo', () => {
    const f = lerFiltros({ desde: '2026-11-01' });
    assert.equal(f.desde, '2026-11-01T03:00:00.000Z');
  });

  it('chave de 44 dígitos não é tratada como id', () => {
    const chave = '53' + '1'.repeat(42);
    assert.deepEqual(classificarRef(chave), { chave, id: null });
    assert.deepEqual(classificarRef('18420'), { chave: null, id: 18420 });
    assert.throws(() => classificarRef('abc'), /chave de acesso/);
  });
});

describe('token e cota', () => {
  it('compara o hash sem exigir o texto igual na memória da tabela', () => {
    assert.equal(tokensIguais('segredo-mycto', 'segredo-mycto'), true);
    assert.equal(tokensIguais('segredo-mycto', 'outra'), false);
    assert.equal(tokensIguais('', 'x'), false);
    assert.equal(hashToken('abc'), hashToken('abc'));
    assert.equal(limitePorMinuto({ MYCTO_RATE_LIMIT_PER_MIN: '10' }), 10);
    assert.equal(limitePorMinuto({ MYCTO_RATE_LIMIT_PER_MIN: '0' }), 120);
  });

  it('barra a requisição seguinte ao estourar a janela', () => {
    const mapa = new Map();
    const a = consumirCota(mapa, 'cli', 1_000, { limite: 2, janelaMs: 60_000 });
    const b = consumirCota(mapa, 'cli', 1_100, { limite: 2, janelaMs: 60_000 });
    const c = consumirCota(mapa, 'cli', 1_200, { limite: 2, janelaMs: 60_000 });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(c.ok, false);
    assert.ok(c.retry_em_ms > 0);
    const d = consumirCota(mapa, 'cli', 61_200, { limite: 2, janelaMs: 60_000 });
    assert.equal(d.ok, true);
  });
});

describe('xml de compra', () => {
  it('lê NF-e do disco e ignora JSON no lugar do XML', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycto-nfe-'));
    const xmlPath = path.join(dir, 'nota.xml');
    const jsonPath = path.join(dir, 'pedido.json');
    fs.writeFileSync(xmlPath, XML);
    fs.writeFileSync(jsonPath, '{"chave":"x"}');

    const nota = {
      xml_path: xmlPath,
      chave: '53123456789012345678901234567890123456789012',
      id_loja: 21,
      id_nfe: 9,
      numero: '1',
      serie: '1',
      emissao: '2026-11-10',
      atualizado_em: '2026-11-10T18:02:11.000Z',
      valor_total: '10.5',
      emitente_cnpj: '',
      destinatario_cnpj: '00000000000191',
      loja: 'Asa Sul',
      bk_number: '19929',
      fornecedor: 'platlog',
    };
    assert.equal(temXmlNoDisco(nota), true);
    assert.equal(xmlPareceNfe(xmlNoDiscoDaNota(nota)), true);
    assert.equal(temXmlNoDisco({ ...nota, xml_path: jsonPath }), false);

    const doc = documentoDeLinha(nota, { temXml: true });
    assert.equal(doc.valor_total, 10.5);
    assert.equal(doc.id, '9');
    assert.equal('xml_path' in doc, false);
    assert.equal(Object.hasOwn(doc, 'xml'), false);

    const cnpjs = cnpjsDoXml(XML);
    assert.equal(cnpjs.emitente_cnpj, '04252011000110');
    assert.equal(cnpjs.destinatario_cnpj, '00000000000191');
  });

  it('venda não inventa documento', () => {
    const r = respostaVenda(lerFiltros({ tipo: 'venda', limit: '10' }));
    assert.equal(r.xml_disponivel, false);
    assert.deepEqual(r.documentos, []);
    assert.equal(r.tem_mais, false);
    assert.match(r.motivo, /NFC-e/);
    assert.equal(r.motivo, MOTIVO_VENDA_SEM_XML);
  });
});

describe('rotas HTTP', () => {
  it('recusa sem token e entrega o contrato de venda com o token da env', async () => {
    process.env.MYCTO_API_TOKEN = 'teste-mycto-token';
    const app = express();
    app.use('/auditoria/api/mycto', myctoRouter);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    const pedir = (urlPath, token) =>
      new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: urlPath,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
          (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              resolve({
                status: res.statusCode,
                body: Buffer.concat(chunks).toString('utf8'),
              });
            });
          },
        );
        req.on('error', reject);
        req.end();
      });

    try {
      const sem = await pedir('/auditoria/api/mycto/documentos-fiscais?tipo=compra');
      assert.equal(sem.status, 401);

      const venda = await pedir(
        '/auditoria/api/mycto/documentos-fiscais?tipo=venda',
        'teste-mycto-token',
      );
      assert.equal(venda.status, 200);
      const json = JSON.parse(venda.body);
      assert.equal(json.tipo, 'venda');
      assert.equal(json.xml_disponivel, false);
      assert.deepEqual(json.documentos, []);

      const ruim = await pedir('/auditoria/api/mycto/documentos-fiscais?tipo=outro', 'teste-mycto-token');
      assert.equal(ruim.status, 400);
    } finally {
      delete process.env.MYCTO_API_TOKEN;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
