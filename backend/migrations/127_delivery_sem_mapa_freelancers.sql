BEGIN;

-- Delivery não precisa de lojas.todas (isso liberava mapa e freelancers)
DELETE FROM usuario_permissoes
WHERE codigo IN (
  'lojas.todas',
  'freelancers.aprovar',
  'frota.mapa.ver',
  'frota.regioes',
  'frota.gerenciar',
  'escalas.visitas.editar_regiao',
  'escalas.visitas.gerenciar'
)
  AND id_usuario IN (
    SELECT id_usuario FROM usuarios
    WHERE LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
       OR LOWER(COALESCE(cargo_aprovacao, '')) = 'delivery'
  );

COMMIT;
