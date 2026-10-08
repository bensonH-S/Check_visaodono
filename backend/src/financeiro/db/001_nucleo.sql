-- Núcleo do financeiro do portal, alinhado às planilhas do Grupo Alvim.
-- Schema finance. Sem foreign key para o operacional.
-- Os arquivos-fonte ficam fora do Git (contêm conta, CPF e chave PIX).

create extension if not exists pgcrypto;

create table empresas (
  id uuid primary key default gen_random_uuid(),
  apelido text,
  razao_social text not null,
  bk_number text unique,
  cnpj text unique,
  inscricao_estadual text,
  endereco text,
  cidade text,
  cep text,
  tipo text not null check (tipo in ('holding', 'loja')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Conta NOSSA, de onde o dinheiro sai. Uma empresa pode ter Itaú e Banco do Brasil.
create table contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  banco text not null check (banco in ('itau', 'banco_do_brasil')),
  agencia text not null,
  numero text not null,
  digito text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (banco, agencia, numero)
);

-- Plano do F360. A chave é o nome. Códigos contábeis vieram vazios na planilha.
create table plano_contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null check (tipo in ('a_pagar', 'a_receber')),
  natureza text check (natureza in ('fixa', 'variavel')),
  codigo_obrigacao text,
  codigo_provisao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  razao_social text,
  cpf_cnpj text unique,
  tipo_pessoa text check (tipo_pessoa in ('cpf', 'cnpj')),
  plano_conta_id uuid references plano_contas (id),
  logradouro text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Conta DELES, para onde o pagamento vai. Não é a conta de saída da loja.
create table fornecedor_pagamentos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references fornecedores (id),
  meio text not null check (meio in ('pix', 'conta')),
  chave_pix text,
  tipo_chave_pix text,
  codigo_banco text,
  banco text,
  agencia text,
  digito_agencia text,
  numero text,
  digito text
);

create table despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  fornecedor_id uuid references fornecedores (id),
  empresa_origem_id uuid not null references empresas (id),
  empresa_registro_id uuid references empresas (id),
  conta_saida_id uuid references contas_bancarias (id),
  plano_conta_id uuid references plano_contas (id),
  documento_ref text,
  competencia date,
  vencimento date,
  valor numeric(14, 2) not null check (valor >= 0),
  -- Caixa da Rei (ago/2026): dinheiro (vale/meta), online (rescisão/vale), boleto ou guia (custo com vencimento).
  forma_pagamento text check (forma_pagamento in ('dinheiro', 'online', 'boleto', 'guia', 'folha', 'cadastro', 'chave_pix')),
  status text not null default 'rascunho' check (status in (
    'rascunho',
    'classificada',
    'pronta',
    'autorizada',
    'enviada',
    'paga',
    'conciliada',
    'bloqueada_duplicata',
    'aguardando_transferencia',
    'cancelada',
    'faltou'
  )),
  created_at timestamptz not null default now()
);

create index despesas_abertas_idx on despesas (vencimento) where status not in ('paga', 'conciliada', 'cancelada');
create index despesas_documento_idx on despesas (empresa_origem_id, documento_ref);
