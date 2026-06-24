BEGIN;

UPDATE permissoes SET
  nome = 'Gerenciar regiões de atuação',
  grupo = 'Lojas',
  ordem = 131
WHERE codigo = 'frota.regioes';

COMMIT;
