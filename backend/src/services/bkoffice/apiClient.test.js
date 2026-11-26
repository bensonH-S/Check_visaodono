/**
 * Cliente da API BK Office — paginação, retry, não autorizado, idempotência.
 *   node --test src/services/bkoffice/apiClient.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CNPJ_POR_NOME,
  DATAS_REIMPORT_PADRAO,
  URL_PADRAO,
  agregarItensVendaApi,
  aplicarPlanoItens,
  classificarLojaBkOffice,
  cnpjEfetivoLoja,
  deveDispararJobDiario,
  diffReimportacao,
  executarImportacaoLojas,
  extrairPaginaVendas,
  janelaDiaCivil,
  listarVendasDia,
  montarPlanoItens,
  semToken,
} from './apiClient.js';

function resposta(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function item(codMerc, qtd, valor, desconto = 0, descricao = 'ITEM') {
  return {
    codMerc,
    qtdVendidaItem: qtd,
    valorTotalItem: valor,
    desconto,
    descricao,
  };
}

function paginaApi(listPayment, { status = true, description = 'OK' } = {}) {
  return {
    listPayment,
    transactionStatus: {
      permission: status,
      session: 'sessao-teste',
      status,
      description,
    },
  };
}

describe('janela do dia civil', () => {
  it('usa meio-dia e 15h UTC no dia D', () => {
    assert.deepEqual(janelaDiaCivil('2026-11-09'), {
      dateInt: '2026-11-09T12:00:00.000Z',
      dateEnd: '2026-11-09T15:00:00.000Z',
    });
  });
});

describe('lojas', () => {
  it('pula Popeyes e loja sem CNPJ', () => {
    const popeyes = classificarLojaBkOffice({
      id_loja: 1,
      name: 'POPYES - VALPARAÍSO',
      cnpj: '52193038000121',
    });
    assert.equal(popeyes.incluir, false);
    assert.equal(popeyes.motivo, 'popeyes');

    const sem = classificarLojaBkOffice({
      id_loja: 2,
      name: 'BURGER KING - LOJA NOVA',
      cnpj: '',
    });
    assert.equal(sem.incluir, false);
    assert.equal(sem.motivo, 'sem_cnpj');
  });

  it('Taquari entra com o CNPJ confirmado mesmo se o cadastro estiver vazio', () => {
    assert.equal(CNPJ_POR_NOME[0].cnpj, '35252660000144');
    const loja = { id_loja: 9, name: 'BURGER KING - TAQUARI', cnpj: null };
    assert.equal(cnpjEfetivoLoja(loja), '35252660000144');
    const cls = classificarLojaBkOffice(loja);
    assert.equal(cls.incluir, true);
    assert.equal(cls.cnpj, '35252660000144');
  });

  it('não troca o CNPJ já cadastrado (Ceilândia segue o da tabela)', () => {
    const loja = {
      id_loja: 3,
      name: 'BURGER KING - CEILÂNDIA',
      cnpj: '28.428.268/0001-48',
    };
    assert.equal(cnpjEfetivoLoja(loja), '28428268000148');
  });
});

describe('listarVendasDia', () => {
  it('pagina até a última página e agrega o mesmo codMerc', async () => {
    const corpos = [];
    const fetchImpl = async (url, opts) => {
      assert.equal(url, URL_PADRAO);
      assert.equal(opts.method, 'POST');
      assert.equal(opts.headers.Authorization, 'Basic token-teste');
      assert.equal(opts.headers['User-Agent'], 'grupo-alvim');
      assert.equal(opts.headers['Content-Type'], 'application/json');
      const corpo = JSON.parse(opts.body);
      corpos.push(corpo);
      if (corpo.pagination.page === '1') {
        return resposta(200, paginaApi([
          item('100', 2, 30, 1, 'WHOPPER'),
          item('200', 1, 10, 0, 'BATATA'),
        ]));
      }
      if (corpo.pagination.page === '2') {
        return resposta(200, paginaApi([item('100', 1, 15, 0.5, 'WHOPPER')]));
      }
      return resposta(200, paginaApi(null));
    };

    const r = await listarVendasDia({
      cnpj: '26.428.809/0001-02',
      data: '2026-11-09',
      token: 'token-teste',
      fetchImpl,
    });

    assert.equal(corpos.length, 3);
    assert.deepEqual(corpos[0], {
      restaurant: { cnpj: '26428809000102' },
      dateInt: '2026-11-09T12:00:00.000Z',
      dateEnd: '2026-11-09T15:00:00.000Z',
      pagination: { page: '1' },
    });
    assert.equal(typeof corpos[0].pagination.page, 'string');
    assert.equal(Object.hasOwn(corpos[0], 'pageSize'), false);
    assert.equal(corpos[1].pagination.page, '2');
    assert.equal(corpos[2].pagination.page, '3');
    assert.equal(r.paginas, 3);
    assert.equal(r.registros, 3);
    const whopper = r.itens.find((i) => i.codigo === '100');
    assert.equal(whopper.qtde, 3);
    assert.equal(whopper.venda_liquida, 45);
    assert.equal(whopper.desconto, 1.5);
    assert.equal(r.itens.length, 2);
  });

  it('repete a página em HTTP 500 e segue depois do backoff', async () => {
    let calls = 0;
    const esperas = [];
    const avisos = [];
    const fetchImpl = async (_url, opts) => {
      const corpo = JSON.parse(opts.body);
      calls += 1;
      if (corpo.pagination.page === '1' && calls < 3) return resposta(500, '<html>Akamai 500</html>');
      if (corpo.pagination.page === '1') return resposta(200, paginaApi([item('100', 4, 40, 0)]));
      return resposta(200, paginaApi([]));
    };

    const r = await listarVendasDia({
      cnpj: '26428809000102',
      data: '2026-11-11',
      token: 'segredo-super-secreto',
      fetchImpl,
      sleep: async (ms) => {
        esperas.push(ms);
      },
      log: { warn: (msg) => avisos.push(msg) },
      maxAttempts: 5,
    });

    assert.equal(calls, 4);
    assert.deepEqual(esperas, [1000, 2000]);
    assert.equal(r.itens[0].qtde, 4);
    assert.equal(avisos.length, 2);
    for (const msg of avisos) {
      assert.equal(msg.includes('segredo-super-secreto'), false);
      assert.match(msg, /HTTP 500/);
    }
  });

  it('não autorizado não entra no retry', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return resposta(200, paginaApi(null, {
        status: false,
        description: 'CNPJ INCORRETO OU USUÁRIO NÃO AUTORIZADO',
      }));
    };
    await assert.rejects(
      () =>
        listarVendasDia({
          cnpj: '28428268000148',
          data: '2026-11-09',
          token: 'token-teste',
          fetchImpl,
          sleep: async () => {
            throw new Error('não deveria esperar');
          },
        }),
      (e) => e.code === 'NAO_AUTORIZADO',
    );
    assert.equal(calls, 1);
  });

  it('esvazia o token se ele vazar na mensagem', () => {
    assert.equal(semToken('falha token-teste no header', 'token-teste'), 'falha [redacted] no header');
  });
});

describe('executarImportacaoLojas', () => {
  it('registra não autorizado e segue para as outras lojas', async () => {
    const gravados = [];
    const relatorio = await executarImportacaoLojas({
      lojas: [
        { id_loja: 1, name: 'POPYES - VALPARAÍSO', cnpj: '52193038000121', bk_number: '15022' },
        { id_loja: 2, name: 'BURGER KING - TAQUARI', cnpj: '', bk_number: '99999' },
        { id_loja: 3, name: 'BURGER KING - CEILÂNDIA', cnpj: '28428268000148', bk_number: '24820' },
        { id_loja: 4, name: 'BURGER KING - 706/7 NORTE', cnpj: '26428809000102', bk_number: '23531' },
      ],
      datas: ['2026-11-09'],
      buscarDia: async ({ loja, cnpj }) => {
        if (loja.id_loja === 3) {
          throw Object.assign(new Error('Loja não autorizada na API BK Office'), {
            code: 'NAO_AUTORIZADO',
          });
        }
        assert.equal(cnpj.length, 14);
        return [item('10', 2, 20, 1)];
      },
      onDia: async (dia) => {
        gravados.push(dia.loja.id_loja);
      },
    });

    assert.deepEqual(
      relatorio.map((r) => r.status),
      ['popeyes', 'ok', 'nao_autorizado', 'ok'],
    );
    assert.equal(relatorio[1].cnpj, '35252660000144');
    assert.equal(relatorio[2].mensagem.includes('não autorizada'), true);
    assert.deepEqual(gravados, [2, 4]);
  });

  it('token recusado interrompe o lote', async () => {
    await assert.rejects(
      () =>
        executarImportacaoLojas({
          lojas: [
            { id_loja: 4, name: 'BURGER KING - 706/7 NORTE', cnpj: '26428809000102' },
            { id_loja: 5, name: 'BURGER KING - SUDOESTE', cnpj: '26332112000133' },
          ],
          datas: ['2026-11-09'],
          buscarDia: async () => {
            throw Object.assign(new Error('API BK Office recusou a autenticação (HTTP 401)'), {
              code: 'AUTH_FALHOU',
            });
          },
        }),
      (e) => e.code === 'AUTH_FALHOU',
    );
  });
});

describe('idempotência', () => {
  it('reprocessar o mesmo dia substitui e não duplica código', () => {
    const novos = agregarItensVendaApi([
      item('100', 2, 10, 1),
      item('100', 3, 15, 0),
      item('200', 1, 8, 0),
    ]);
    let estado = [];
    estado = aplicarPlanoItens(estado, montarPlanoItens(estado, novos));
    const segunda = montarPlanoItens(estado, novos);
    const estado2 = aplicarPlanoItens(estado, segunda);

    assert.deepEqual(estado2, estado);
    assert.equal(new Set(estado.map((i) => i.codigo)).size, estado.length);
    assert.equal(estado.length, 2);
    assert.ok(segunda.every((a) => a.acao === 'atualizar' && a.deltaQ === 0));

    const reduzido = agregarItensVendaApi([item('100', 4, 20, 1)]);
    const plano = montarPlanoItens(estado, reduzido);
    assert.ok(plano.some((a) => a.codigo === '200' && (a.acao === 'zerar' || a.acao === 'apagar')));
    const estado3 = aplicarPlanoItens(estado, plano);
    assert.deepEqual(estado3.map((i) => i.codigo), ['100']);
    assert.equal(estado3[0].qtde, 4);
  });

  it('dry-run compara o bruto antigo (excel) com o novo (api)', () => {
    const diff = diffReimportacao(
      [
        { origem: 'bkoffice', codigo: '100', qtde: 10, venda_liquida: 100, desconto: 0 },
        { origem: 'bkoffice_api', codigo: '100', qtde: 12, venda_liquida: 120, desconto: 2 },
      ],
      [{ codigo: '100', qtde: 13, venda_liquida: 130, desconto: 3 }],
    );
    assert.equal(diff.antes.bruto, 120);
    assert.equal(diff.depois.bruto, 130);
    assert.equal(diff.bruto_delta, 10);
  });
});

describe('agenda e datas padrão', () => {
  it('dispara às 05:00 em São Paulo, uma vez no dia civil', () => {
    assert.equal(
      deveDispararJobDiario({ horaMinuto: '04:59', diaCivil: '2026-11-26', horario: '05:00' }),
      false,
    );
    assert.equal(
      deveDispararJobDiario({ horaMinuto: '05:00', diaCivil: '2026-11-26', horario: '05:00' }),
      true,
    );
    assert.equal(
      deveDispararJobDiario({
        horaMinuto: '05:01',
        diaCivil: '2026-11-26',
        ultimoDiaDisparado: '2026-11-26',
        horario: '05:00',
      }),
      false,
    );
  });

  it('lista as datas pedidas para a reimportação', () => {
    assert.deepEqual(DATAS_REIMPORT_PADRAO, [
      '2026-11-09',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-16',
      '2026-11-17',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]);
  });
});

describe('extrair página', () => {
  it('listPayment com itens pede a próxima página; vazio encerra', () => {
    const comItem = extrairPaginaVendas(paginaApi([item('1', 1, 1)]));
    assert.equal(comItem.temProxima, true);
    assert.equal(comItem.itens.length, 1);

    const nula = extrairPaginaVendas(paginaApi(null));
    assert.deepEqual(nula.itens, []);
    assert.equal(nula.temProxima, false);

    const vazia = extrairPaginaVendas(paginaApi([]));
    assert.equal(vazia.temProxima, false);
  });

  it('corpo sem listPayment não vira dia vazio', () => {
    assert.throws(
      () => extrairPaginaVendas({ vendasDoDia: [{ codMerc: '1' }] }),
      (e) => e.code === 'RESPOSTA_INVALIDA',
    );
  });

  it('status false com CNPJ incorreto é não autorizado', () => {
    assert.throws(
      () =>
        extrairPaginaVendas(paginaApi([{ codMerc: '1', qtdVendidaItem: 1, valorTotalItem: 1 }], {
          status: false,
          description: 'CNPJ INCORRETO OU USUÁRIO NÃO AUTORIZADO',
        })),
      (e) => e.code === 'NAO_AUTORIZADO',
    );
  });

  it('status false com outra descrição não é página vazia', () => {
    assert.throws(
      () => extrairPaginaVendas(paginaApi(null, { status: false, description: 'falha interna' })),
      (e) => e.code === 'API_RECUSADA',
    );
  });
});

describe('limite de recuperação do job', () => {
  it('não recupera o dia anterior depois do limite', () => {
    assert.equal(
      deveDispararJobDiario({ horaMinuto: '22:30', diaCivil: '2026-11-25', horario: '05:00', limite: '12:00' }),
      false,
    );
    assert.equal(
      deveDispararJobDiario({ horaMinuto: '05:01', diaCivil: '2026-11-26', horario: '05:00', limite: '12:00' }),
      true,
    );
  });
});
