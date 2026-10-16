-- Supervisor: matriz aditiva + resumo financeiro no CC; Igor/Clemerson com lojas.todas.
-- Não remove AutoREV/Frota/Chamados/etc.; só acrescenta o pedido e corta conflitos.

BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem)
VALUES (
  'financeiro.resumo.ver',
  'Ver gastos e pagamentos no Command Center',
  'Financeiro',
  186
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

-- Garante o cargo (nome de tela pode variar)
INSERT INTO cargos (nome, codigo, aprovador, ativo, descricao)
SELECT 'Supervisor', 'supervisor_regional', FALSE, TRUE,
       'Administra a frota e os chamados pertinentes à região de atuação.'
WHERE NOT EXISTS (SELECT 1 FROM cargos WHERE codigo = 'supervisor_regional');

-- Aditivos
INSERT INTO cargo_permissoes (codigo_cargo, codigo)
SELECT 'supervisor_regional', x.codigo
FROM (VALUES
  ('portal.dashboard.ver'),
  ('financeiro.resumo.ver'),
  ('ncs.ver'),
  ('ncs.resolver'),
  ('energia.ver'),
  ('energia.abrir'),
  ('escalas.visitas.ver'),
  ('escalas.visitas.editar_regiao'),
  ('portal.visitas.ver'),
  ('estoque.operacional'),
  ('estoque.break'),
  ('metas.ver')
) AS x(codigo)
JOIN permissoes p ON p.codigo = x.codigo
ON CONFLICT DO NOTHING;

-- Conflitos com o pedido
DELETE FROM cargo_permissoes
WHERE codigo_cargo = 'supervisor_regional'
  AND codigo IN (
    'portal.visitas.apagar',
    'escalas.visitas.gerenciar',
    'estoque.produtos',
    'metas.gerenciar'
  );

-- Espelha o cargo nos usuários supervisor_regional
DELETE FROM usuario_permissoes up
USING usuarios u
WHERE up.id_usuario = u.id_usuario
  AND lower(coalesce(u.cargo_aprovacao, '')) = 'supervisor_regional'
  AND coalesce(u.ativo, TRUE);

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, cp.codigo
FROM usuarios u
JOIN cargo_permissoes cp ON cp.codigo_cargo = 'supervisor_regional'
WHERE lower(coalesce(u.cargo_aprovacao, '')) = 'supervisor_regional'
  AND coalesce(u.ativo, TRUE)
ON CONFLICT DO NOTHING;

-- Igor e Clemerson: todas as lojas (override)
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'lojas.todas'
FROM usuarios u
WHERE coalesce(u.ativo, TRUE)
  AND (
    lower(u.nome) ~* '(^| )igor( |$)'
    OR lower(coalesce(u.email, '')) LIKE '%igor%'
    OR lower(u.nome) ~* 'clemerson'
    OR lower(coalesce(u.email, '')) LIKE '%clemerson%'
  )
ON CONFLICT DO NOTHING;

COMMIT;
