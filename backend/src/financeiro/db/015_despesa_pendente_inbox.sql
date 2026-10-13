-- Despesa criada na tela fica no Inbox até alguém confirmar.
-- Lançamentos antigos permanecem na Agenda banco (default false).
alter table despesas add column if not exists pendente_inbox boolean not null default false;
