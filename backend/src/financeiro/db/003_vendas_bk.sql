-- Vendas do BK Office (API), por loja e produto.
-- bk_number liga na empresa daqui. Sem foreign key para o Meridian operacional.

create table if not exists vendas_bk (
  id uuid primary key default gen_random_uuid(),
  data_venda date not null,
  bk_number text not null,
  empresa_id uuid references empresas (id),
  restaurante text,
  codigo text not null,
  descricao text,
  quantidade numeric(14, 3) not null default 0,
  venda_bruta numeric(14, 2) not null default 0,
  desconto numeric(14, 2) not null default 0,
  imposto numeric(14, 2) not null default 0,
  venda_liquida numeric(14, 2) not null default 0,
  sincronizado_em timestamptz not null default now(),
  unique (data_venda, bk_number, codigo)
);

create index if not exists vendas_bk_data_idx on vendas_bk (data_venda);

create table if not exists vendas_sync (
  id uuid primary key default gen_random_uuid(),
  de date not null,
  ate date not null,
  linhas int not null,
  lojas int not null,
  venda_bruta numeric(14, 2) not null,
  ok boolean not null,
  mensagem text,
  criado_em timestamptz not null default now()
);
