-- API de Extrato Conta Corrente (Account Statement) do Itaú.
-- Uma credencial pode valer para um CNPJ ou para o grupo inteiro (empresa_id nulo).
-- O certificado é o dinâmico do Developers, não o A1 e-CNPJ.

create table if not exists itau_extrato_credenciais (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Extrato conta corrente',
  empresa_id uuid references empresas (id) on delete cascade,
  ambiente text not null default 'producao' check (ambiente in ('homologacao', 'producao')),
  client_id text not null default '',
  client_secret text not null default '',
  cert_pem text not null default '',
  key_pem text not null default '',
  ativo boolean not null default true,
  ultima_coleta timestamptz,
  ultimo_ok boolean,
  ultima_mensagem text,
  atualizado_em timestamptz not null default now()
);

create table if not exists itau_extrato_lancamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas_bancarias (id) on delete cascade,
  empresa_id uuid not null references empresas (id) on delete cascade,
  credencial_id uuid references itau_extrato_credenciais (id) on delete set null,
  statement_id text not null,
  evento_id text not null,
  tipo text,
  operacao text,
  estorno boolean not null default false,
  data_evento date,
  data_contabil date,
  literal_codigo text,
  literal text,
  valor numeric(14, 2) not null,
  moeda text not null default 'BRL',
  contraparte_nome text,
  contraparte_documento text,
  origem_tipo text,
  origem_identificador text,
  origem_operacao text,
  despesa_id uuid references despesas (id) on delete set null,
  coletado_em timestamptz not null default now(),
  unique (conta_id, evento_id)
);

create index if not exists itau_extrato_lancamentos_data_idx
  on itau_extrato_lancamentos (data_contabil desc, empresa_id);
