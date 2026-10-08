-- Caixa postal da VAN do Itaú (SFG). Uma só para o grupo: o retorno traz as contas das lojas.

create table if not exists itau_sfg (
  id smallint primary key default 1 check (id = 1),
  host text not null default '',
  porta integer not null default 22,
  usuario text not null default '',
  senha text not null default '',
  chave text not null default '',
  frase text not null default '',
  produto text not null default '',
  pasta text not null default '',
  ativo boolean not null default true,
  ultima_coleta timestamptz,
  ultimo_ok boolean,
  ultima_mensagem text,
  atualizado_em timestamptz not null default now()
);
