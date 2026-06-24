BEGIN;

-- Migrar usuários dos cargos removidos
UPDATE usuarios SET
  cargo_aprovacao = 'ceo',
  cargo = COALESCE((SELECT nome FROM cargos WHERE codigo = 'ceo'), 'CEO'),
  perfil = 'administrador'::perfil_usuario
WHERE cargo_aprovacao = 'dono';

UPDATE usuarios SET
  cargo_aprovacao = 'supervisor_regional',
  cargo = COALESCE((SELECT nome FROM cargos WHERE codigo = 'supervisor_regional'), 'Supervisor'),
  perfil = 'coordenador'::perfil_usuario
WHERE cargo_aprovacao = 'regional';

UPDATE usuarios SET
  cargo_aprovacao = 'administrador',
  cargo = COALESCE((SELECT nome FROM cargos WHERE codigo = 'administrador'), 'Administrador'),
  perfil = 'administrador'::perfil_usuario
WHERE cargo_aprovacao = 'ti' OR perfil::text = 'ti';

-- Referências em chamados
UPDATE manut_chamados SET aprovacao_destino = 'ceo' WHERE aprovacao_destino = 'dono';
UPDATE manut_chamados SET aprovacao_destino = 'supervisor_regional' WHERE aprovacao_destino = 'regional';
UPDATE manut_chamados SET aprovacao_destino = 'administrador' WHERE aprovacao_destino = 'ti';

DELETE FROM cargo_checklist WHERE cargo_codigo IN ('dono', 'regional', 'ti');

DELETE FROM cargos WHERE codigo IN ('dono', 'regional', 'ti');

COMMIT;
