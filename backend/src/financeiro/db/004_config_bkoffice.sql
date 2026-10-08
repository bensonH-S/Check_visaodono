-- Login da API de vendas do BK Office. A senha fica aqui, não no Git.

create table if not exists configuracoes (
  chave text primary key,
  valor text not null default '',
  atualizado_em timestamptz not null default now()
);
