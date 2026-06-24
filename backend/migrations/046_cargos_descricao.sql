BEGIN;

ALTER TABLE cargos ADD COLUMN IF NOT EXISTS descricao TEXT;

INSERT INTO cargos (nome, codigo, aprovador, descricao) VALUES
  ('CEO', 'ceo', FALSE, 'Administrador com acesso completo ao sistema.')
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao;

UPDATE cargos SET
  nome = 'Administrador',
  descricao = 'Controle total do sistema.'
WHERE codigo = 'administrador';

UPDATE cargos SET
  nome = 'Coordenador',
  descricao = 'Administra a loja pertinente a ele e abre chamados.'
WHERE codigo = 'coordenador';

UPDATE cargos SET
  nome = 'Diretor',
  descricao = 'Nível elevado de aprovações; administra lojas e regiões, com perfil próximo ao administrador.',
  aprovador = TRUE
WHERE codigo = 'diretor';

UPDATE cargos SET
  nome = 'Financeiro',
  descricao = 'Gestão de relatórios, verificação de notas e informações e aprovação de orçamentos.',
  aprovador = TRUE
WHERE codigo = 'financeiro';

UPDATE cargos SET
  nome = 'Gerente',
  descricao = 'Administra a loja pertinente a ele e abre chamados.'
WHERE codigo = 'gerente';

UPDATE cargos SET
  nome = 'Supervisor',
  descricao = 'Administra a frota e os chamados pertinentes à região de atuação.'
WHERE codigo = 'supervisor_regional';

UPDATE cargos SET
  nome = 'Regional',
  descricao = 'Responsável pela região de atuação, frota e chamados da área.'
WHERE codigo = 'regional';

UPDATE cargos SET
  nome = 'Técnico',
  descricao = 'Executa chamados e faz gestão limitada de veículos e ferramentas.'
WHERE codigo = 'tecnico';

UPDATE cargos SET
  nome = 'TI',
  descricao = 'Suporte técnico e manutenção do sistema.'
WHERE codigo = 'ti';

UPDATE cargos SET
  nome = 'Dono',
  descricao = 'Proprietário com visão estratégica e acesso amplo ao sistema.'
WHERE codigo = 'dono';

-- CEO e Dono: mesmos checklists do administrador
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('ceo', 'dono')
  AND t.codigo IN ('auditoria_operacional', 'time_de_campo')
ON CONFLICT DO NOTHING;

-- Supervisor / Regional: gestão de regiões da frota
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'frota.regioes'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('supervisor_regional', 'regional')
ON CONFLICT DO NOTHING;

COMMIT;
