BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('ncs.ver', 'Ver não conformidades da região', 'Não conformidades', 170),
  ('ncs.resolver', 'Resolver não conformidades (foto e encerramento)', 'Não conformidades', 171)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS observacao_resolucao TEXT,
  ADD COLUMN IF NOT EXISTS data_resolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_usuario_resolucao INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS nc_anexos (
  id_anexo SERIAL PRIMARY KEY,
  id_nc INT NOT NULL REFERENCES nao_conformidades(id_nc) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nome_arquivo VARCHAR(255),
  arquivo_url TEXT NOT NULL,
  tipo_mime VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nc_anexos_nc ON nc_anexos(id_nc);

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'ncs.ver'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador', 'supervisor_regional')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'ncs.resolver'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador', 'supervisor_regional')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT rr.id_usuario, p.codigo
FROM frota_regiao_regionais rr
JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
CROSS JOIN (VALUES ('ncs.ver'), ('ncs.resolver')) AS p(codigo)
ON CONFLICT DO NOTHING;

COMMIT;
