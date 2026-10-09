-- O upsert do PDV usa ON CONFLICT. Bases criadas sem a chave única rejeitam o fechamento.

create unique index if not exists fechamento_caixa_id_key on fechamento_caixa (id);
create unique index if not exists fechamento_caixa_empresa_data_key on fechamento_caixa (empresa_id, data);
create unique index if not exists fechamento_caixa_lancamentos_id_key on fechamento_caixa_lancamentos (id);
create unique index if not exists caixa_loja_status_empresa_key on caixa_loja_status (empresa_id);
