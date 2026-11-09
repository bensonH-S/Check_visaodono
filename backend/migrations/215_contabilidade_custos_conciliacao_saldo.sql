-- Contabilidade: Custos (C_O_), conciliação bancária e saldo de estoque.
-- Mantém inbox (financeiro.nfe.ver) e lojas.todas. Não abre agenda, caixa, vendas nem as outras funções da Gestão.

BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem)
VALUES
  ('financeiro.custos.ver', 'Ver Custos (C_O_), sem outras telas do financeiro', 'Financeiro', 188),
  ('financeiro.conciliacao.ver', 'Acessar conciliação bancária, sem agenda ou caixa', 'Financeiro', 189),
  ('estoque.saldo.ver', 'Ver saldo de estoque, sem pedido, conferência, break ou vendas', 'Estoque', 205)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

UPDATE cargos
SET descricao = 'Inbox, Custos (C_O_), conciliação bancária e saldo de estoque. Sem agenda, caixa ou outras funções da Gestão.'
WHERE codigo = 'contabilidade';

INSERT INTO cargo_permissoes (codigo_cargo, codigo)
SELECT 'contabilidade', x.codigo
FROM (VALUES
  ('financeiro.custos.ver'),
  ('financeiro.conciliacao.ver'),
  ('estoque.saldo.ver')
) AS x(codigo)
JOIN permissoes p ON p.codigo = x.codigo
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, cp.codigo
FROM usuarios u
JOIN cargo_permissoes cp ON cp.codigo_cargo = u.cargo_aprovacao
WHERE lower(coalesce(u.cargo_aprovacao, '')) = 'contabilidade'
  AND cp.codigo IN ('financeiro.custos.ver', 'financeiro.conciliacao.ver', 'estoque.saldo.ver')
ON CONFLICT DO NOTHING;

COMMIT;
