-- Alinha permissões ao menu atual (ranking e NCs ficam no dashboard)
BEGIN;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT up.id_usuario, 'portal.dashboard.ver'
FROM usuario_permissoes up
WHERE up.codigo IN ('portal.ranking.ver', 'portal.ncs.ver')
  AND NOT EXISTS (
    SELECT 1
    FROM usuario_permissoes x
    WHERE x.id_usuario = up.id_usuario
      AND x.codigo = 'portal.dashboard.ver'
  )
ON CONFLICT DO NOTHING;

DELETE FROM usuario_permissoes
WHERE codigo IN ('portal.ranking.ver', 'portal.ncs.ver');

DELETE FROM permissoes
WHERE codigo IN ('portal.ranking.ver', 'portal.ncs.ver');

UPDATE permissoes
SET nome = 'Ver dashboard (início, ranking e NCs)', grupo = 'Início', ordem = 10
WHERE codigo = 'portal.dashboard.ver';

UPDATE permissoes
SET nome = 'Ver histórico de visitas', grupo = 'Visitas', ordem = 20
WHERE codigo = 'portal.visitas.ver';

UPDATE permissoes
SET nome = 'Acessar checklist em loja', grupo = 'Visitas', ordem = 25
WHERE codigo = 'checklist.ver';

UPDATE permissoes
SET nome = 'Executar checklist e registrar visita', grupo = 'Visitas', ordem = 30
WHERE codigo = 'checklist.executar';

UPDATE permissoes
SET nome = 'Ver cadastro de lojas', grupo = 'Configurações', ordem = 72
WHERE codigo = 'portal.lojas.ver';

UPDATE permissoes
SET nome = 'Listar usuários (ex.: escolher auditor no checklist)', grupo = 'Usuários', ordem = 110
WHERE codigo = 'usuarios.listar';

COMMIT;
