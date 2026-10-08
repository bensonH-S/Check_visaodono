alter table fechamento_caixa
  add column if not exists bandeiras jsonb not null default '[]'::jsonb;

create table if not exists caixa_loja_status (
  empresa_id uuid primary key references empresas(id),
  bk_number text,
  ultimo_ok timestamptz,
  ultimo_dia date,
  ultima_mensagem text not null default ''
);
