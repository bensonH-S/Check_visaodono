// v3.1.161 — o boot não pode religar o piloto de baixa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { garantirSchemaPilotoBaixa, _resetSchemaPilotoParaTeste } from "./estoqueConsumo.js";

function fakeClient() {
  const sqls = [];
  return { sqls, query: async (sql) => { sqls.push(String(sql)); return { rows: [], rowCount: 0 }; } };
}

test("seed do perfil não força piloto_baixa=TRUE em lojas existentes", async () => {
  _resetSchemaPilotoParaTeste();
  const c = fakeClient();
  await garantirSchemaPilotoBaixa(c);
  const seed = c.sqls.find((s) => /INSERT INTO lojas_estoque_perfil/.test(s));
  assert.ok(seed, "seed do perfil deve existir");
  assert.match(seed, /ON CONFLICT \(id_loja\) DO NOTHING/);
  assert.doesNotMatch(seed, /SET\s+piloto_baixa\s*=\s*TRUE/i);
  assert.match(seed, /SELECT l\.id_loja, FALSE/);
  for (const s of c.sqls) assert.doesNotMatch(s, /UPDATE\s+lojas_estoque_perfil\s+SET\s+piloto_baixa\s*=\s*TRUE/i);
});

test("seed roda uma vez por processo", async () => {
  _resetSchemaPilotoParaTeste();
  const c = fakeClient();
  await garantirSchemaPilotoBaixa(c);
  const n = c.sqls.length;
  await garantirSchemaPilotoBaixa(c);
  assert.equal(c.sqls.length, n);
});
