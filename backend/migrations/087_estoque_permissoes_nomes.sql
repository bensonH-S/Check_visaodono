BEGIN;

UPDATE permissoes
SET nome = 'Produtos — cadastrar e editar', grupo = 'Estoque', ordem = 200
WHERE codigo = 'estoque.produtos';

UPDATE permissoes
SET nome = 'Conferência — iniciar, salvar e finalizar', grupo = 'Estoque', ordem = 201
WHERE codigo = 'estoque.conferencia';

COMMIT;
