BEGIN;

-- Cargo "Regional" (Time de Campo) — além de supervisor_regional legado
INSERT INTO cargos (nome, codigo, aprovador) VALUES
  ('Regional', 'regional', FALSE)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

-- Regional / Supervisor Regional / Coordenador → Time de Campo
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('regional', 'supervisor_regional', 'coordenador')
  AND t.codigo = 'time_de_campo'
ON CONFLICT DO NOTHING;

-- Diretor → ambos checklists (Auditoria + Time de Campo)
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo = 'diretor'
  AND t.codigo IN ('auditoria_operacional', 'time_de_campo')
ON CONFLICT DO NOTHING;

-- Administrador → ambos (reforço; já previsto na 037)
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo = 'administrador'
ON CONFLICT DO NOTHING;

-- Permissões de checklist para cargos que executam visita
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('checklist.ver'), ('checklist.executar')) AS p(codigo)
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
  'regional', 'supervisor_regional', 'coordenador', 'diretor', 'administrador', 'dono'
)
ON CONFLICT DO NOTHING;

COMMIT;
