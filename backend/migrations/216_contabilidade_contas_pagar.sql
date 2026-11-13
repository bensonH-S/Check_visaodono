-- Contabilidade: Agenda banco (contas a pagar), com lançamento.
-- Não abre caixa, reunião semanal nem as ações do dono.

BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem)
VALUES
  ('financeiro.contas.ver', 'Lançar e editar contas a pagar (Agenda banco), sem caixa ou reunião', 'Financeiro', 190)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

UPDATE cargos
SET descricao = 'Inbox, contas a pagar, Custos (C_O_), conciliação bancária e saldo de estoque. Sem caixa, reunião ou outras funções da Gestão.'
WHERE codigo = 'contabilidade';

INSERT INTO cargo_permissoes (codigo_cargo, codigo)
SELECT 'contabilidade', 'financeiro.contas.ver'
FROM permissoes p
WHERE p.codigo = 'financeiro.contas.ver'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'financeiro.contas.ver'
FROM usuarios u
JOIN permissoes p ON p.codigo = 'financeiro.contas.ver'
WHERE lower(coalesce(u.cargo_aprovacao, '')) = 'contabilidade'
ON CONFLICT DO NOTHING;

COMMIT;
