import { pool } from '../db.js';

/** Placeholders: {numero}, {loja}, {tecnico}, {urgencia}, {autor} */
export const PLACEHOLDERS_NOTIFICACAO = [
  { chave: 'numero', descricao: 'Número do chamado' },
  { chave: 'loja', descricao: 'Nome da loja' },
  { chave: 'tecnico', descricao: 'Nome do técnico atribuído' },
  { chave: 'urgencia', descricao: 'Urgência (alta, crítica, etc.)' },
  { chave: 'autor', descricao: 'Nome de quem realizou a ação' },
];

export const DEFAULTS_TEMPLATES = {
  chamado_urgente_regiao: {
    template_mensagem: 'Novo chamado urgente #{numero} - {loja}. Verifique Imediatamente!',
    template_destinatario: null,
  },
  assumido: {
    template_mensagem: 'Chamado atribuído! Chamado #{numero} atribuído {tecnico}',
    template_destinatario: 'Chamado atribuído! Chamado #{numero} atribuído a você',
  },
  novo_chamado: {
    template_mensagem: 'Novo Chamado #{numero} - Aberto ({loja})',
    template_destinatario: null,
  },
  resposta: {
    template_mensagem: 'Nova Mensagem Chamado #{numero}',
    template_destinatario: null,
  },
  anexo: {
    template_mensagem: 'Novo anexo adicionado no chamado #{numero}',
    template_destinatario: null,
  },
  fechamento: {
    template_mensagem: 'Chamado #{numero} - Concluído',
    template_destinatario: null,
  },
  reabertura: {
    template_mensagem: 'Chamado #{numero} - Reaberto',
    template_destinatario: null,
  },
  envio_aprovacao: {
    template_mensagem: 'Orçamento pendente — chamado #{numero}',
    template_destinatario: null,
  },
  aguardando_aprovacao: {
    template_mensagem: 'Aguardando aprovação — chamado #{numero}',
    template_destinatario: null,
  },
  encaminhar_diretor: {
    template_mensagem: 'Orçamento encaminhado ao Diretor — #{numero}',
    template_destinatario: null,
  },
  aprovacao_diretor: {
    template_mensagem: 'Orçamento aprovado pelo Diretor — #{numero}',
    template_destinatario: null,
  },
  aprovacao: {
    template_mensagem: 'Orçamento aprovado — chamado #{numero}',
    template_destinatario: null,
  },
  recusa_aprovacao: {
    template_mensagem: 'Orçamento recusado — chamado #{numero}',
    template_destinatario: null,
  },
  sla_alerta_80: {
    template_mensagem: 'Atenção: chamado #{numero} ({loja}) está com 80% do prazo de SLA consumido.',
    template_destinatario: null,
  },
  sla_estourado: {
    template_mensagem: 'Urgente: chamado #{numero} ({loja}) estourou o prazo de SLA.',
    template_destinatario: null,
  },
};

let cacheMap = null;

export function invalidateTemplateCache() {
  cacheMap = null;
}

function resolverTemplate(evento, codigo, destinatario) {
  const defs = DEFAULTS_TEMPLATES[codigo] || {};
  if (destinatario) {
    return (
      evento?.template_destinatario ||
      defs.template_destinatario ||
      evento?.template_mensagem ||
      defs.template_mensagem ||
      ''
    );
  }
  return evento?.template_mensagem || defs.template_mensagem || '';
}

export function renderTemplateString(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}

export function renderMensagemSync(codigo, vars = {}, { destinatario = false } = {}) {
  const evento = cacheMap?.get(codigo) || null;
  const tpl = resolverTemplate(evento, codigo, destinatario);
  return renderTemplateString(tpl, vars);
}

export async function warmupTemplateCache() {
  try {
    const { rows } = await pool.query(
      `SELECT codigo, template_mensagem, template_destinatario, ativo, sistema
       FROM manut_notificacao_eventos`,
    );
    cacheMap = new Map(rows.map((r) => [r.codigo, r]));
  } catch {
    cacheMap = new Map();
  }
}

export async function renderMensagemNotificacao(codigo, vars = {}, { destinatario = false } = {}) {
  if (!cacheMap) await warmupTemplateCache();
  return renderMensagemSync(codigo, vars, { destinatario });
}

export function previewTemplate({
  codigo,
  template_mensagem,
  template_destinatario,
  destinatario = false,
  vars = {},
}) {
  const evento = {
    template_mensagem: template_mensagem ?? cacheMap?.get(codigo)?.template_mensagem,
    template_destinatario: template_destinatario ?? cacheMap?.get(codigo)?.template_destinatario,
  };
  const tpl = resolverTemplate(evento, codigo, destinatario);
  return renderTemplateString(tpl, {
    numero: 12,
    loja: 'Nome da loja',
    tecnico: 'Nome do técnico',
    urgencia: 'ALTA',
    autor: 'Usuário exemplo',
    ...vars,
  });
}
