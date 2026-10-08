-- Freelancer: onde a pessoa é registrada pode ser outra loja da origem.
-- Código de pagamento da pessoa: folha, cadastro ou chave PIX.

alter table despesas add column if not exists empresa_registro_id uuid references empresas (id);

do $$
declare nome text;
begin
  for nome in
    select conname from pg_constraint
    where conrelid = 'despesas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%forma_pagamento%'
  loop
    execute format('alter table despesas drop constraint %I', nome);
  end loop;
end $$;

alter table despesas add constraint despesas_forma_pagamento_check
  check (forma_pagamento is null or forma_pagamento in (
    'dinheiro', 'online', 'boleto', 'guia', 'folha', 'cadastro', 'chave_pix'
  ));
