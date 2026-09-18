-- Receber NF no app: gestores, regionais, diretor, Felipe, Igor e TI.
-- A API aceita estoque.conferencia (além de operacional). Sem esta permissão
-- o menu Estoque / Receber NF não aparece no mobile.

BEGIN;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('estoque.conferencia')) AS p(codigo)
WHERE u.ativo = TRUE
  AND (
    LOWER(COALESCE(u.cargo_aprovacao, '')) IN (
      'gerente',
      'coordenador',
      'subgerente',
      'sub_gerente',
      'assistente_gerente',
      'gestor',
      'supervisor_regional',
      'regional',
      'supervisor',
      'supervisor_geral',
      'diretor',
      'ceo',
      'administrador',
      'ti',
      'dono'
    )
    OR LOWER(COALESCE(u.perfil::text, '')) IN (
      'gerente',
      'coordenador',
      'administrador',
      'ti'
    )
    OR LOWER(TRIM(u.email)) IN (
      'igor@grupoalvim.com.br',
      'felipe@grupoalvim.com.br',
      'benson@grupoalvim.com.br',
      'frotadf@gmail.com'
    )
    OR u.id_usuario IN (SELECT id_regional FROM frota_regioes WHERE id_regional IS NOT NULL)
    OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_regionais)
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
