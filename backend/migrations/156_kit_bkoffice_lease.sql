-- Lease ativo/passivo entre PCs do kit BK Office (só um sincroniza por vez).

BEGIN;

CREATE TABLE IF NOT EXISTS kit_bkoffice_lease (
  slot TEXT PRIMARY KEY DEFAULT 'sync',
  holder_id TEXT NOT NULL,
  holder_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE kit_bkoffice_lease IS
  'Quem segura o lease sincroniza vendas BK Office; outro PC fica standby até expirar.';

COMMIT;
