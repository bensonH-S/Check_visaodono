-- Remove status "backlog": demandas da mesa e fila passam a ser "chamado".

BEGIN;

UPDATE ti_tickets SET status = 'chamado', updated_at = NOW()
WHERE status = 'backlog';

ALTER TABLE ti_tickets DROP CONSTRAINT IF EXISTS ti_tickets_status_check;
ALTER TABLE ti_tickets
  ADD CONSTRAINT ti_tickets_status_check
  CHECK (status IN ('chamado', 'fazer', 'pendente', 'feito'));

COMMIT;
