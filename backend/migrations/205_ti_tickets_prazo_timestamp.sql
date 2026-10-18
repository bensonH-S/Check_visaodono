-- Prazo de resposta passa a ser timestamp (SLA em minutos/horas).
ALTER TABLE ti_tickets
  ALTER COLUMN prazo TYPE TIMESTAMPTZ
  USING CASE
    WHEN prazo IS NULL THEN NULL
    ELSE (prazo::timestamp + TIME '23:59:59') AT TIME ZONE 'America/Sao_Paulo'
  END;
