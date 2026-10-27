-- Data de lançamento ≠ vencimento. Recusa do dono na Agenda.
alter table despesas add column if not exists data_lancamento date;
alter table despesas add column if not exists dono_recusa boolean;
alter table despesas add column if not exists dono_recusa_motivo text;
alter table despesas add column if not exists dono_recusa_em timestamptz;
alter table despesas add column if not exists dono_recusa_por text;

update despesas
   set data_lancamento = coalesce(data_lancamento, competencia, created_at::date, current_date)
 where data_lancamento is null;

update despesas
   set dono_recusa = false
 where dono_recusa is null;

alter table despesas alter column dono_recusa set default false;

create index if not exists despesas_data_lancamento_idx on despesas (data_lancamento);
create index if not exists despesas_dono_recusa_idx on despesas (dono_recusa) where dono_recusa;

create or replace function despesas_preencher_data_lancamento()
returns trigger language plpgsql as $$
begin
  if new.data_lancamento is null then
    new.data_lancamento := coalesce((new.created_at)::date, current_date);
  end if;
  if new.dono_recusa is null then
    new.dono_recusa := false;
  end if;
  return new;
end;
$$;

drop trigger if exists despesas_data_lancamento_bi on despesas;
create trigger despesas_data_lancamento_bi
before insert on despesas
for each row execute procedure despesas_preencher_data_lancamento();
