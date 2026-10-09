-- Cursor da Distribuição DF-e (Ambiente Nacional) e notas destinadas ao CNPJ.

create table if not exists sefaz_dfe_cursor (
  cnpj text primary key,
  ult_nsu text not null default '000000000000000',
  max_nsu text,
  consultado_em timestamptz,
  ultimo_cstat text,
  ultimo_erro text
);

create table if not exists nfe_recebida (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  cnpj_empresa text not null,
  chave text not null,
  numero text,
  serie text,
  emissao date,
  emitente_cnpj text,
  emitente_nome text,
  valor_total numeric(14, 2),
  situacao text not null default 'autorizada'
    check (situacao in ('autorizada', 'cancelada', 'denegada')),
  tem_xml boolean not null default false,
  nsu text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cnpj_empresa, chave)
);

create index if not exists nfe_recebida_emissao
  on nfe_recebida (emissao desc);
