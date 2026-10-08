-- Acesso da API de DDA do Banco do Brasil. Um por empresa: o boleto que volta é do CNPJ titular.

create table if not exists bb_credenciais (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  client_id text not null default '',
  client_secret text not null default '',
  app_key text not null default '',
  cert_pem text not null default '',
  key_pem text not null default '',
  pfx text not null default '',
  cert_pass text not null default '',
  ativo boolean not null default true,
  ultima_coleta timestamptz,
  ultimo_ok boolean,
  ultima_mensagem text,
  atualizado_em timestamptz not null default now()
);
