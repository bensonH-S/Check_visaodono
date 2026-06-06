-- Garantir que o nome exibido do cargo bate com cargo_aprovacao
UPDATE usuarios u
SET cargo = cg.nome
FROM cargos cg
WHERE u.cargo_aprovacao = cg.codigo
  AND (u.cargo IS DISTINCT FROM cg.nome);
