-- Permissão para aba Configurações → Notificações (templates de alertas)
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('configuracoes.notificacoes', 'Gerir notificações', 'Configurações', 69)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, 'configuracoes.notificacoes'
FROM usuario_permissoes up
WHERE up.codigo = 'configuracoes.ver'
  AND NOT EXISTS (
    SELECT 1 FROM usuario_permissoes x
    WHERE x.id_usuario = up.id_usuario AND x.codigo = 'configuracoes.notificacoes'
  )
ON CONFLICT DO NOTHING;

COMMIT;
