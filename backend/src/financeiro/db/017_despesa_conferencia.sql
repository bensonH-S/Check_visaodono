-- Conferência operacional (Free Control OK) e tributária (PIS/COFINS/IPTU…).
alter table despesas add column if not exists conferencia_status text;
alter table despesas add column if not exists tributo_tipo text;
alter table despesas add column if not exists conferencia_detalhe text;

alter table despesas drop constraint if exists despesas_conferencia_status_check;
alter table despesas add constraint despesas_conferencia_status_check
  check (
    conferencia_status is null
    or conferencia_status in ('ok', 'pendente', 'conferido')
  );

alter table despesas drop constraint if exists despesas_tributo_tipo_check;
alter table despesas add constraint despesas_tributo_tipo_check
  check (
    tributo_tipo is null
    or tributo_tipo in (
      'iptu', 'pis', 'cofins', 'icms_difal', 'icms', 'iss',
      'darf', 'fgts', 'inss', 'irrf', 'simples', 'outro_tributo'
    )
  );

create index if not exists despesas_conferencia_status_idx
  on despesas (conferencia_status)
  where conferencia_status is not null;

create index if not exists despesas_tributo_tipo_idx
  on despesas (tributo_tipo)
  where tributo_tipo is not null;
