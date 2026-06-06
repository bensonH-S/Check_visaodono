-- Perfis padrão como cargos (aparecem no dropdown Perfil em Usuários)
INSERT INTO cargos (nome, codigo, aprovador) VALUES
  ('Administrador', 'administrador', FALSE),
  ('Coordenador', 'coordenador', FALSE),
  ('Gerente', 'gerente', FALSE),
  ('Técnico', 'tecnico', FALSE),
  ('TI', 'ti', FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- Vincular usuários existentes ao cargo correspondente ao perfil antigo
UPDATE usuarios u
SET cargo_aprovacao = u.perfil::text,
    cargo = COALESCE(cg.nome, u.cargo)
FROM cargos cg
WHERE u.cargo_aprovacao IS NULL
  AND cg.codigo = u.perfil::text;
