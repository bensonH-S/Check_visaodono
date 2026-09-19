import { pool } from '../db.js';

export const CATALOGO_MODULOS = [
  { codigo: 'dashboard', nome: 'Command Center', portalPadrao: true, mobilePadrao: false },
  { codigo: 'checklist', nome: 'AutoREV', portalPadrao: false, mobilePadrao: true },
  { codigo: 'chamados', nome: 'Chamados', portalPadrao: false, mobilePadrao: true },
  { codigo: 'nc', nome: 'Não Conformidades', portalPadrao: true, mobilePadrao: true },
  { codigo: 'metas', nome: 'Metas', portalPadrao: true, mobilePadrao: false },
  { codigo: 'energia', nome: 'Energia', portalPadrao: true, mobilePadrao: true },
  { codigo: 'frota', nome: 'Frota', portalPadrao: true, mobilePadrao: true },
  { codigo: 'escala', nome: 'Planejamento', portalPadrao: true, mobilePadrao: true },
  { codigo: 'visitas', nome: 'Visitas', portalPadrao: true, mobilePadrao: true },
  { codigo: 'mapa', nome: 'Mapa de técnicos', portalPadrao: false, mobilePadrao: true },
  { codigo: 'estoque', nome: 'Estoque & CMV', portalPadrao: true, mobilePadrao: true },
  { codigo: 'break', nome: 'Break', portalPadrao: false, mobilePadrao: true },
  { codigo: 'ranking', nome: 'Indicadores', portalPadrao: true, mobilePadrao: false },
  { codigo: 'freelancers', nome: 'Freelas', portalPadrao: false, mobilePadrao: true },
  { codigo: 'portais', nome: 'Portais', portalPadrao: false, mobilePadrao: true },
];

export const MODULOS_CANAL_PADRAO = Object.fromEntries(
  CATALOGO_MODULOS.map((item) => [
    item.codigo,
    {
      codigo: item.codigo,
      nome: item.nome,
      portal: item.portalPadrao,
      mobile: item.mobilePadrao,
    },
  ]),
);

function serializar(rows) {
  const mapa = { ...MODULOS_CANAL_PADRAO };
  for (const row of rows || []) {
    const codigo = String(row.codigo || '');
    if (!mapa[codigo]) continue;
    mapa[codigo] = {
      codigo,
      nome: row.nome || mapa[codigo].nome,
      portal: row.portal === true,
      mobile: row.mobile === true,
    };
  }
  return mapa;
}

export async function carregarModulosCanal() {
  try {
    const { rows } = await pool.query(
      `SELECT codigo, nome, portal, mobile
       FROM app_modulos_canal
       ORDER BY codigo`,
    );
    return serializar(rows);
  } catch {
    return { ...MODULOS_CANAL_PADRAO };
  }
}

export async function salvarModulosCanal(input = {}) {
  const atual = await carregarModulosCanal();
  const proximos = { ...atual };

  for (const codigo of Object.keys(MODULOS_CANAL_PADRAO)) {
    const patch = input[codigo];
    if (!patch || typeof patch !== 'object') continue;
    proximos[codigo] = {
      ...proximos[codigo],
      portal: patch.portal !== undefined ? Boolean(patch.portal) : proximos[codigo].portal,
      mobile: patch.mobile !== undefined ? Boolean(patch.mobile) : proximos[codigo].mobile,
    };
  }

  for (const item of Object.values(proximos)) {
    await pool.query(
      `INSERT INTO app_modulos_canal (codigo, nome, portal, mobile, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (codigo) DO UPDATE SET
         nome = EXCLUDED.nome,
         portal = EXCLUDED.portal,
         mobile = EXCLUDED.mobile,
         atualizado_em = NOW()`,
      [item.codigo, item.nome, item.portal, item.mobile],
    );
  }

  return proximos;
}
