-- Schema finance no vision_check. O módulo financeiro do portal lê e grava aqui.
-- Fronteira de domínio: sem FK para tabelas public (operacional).

BEGIN;

CREATE SCHEMA IF NOT EXISTS finance;

COMMENT ON SCHEMA finance IS 'Financeiro do portal — obrigações, DDA, caixa. Sem FK para public operacional.';

INSERT INTO permissoes (codigo, nome, grupo, ordem)
VALUES ('financeiro.ver', 'Ver módulo Financeiro (contas a pagar, caixa, DDA)', 'Financeiro', 185)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, grupo = EXCLUDED.grupo, ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'financeiro.ver'
FROM usuarios u
WHERE u.ativo = TRUE
  AND (
    LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text, '')) IN (
      'admin', 'administrador', 'ti', 'diretor', 'ceo', 'financeiro'
    )
    OR EXISTS (
      SELECT 1 FROM usuario_permissoes up
      WHERE up.id_usuario = u.id_usuario AND up.codigo = 'configuracoes.ver'
    )
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
