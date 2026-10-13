-- Valor de face no vencimento original; o que se paga é valor (total),
-- com multa, juros, outras taxas e desconto — no dia em que entra na agenda.
alter table despesas add column if not exists valor_face numeric(14, 2);
alter table despesas add column if not exists multa numeric(14, 2) not null default 0;
alter table despesas add column if not exists juros numeric(14, 2) not null default 0;
alter table despesas add column if not exists outras_taxas numeric(14, 2) not null default 0;
alter table despesas add column if not exists desconto numeric(14, 2) not null default 0;
alter table despesas add column if not exists modo_acrescimo text not null default 'total';
alter table despesas add column if not exists vencimento_original date;
