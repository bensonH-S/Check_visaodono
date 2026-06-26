-- Diretor: ver chamados de todas as lojas e receber alertas operacionais
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('chamados.ver', 'Ver chamados de manutenção', 'Manutenção', 80),
  ('lojas.todas', 'Acesso a todas as lojas', 'Lojas', 130)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('chamados.ver'), ('lojas.todas')) AS p(codigo)
WHERE u.ativo = TRUE
  AND u.cargo_aprovacao = 'diretor'
  AND NOT EXISTS (
    SELECT 1 FROM usuario_permissoes x
    WHERE x.id_usuario = u.id_usuario AND x.codigo = p.codigo
  );

COMMIT;
