-- Agrupa permissões de checklist e renomeia a de configuração de perguntas
BEGIN;

UPDATE permissoes
SET nome = 'Acessar checklist em loja', grupo = 'Checklist', ordem = 26
WHERE codigo = 'checklist.ver';

UPDATE permissoes
SET nome = 'Executar checklist e registrar visita', grupo = 'Checklist', ordem = 28
WHERE codigo = 'checklist.executar';

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('checklist.gerenciar', 'Configurar perguntas do checklist', 'Checklist', 30)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

COMMIT;
