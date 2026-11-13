-- Contabilidade consulta a Agenda banco. Não lança, não edita, não importa e não exclui.

BEGIN;

UPDATE permissoes
SET nome = 'Ver contas a pagar (Agenda banco), sem lançar, editar ou importar'
WHERE codigo = 'financeiro.contas.ver';

UPDATE cargos
SET descricao = 'Inbox, consulta de contas a pagar, Custos (C_O_), conciliação bancária e saldo de estoque. Sem lançar despesa, caixa, reunião ou outras funções da Gestão.'
WHERE codigo = 'contabilidade';

COMMIT;
