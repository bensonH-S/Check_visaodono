-- Libera aprovação de freelancers para regionais (Barbara, Plinio, Fagno e demais).
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('freelancers.aprovar', 'Aprovar turnos de freelancers (ponto) na região', 'Freelancers', 180)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

-- Por cargo
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'freelancers.aprovar'
FROM usuarios u
WHERE u.ativo = TRUE
  AND COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
    'supervisor_regional',
    'regional',
    'diretor',
    'ceo',
    'administrador'
  )
ON CONFLICT DO NOTHING;

-- Vinculados como regional de região de frota
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT rr.id_usuario, 'freelancers.aprovar'
FROM frota_regiao_regionais rr
JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT r.id_regional, 'freelancers.aprovar'
FROM frota_regioes r
JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
WHERE r.id_regional IS NOT NULL
ON CONFLICT DO NOTHING;

-- Garantia explícita: Barbara, Plinio e Fagno
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'freelancers.aprovar'
FROM usuarios u
WHERE u.ativo = TRUE
  AND (
    u.nome ILIKE '%barbara%'
    OR u.nome ILIKE '%bárbara%'
    OR u.nome ILIKE '%plinio%'
    OR u.nome ILIKE '%plínio%'
    OR u.nome ILIKE '%fagno%'
  )
ON CONFLICT DO NOTHING;

COMMIT;
