import { pool } from '../../db.js';
import { formatarDataBr, segundaFeiraDaSemana } from '../../escalaVisitas.js';
import { garantirSchemaManutencao } from '../../escalaManutencao.js';
import { chaveDedup, jaEnviou, registrarEnvio } from '../dedup.js';
import { segundaFeiraDaSemanaSp } from '../horario.js';
import { bolhasEscalaSemana } from '../texto.js';
import { enviarRecadoAlvim } from '../recado.js';

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function coletarEscalaSemana({ semanaInicio } = {}) {
  await garantirSchemaManutencao();
  const inicio = semanaInicio
    ? segundaFeiraDaSemana(semanaInicio)
    : segundaFeiraDaSemanaSp();
  const fim = addDaysIso(inicio, 6);

  const { rows } = await pool.query(
    `
    SELECT
      u.id_usuario,
      u.nome AS nome_tecnico,
      MIN(r.id_regiao) AS id_regiao,
      MIN(r.nome) AS nome_regiao,
      MIN(ur.nome) AS nome_regional
    FROM escala_manutencao_visita v
    JOIN usuarios u ON u.id_usuario = v.id_usuario AND u.ativo = TRUE
    LEFT JOIN frota_regiao_tecnicos rt ON rt.id_usuario = u.id_usuario
    LEFT JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
    LEFT JOIN usuarios ur ON ur.id_usuario = r.id_regional
    WHERE v.data >= $1::date AND v.data <= $2::date
    GROUP BY u.id_usuario, u.nome
    ORDER BY MIN(r.nome) NULLS LAST, u.nome
    `,
    [inicio, fim],
  );

  const porRegiao = new Map();
  for (const r of rows) {
    const nomeRegiao = r.nome_regiao || 'Sem região';
    const key = `${r.id_regiao || 0}:${nomeRegiao}`;
    if (!porRegiao.has(key)) {
      porRegiao.set(key, {
        id_regiao: r.id_regiao ? Number(r.id_regiao) : 0,
        nome_regiao: nomeRegiao,
        nome_regional: r.nome_regional || null,
        tecnicos: [],
      });
    }
    porRegiao.get(key).tecnicos.push(r.nome_tecnico);
  }

  return {
    semana_inicio: inicio,
    semana_fim: fim,
    grupos: [...porRegiao.values()],
  };
}

export async function executarEscalaSemana(config, { dryRun = false, destinoOverride = null } = {}) {
  const grade = await coletarEscalaSemana();
  if (!grade.grupos.length) {
    return { ferramenta: 'escala_semana', enviados: 0, motivo: 'grade_vazia' };
  }

  const chave = chaveDedup('escala_semana', [grade.semana_inicio], grade.semana_inicio);
  if (!destinoOverride && (await jaEnviou(chave))) {
    return { ferramenta: 'escala_semana', enviados: 0, motivo: 'ja_enviada_semana' };
  }

  const fatos = {
    tipo: 'escala_semana',
    missao: 'avisar_escala_semana',
    semana_inicio: formatarDataBr(grade.semana_inicio),
    semana_fim: formatarDataBr(grade.semana_fim),
    grupos: grade.grupos,
  };
  const destino = destinoOverride || config.grupo_whatsapp;
  if (!destino) {
    return { ferramenta: 'escala_semana', enviados: 0, motivo: 'sem_grupo_whatsapp' };
  }

  const r = await enviarRecadoAlvim({
    config,
    destinos: [destino],
    fatos,
    fallbackBolhas: bolhasEscalaSemana({
      semanaInicio: grade.semana_inicio,
      semanaFim: grade.semana_fim,
      grupos: grade.grupos,
    }),
    dryRun,
  });
  if (dryRun) {
    return { ferramenta: 'escala_semana', enviados: 0, dryRun: true, bolhas: r.bolhas };
  }
  if (!r.ok) {
    return { ferramenta: 'escala_semana', enviados: 0, motivo: r.motivo, bolhas: r.bolhas };
  }

  if (!destinoOverride) {
    await registrarEnvio({
      chave,
      ferramenta: 'escala_semana',
      destino: String(destino),
      payload: { semana_inicio: grade.semana_inicio, grupos: grade.grupos.length },
    });
  }

  return { ferramenta: 'escala_semana', enviados: 1, semana_inicio: grade.semana_inicio };
}
