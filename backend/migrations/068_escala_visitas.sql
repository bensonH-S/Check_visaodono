BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('escalas.visitas.gerenciar', 'Gerenciar escala de visitas semanal', 'Escalas', 150),
  ('escalas.visitas.ver', 'Ver escala de visitas semanal', 'Escalas', 151)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'escalas.visitas.gerenciar'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'escalas.visitas.ver'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador', 'supervisor_regional')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT rr.id_usuario, 'escalas.visitas.ver'
FROM frota_regiao_regionais rr
JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS escala_visitas_semana (
  id_semana SERIAL PRIMARY KEY,
  semana_inicio DATE NOT NULL UNIQUE,
  observacao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS escala_visitas_celula (
  id_semana INT NOT NULL REFERENCES escala_visitas_semana(id_semana) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  dia SMALLINT NOT NULL CHECK (dia >= 0 AND dia <= 6),
  id_regional INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  observacao TEXT,
  PRIMARY KEY (id_semana, id_loja, dia)
);

CREATE INDEX IF NOT EXISTS idx_escala_visitas_celula_regional ON escala_visitas_celula(id_regional);

COMMIT;
