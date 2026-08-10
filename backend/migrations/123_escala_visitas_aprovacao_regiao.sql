BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  (
    'escalas.visitas.editar_regiao',
    'Montar escala de visitas da própria região',
    'Escalas',
    152
  )
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

-- Supervisores (Barbara / Plinio / Fagno e demais)
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'escalas.visitas.editar_regiao'
FROM usuarios u
WHERE u.ativo = TRUE
  AND LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text, '')) IN (
    'supervisor_regional',
    'supervisor'
  )
ON CONFLICT DO NOTHING;

-- Quem já é regional vinculado na frota
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT rr.id_usuario, 'escalas.visitas.editar_regiao'
FROM frota_regiao_regionais rr
JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

-- Líderes de região (id_regional)
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT r.id_regional, 'escalas.visitas.editar_regiao'
FROM frota_regioes r
JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
WHERE r.ativo = TRUE
  AND r.id_regional IS NOT NULL
ON CONFLICT DO NOTHING;

-- Quem edita região também precisa ver a escala
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, 'escalas.visitas.ver'
FROM usuario_permissoes up
WHERE up.codigo = 'escalas.visitas.editar_regiao'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS escala_visitas_regiao_status (
  id_semana INT NOT NULL REFERENCES escala_visitas_semana(id_semana) ON DELETE CASCADE,
  id_regiao INT NOT NULL REFERENCES frota_regioes(id_regiao) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovado')),
  submetido_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  submetido_em TIMESTAMPTZ,
  revisado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  comentario TEXT,
  PRIMARY KEY (id_semana, id_regiao)
);

CREATE INDEX IF NOT EXISTS idx_escala_visitas_regiao_status_status
  ON escala_visitas_regiao_status(status);

COMMIT;
