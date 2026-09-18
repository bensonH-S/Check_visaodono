import { listarStatusContagemRede } from '../../services/estoqueCiclo.js';
import { chaveDedup, jaEnviou, registrarEnvio } from '../dedup.js';
import { dataHojeSp } from '../horario.js';
import { agruparPorRegional, regionaisDaLoja } from '../regiao.js';
import { bolhasContagemFaltou } from '../texto.js';
import { destinosDoRecado, enviarRecadoAlvim } from '../recado.js';
import { chavePendencia, deveFalarDeNovo, marcarCobradas, registrarDeteccao } from '../pendencia.js';
import { primeiroNome } from '../texto.js';

export async function coletarContagemFaltou() {
  const { hoje, lojas } = await listarStatusContagemRede({ tipo: 'diaria' });
  const faltou = lojas.filter((l) => l.status === 'faltou' || l.status === 'aberta');
  const itens = [];
  for (const loja of faltou) {
    itens.push({
      id_loja: Number(loja.id_loja),
      loja: loja.name,
      bk_number: loja.bk_number,
      status: loja.status,
      regionais: await regionaisDaLoja(loja.id_loja),
    });
  }
  return { hoje, itens };
}

export async function executarContagemFaltou(config, { dryRun = false, destinoOverride = null } = {}) {
  const dia = dataHojeSp();
  const { itens } = await coletarContagemFaltou();
  if (!itens.length) {
    return { ferramenta: 'contagem_faltou', enviados: 0, pendentes: 0, motivo: 'todos_contaram' };
  }

  const grupos = agruparPorRegional(itens);
  const fila = destinoOverride ? grupos.slice(0, 1) : grupos;
  let enviados = 0;
  const detalhes = [];

  for (const grupo of fila) {
    const chave = chaveDedup('contagem_faltou', [grupo.id_regiao || 0], dia);
    if (!destinoOverride && (await jaEnviou(chave))) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: 'ja_avisado_hoje' });
      continue;
    }

    const lojas = [];
    const chaves = [];
    for (const i of grupo.itens) {
      const chave = chavePendencia('contagem', [i.id_loja], dia);
      const p = await registrarDeteccao({
        chave,
        tipo: 'contagem',
        loja: i.loja,
        id_loja: i.id_loja,
        regional: primeiroNome(grupo.nome_regional),
        id_regiao: grupo.id_regiao,
        id_usuario: grupo.ids_usuario?.[0] || null,
        assunto: 'contagem diária',
        prazo: config.hora_contagem,
        dia,
        payload: { status: i.status },
      });
      chaves.push(chave);
      if (
        destinoOverride
        || deveFalarDeNovo({ estado: p.estado, primeiraVez: p.estado === 'DETECTADA' })
      ) {
        lojas.push({
          id_loja: i.id_loja,
          loja: i.loja,
          bk_number: i.bk_number,
          status: i.status,
        });
      }
    }
    if (!lojas.length) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: 'aguardando_sem_mudanca' });
      continue;
    }
    const fatos = {
      tipo: 'contagem_faltou',
      missao: 'avisar_contagem_faltou',
      regional: grupo.nome_regional,
      regiao: grupo.nome_regiao,
      ids_usuario: grupo.ids_usuario || [],
      lojas,
    };
    const destinos = destinosDoRecado(config, grupo, destinoOverride);
    if (!destinos.length) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: 'sem_regional' });
      continue;
    }

    const r = await enviarRecadoAlvim({
      config,
      destinos,
      fatos,
      fallbackBolhas: bolhasContagemFaltou({
        nomeRegional: grupo.nome_regional,
        nomeRegiao: grupo.nome_regiao,
        lojas,
      }),
      dryRun,
    });
    if (dryRun) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: true, dryRun: true, bolhas: r.bolhas });
      continue;
    }
    if (!r.ok) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: r.motivo });
      continue;
    }

    if (destinoOverride) {
      await marcarCobradas(chaves);
      enviados += 1;
      detalhes.push({
        regiao: grupo.nome_regiao,
        ok: true,
        teste: true,
        lojas: lojas.length,
        bolhas: r.bolhas?.length,
      });
      continue;
    }

    await registrarEnvio({
      chave,
      ferramenta: 'contagem_faltou',
      destino: destinos.map((d) => d.id_usuario || d).join(','),
      payload: { lojas: lojas.map((l) => l.id_loja) },
    });
    await marcarCobradas(chaves);
    enviados += 1;
    detalhes.push({ regiao: grupo.nome_regiao, ok: true, lojas: lojas.length });
  }

  return {
    ferramenta: 'contagem_faltou',
    enviados,
    pendentes: itens.length,
    detalhes,
  };
}
