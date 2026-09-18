/**
 * Agente Alvim — templates, janela SP, contrato financeiro.
 *   node --test src/agenteAlvim/agenteAlvim.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chaveDedup } from './dedup.js';
import {
  dentroJanela,
  jaPassouHora,
  parseHora,
  segundaFeiraDaSemanaSp,
  weekdaySp,
} from './horario.js';
import { agruparPorRegional } from './regiao.js';
import {
  fmtQtdZap,
  juntarNomesPt,
  nomeItemCurto,
  nomeLojaCurto,
  parseMsgsJson,
  primeiroNome,
  templateContagemFaltou,
  templateEscalaSemana,
  templateEstoqueZero,
} from './texto.js';
import { destinosDoRecado } from './recado.js';
import { chaveLoja, mesmoNomeLoja } from './operacao.js';
import { extractInboundFromWppWebhook } from './conversa.js';
import { classificarNomeGrupo } from './grupos.js';
import {
  decidirAposConferir,
  deveFalarDeNovo,
  ESTADOS,
  pareceAfirmacaoResolucao,
  podeTransitar,
} from './pendencia.js';
import { conferirPagamentos, mesaFinanceiroLigada } from './tools/conferirPagamentos.js';
import { aiEnabled, aiModel, aiProvider } from './llm.js';
import { destinoEhGrupo } from './whatsapp.js';

describe('chaveDedup', () => {
  it('monta loja+item+dia', () => {
    assert.equal(chaveDedup('estoque_zero', [21, '034754'], '2026-09-16'), 'estoque_zero:21:034754:2026-09-16');
  });
});

describe('janela SP', () => {
  it('parseHora lê HH:MM', () => {
    assert.deepEqual(parseHora('07:30:00'), { hora: 7, minuto: 30 });
  });

  it('segunda-feira da semana de uma quarta', () => {
    const qua = new Date('2026-09-16T15:00:00-03:00');
    assert.equal(segundaFeiraDaSemanaSp(qua), '2026-09-14');
    assert.equal(weekdaySp(qua), 3);
  });

  it('dentro da janela em dia útil', () => {
    const cfg = { horario_inicio: '07:00', horario_fim: '22:00', dias_ativos: [1, 2, 3, 4, 5, 6] };
    const meio = new Date('2026-09-16T12:00:00-03:00');
    const madrugada = new Date('2026-09-16T03:00:00-03:00');
    const domingo = new Date('2026-09-13T12:00:00-03:00');
    assert.equal(dentroJanela(cfg, meio), true);
    assert.equal(dentroJanela(cfg, madrugada), false);
    assert.equal(dentroJanela(cfg, domingo), false);
  });

  it('já passou a hora da contagem', () => {
    const onze = new Date('2026-09-16T11:05:00-03:00');
    const dez = new Date('2026-09-16T10:00:00-03:00');
    assert.equal(jaPassouHora('11:00', onze), true);
    assert.equal(jaPassouHora('11:00', dez), false);
  });
});

describe('texto Alvim', () => {
  it('estoque avisa item zerado por loja, em bolhas', () => {
    const t = templateEstoqueZero({
      nomeRegional: 'Igor Costa',
      lojas: [
        {
          loja: 'BK Terraço',
          itens: [{ descricao: 'BATATA PALITO', quantidade: 0, unidade: 'KG' }],
        },
      ],
    });
    assert.match(t, /Igor/);
    assert.match(t, /item zerado/);
    assert.match(t, /BK Terraço/);
    assert.match(t, /Batata Palito/);
    assert.doesNotMatch(t, /BATATA PALITO/);
    assert.doesNotMatch(t, /Favor regularizar/);
  });

  it('contagem avisa lojas que não contaram', () => {
    const t = templateContagemFaltou({
      nomeRegional: 'Marina',
      nomeRegiao: 'Asa Norte',
      lojas: [{ loja: 'BK Terraço' }, { loja: 'BK 408 Sul' }],
    });
    assert.match(t, /Marina/);
    assert.match(t, /ainda não contou/);
    assert.match(t, /BK Terraço/);
    assert.match(t, /BK 408 Sul/);
  });

  it('escala junta técnicos por região', () => {
    const t = templateEscalaSemana({
      semanaInicio: '2026-09-14',
      semanaFim: '2026-09-20',
      grupos: [
        { nome_regiao: 'Asa Norte', nome_regional: 'Igor', tecnicos: ['Carlos Silva', 'Ana Souza'] },
      ],
    });
    assert.match(t, /14\/09\/2026/);
    assert.match(t, /Asa Norte/);
    assert.match(t, /Carlos e Ana/);
  });

  it('juntarNomesPt', () => {
    assert.equal(primeiroNome('Benson Henrique'), 'Benson');
    assert.equal(juntarNomesPt(['A', 'B', 'C']), 'A, B e C');
  });

  it('encurta loja e arredonda saldo', () => {
    assert.equal(nomeLojaCurto('BURGER KING - CALDAS NOVAS'), 'BK Caldas Novas');
    assert.equal(nomeLojaCurto('BK Ponte Alta'), 'BK Ponte Alta');
    assert.equal(nomeLojaCurto('Samambaia'), 'BK Samambaia');
    assert.equal(mesmoNomeLoja('BK Samambaia', 'fiz a contagem de samambaia'), true);
    assert.equal(chaveLoja('BK 201 Norte'), '201norte');
    assert.equal(fmtQtdZap(-17.228, 'KG'), '-17 KG');
    assert.equal(fmtQtdZap(-13, 'UND'), '-13 UND');
    assert.equal(fmtQtdZap(-0.028, 'KG'), '0 KG');
  });

  it('encurta item sem caixa alta nem cx', () => {
    assert.equal(nomeItemCurto('PAO BK SUPREMO CLEAN LABEL CX COM 180 UND'), 'Pão Supremo');
    assert.equal(nomeItemCurto('CHICKEN NUGGETS CLEAN BK CX 12 KG'), 'Chicken Nuggets');
  });

  it('parseia bolhas JSON do modelo', () => {
    const msgs = parseMsgsJson('{"msgs":["Barbara, tem item zerado","Caldas Novas — carne HB"]}');
    assert.equal(msgs.length, 2);
    assert.match(msgs[0], /Barbara/);
  });
});

describe('agruparPorRegional', () => {
  it('um recado por região', () => {
    const grupos = agruparPorRegional([
      {
        loja: 'A',
        regionais: [{ id_regiao: 1, nome_regiao: 'Norte', id_usuario: 10, nome_regional: 'Igor' }],
      },
      {
        loja: 'B',
        regionais: [{ id_regiao: 1, nome_regiao: 'Norte', id_usuario: 10, nome_regional: 'Igor' }],
      },
    ]);
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].itens.length, 2);
    assert.deepEqual(grupos[0].ids_usuario, [10]);
  });
});

describe('mesa financeiro', () => {
  it('nasce desligada e não inventa linha', async () => {
    assert.equal(mesaFinanceiroLigada({ mesa_financeiro: false }), false);
    const { executarMesaFinanceiro } = await import('./tools/conferirPagamentos.js');
    const off = await executarMesaFinanceiro({ mesa_financeiro: false });
    assert.equal(off.motivo, 'mesa_financeiro_desligada');
    const r = await conferirPagamentos({ linhas: [{ valor: 1 }] });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, 'aguardando_planilha');
    assert.deepEqual(r.duplicados, []);
  });
});

describe('whatsapp destino', () => {
  it('reconhece grupo @g.us', () => {
    assert.equal(destinoEhGrupo('120363@g.us'), true);
    assert.equal(destinoEhGrupo('5561999999999'), false);
  });

  it('manda no grupo da liderança quando configurado', () => {
    const dest = destinosDoRecado(
      { grupo_whatsapp: '120363@g.us' },
      { ids_usuario: [10] },
      null,
    );
    assert.deepEqual(dest, ['120363@g.us']);
  });
});

describe('webhook inbound', () => {
  it('pega o autor no grupo e responde no chat do grupo', () => {
    const inbound = extractInboundFromWppWebhook({
      isGroupMsg: true,
      chatId: '120363@g.us',
      author: '5561991094654@c.us',
      from: '120363@g.us',
      body: 'Foi entregue a Stefany!',
      notifyName: 'Plinio Mota',
      fromMe: false,
    });
    assert.equal(inbound.isGroup, true);
    assert.equal(inbound.chatId, '120363@g.us');
    assert.match(inbound.from, /5561991094654/);
    assert.match(inbound.body, /Stefany/);
    assert.equal(inbound.nomePessoa, 'Plinio Mota');
  });

  it('pega DM do get-messages do wppconnect', () => {
    const inbound = extractInboundFromWppWebhook({
      id: { fromMe: false, remote: '5561991094654@c.us', _serialized: 'false_5561991094654@c.us_ABC' },
      fromMe: false,
      from: '5561991094654@c.us',
      to: '5511999999999@c.us',
      body: 'ja fiz a contagem de samambaia',
      notifyName: 'Benson',
      t: 1789687719,
    });
    assert.equal(inbound.fromMe, false);
    assert.equal(inbound.isGroup, false);
    assert.match(inbound.from, /5561991094654/);
    assert.match(inbound.body, /contagem/);
    assert.equal(inbound.nomePessoa, 'Benson');
  });

  it('serializa Wid do wppconnect no from', () => {
    const inbound = extractInboundFromWppWebhook({
      fromMe: false,
      from: { user: '5561991094654', server: 'c.us' },
      to: { user: '5511999999999', server: 'c.us' },
      body: 'ja fiz a contagem de samambaia',
      notifyName: 'Benson',
      t: 1789687719,
    });
    assert.equal(inbound.fromMe, false);
    assert.match(inbound.from, /5561991094654/);
    assert.match(inbound.chatId, /5561991094654/);
  });
});

describe('grupos Zap', () => {
  it('reconhece Liderança, Gestores e Região TI pelo nome', () => {
    assert.equal(classificarNomeGrupo('LIDERANÇA').tipo, 'lideranca');
    assert.equal(classificarNomeGrupo('GA * GESTORES').tipo, 'gestores');
    const r = classificarNomeGrupo('Região Bárbara - Projetos de TI');
    assert.equal(r.tipo, 'regiao');
    assert.equal(r.regional, 'barbara');
  });
});

describe('pendência operacional', () => {
  it('reconhece “já finalizou” e não trata como resolvido sozinho', () => {
    assert.equal(pareceAfirmacaoResolucao('Samambaia está finalizado'), true);
    assert.equal(pareceAfirmacaoResolucao('fiz a contagem de samambaia'), true);
    assert.equal(pareceAfirmacaoResolucao('já contei'), true);
    assert.equal(pareceAfirmacaoResolucao('Todos subiram!'), true);
    assert.equal(pareceAfirmacaoResolucao('bom dia'), false);
    assert.equal(decidirAposConferir({ sistemaStatus: 'aberta' }), ESTADOS.AGUARDANDO);
    assert.equal(decidirAposConferir({ sistemaStatus: 'contou' }), ESTADOS.RESOLVIDA);
  });

  it('não cobra de novo se já está aguardando e nada mudou', () => {
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.AGUARDANDO }), false);
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.COBRADA }), false);
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.DETECTADA }), true);
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.AGUARDANDO, afirmacao: true, mudou: false }), false);
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.AGUARDANDO, afirmacao: true, primeiraVez: true }), true);
    assert.equal(deveFalarDeNovo({ estado: ESTADOS.AGUARDANDO, afirmacao: true, mudou: true }), true);
    assert.equal(pareceAfirmacaoResolucao('opa, já fiz finalizada'), true);
    assert.equal(podeTransitar(ESTADOS.CONFERINDO, ESTADOS.AGUARDANDO), true);
    assert.equal(podeTransitar(ESTADOS.RESOLVIDA, ESTADOS.COBRADA), false);
  });
});

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('llm', () => {
  it('desligado quando AI_ENABLED=false', () => {
    withEnv({ AI_ENABLED: 'false', GEMINI_API_KEY: 'x', OPENAI_API_KEY: 'y' }, () => {
      assert.equal(aiEnabled(), false);
    });
  });

  it('usa o modelo salvo no config', () => {
    withEnv(
      {
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_MODEL: 'gpt-4o-mini',
        GEMINI_API_KEY: undefined,
      },
      () => {
        assert.equal(aiModel('gpt-4o'), 'gpt-4o');
        assert.equal(aiModel(), 'gpt-4o-mini');
      },
    );
  });

  it('liga com GEMINI_API_KEY', () => {
    withEnv(
      {
        AI_ENABLED: undefined,
        GEMINI_API_KEY: 'test-key',
        GOOGLE_API_KEY: undefined,
        GOOGLE_GEMINI_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
        AI_PROVIDER: undefined,
        AI_MODEL: undefined,
        GEMINI_MODEL: undefined,
      },
      () => {
        assert.equal(aiEnabled(), true);
        assert.equal(aiProvider(), 'gemini');
        assert.equal(aiModel(), 'gemini-3.7-flash');
      },
    );
  });
});
