-- Contabilidade vê o estoque inteiro. Não lança, não confere e não altera.

BEGIN;

UPDATE permissoes
SET nome = 'Ver o estoque inteiro, sem lançar, conferir ou alterar'
WHERE codigo = 'estoque.saldo.ver';

UPDATE cargos
SET descricao = 'Inbox, consulta de contas a pagar, Custos (C_O_), conciliação bancária e estoque em consulta. Sem lançar despesa, caixa, reunião ou outras funções da Gestão.'
WHERE codigo = 'contabilidade';

COMMIT;
