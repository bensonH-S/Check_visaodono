-- Heartbeat do kit BK Office (detectar kit parado no portal).

BEGIN;

ALTER TABLE kit_bkoffice_lease
  ADD COLUMN IF NOT EXISTS last_sync_ok_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_de DATE,
  ADD COLUMN IF NOT EXISTS last_sync_ate DATE,
  ADD COLUMN IF NOT EXISTS last_sync_lojas INT,
  ADD COLUMN IF NOT EXISTS last_sync_venda NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS last_sync_produtos INT,
  ADD COLUMN IF NOT EXISTS last_sync_ok BOOLEAN;

COMMENT ON COLUMN kit_bkoffice_lease.last_sync_ok_at IS
  'Último sync bem-sucedido do kit ativo; portal alerta se > 15 min no horário comercial.';

COMMIT;
