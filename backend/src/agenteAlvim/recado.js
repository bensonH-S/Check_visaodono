import { redigirBolhasComLlm } from './texto.js';
import { enviarWhatsAppAlvimPartes } from './whatsapp.js';
import { salvarContextoAlvim } from './conversa.js';
import { grupoZapDaRegiao } from './grupos.js';

export function destinosDoRecado(config, grupo, destinoOverride) {
  if (destinoOverride) return [destinoOverride];
  const dest = [];
  const lideranca = String(config?.grupos?.lideranca?.id || config?.grupo_whatsapp || '').trim();
  const ti = grupoZapDaRegiao(config, grupo);
  if (lideranca) dest.push(lideranca);
  if (ti && ti !== lideranca) dest.push(ti);
  if (dest.length) return dest;
  return (grupo?.ids_usuario || []).map((id) => ({ id_usuario: id }));
}

export async function enviarRecadoAlvim({
  config,
  destinos,
  fatos,
  fallbackBolhas,
  dryRun = false,
} = {}) {
  const bolhas = await redigirBolhasComLlm(config, fatos, fallbackBolhas);
  if (!bolhas.length) return { ok: true, silencioso: true, bolhas: [] };
  if (dryRun) return { ok: true, dryRun: true, bolhas };

  let okAlgum = false;
  let ultimoMotivo = null;
  for (const dest of destinos || []) {
    const r = await enviarWhatsAppAlvimPartes(dest, bolhas);
    ultimoMotivo = r.motivo;
    if (r.ok) {
      okAlgum = true;
      const historico = [
        ...(Array.isArray(fatos?.historico) ? fatos.historico : []),
        fatos?.mensagem_da_pessoa ? { de: 'pessoa', texto: String(fatos.mensagem_da_pessoa).slice(0, 280) } : null,
        ...bolhas.map((texto) => ({ de: 'alvim', texto: String(texto).slice(0, 280) })),
      ].filter(Boolean).slice(-12);
      await salvarContextoAlvim({
        destino: dest,
        telefone: r.telefone,
        fatos: { ...fatos, historico },
        bolhas,
      });
      for (const id of fatos?.ids_usuario || []) {
        await salvarContextoAlvim({ destino: { id_usuario: id }, fatos, bolhas });
      }
    }
  }
  return { ok: okAlgum, bolhas, motivo: ultimoMotivo };
}
