-- NFC-e de venda enviada pelo Hermes (pasta Enviados da loja).
-- Uma linha por chave. Reenvio substitui o XML, não cria outra nota.

create table if not exists public.nfc_venda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  bk_number text,
  chave text not null unique,
  data date not null,
  numero text,
  serie text,
  valor numeric(14, 2),
  tipo text not null default 'autorizada'
    check (tipo in ('autorizada', 'contingencia')),
  xml text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists nfc_venda_empresa_data
  on public.nfc_venda (empresa_id, data desc);

create index if not exists nfc_venda_atualizado
  on public.nfc_venda (atualizado_em, chave);
