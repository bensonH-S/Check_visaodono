BEGIN;

-- Dois checklists em paralelo (sem apagar o existente)
CREATE TABLE IF NOT EXISTS tipos_checklist (
  id_tipo_checklist SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tipos_checklist (codigo, nome, descricao, ordem) VALUES
  (
    'auditoria_operacional',
    'Auditoria Operacional',
    'Checklist de Auditoria Operacional e Segurança dos Alimentos (Diretor / Dono)',
    1
  ),
  (
    'time_de_campo',
    'Time de Campo',
    'Relatório Time de Campo — visita estrutural (Supervisor Regional)',
    2
  )
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE categorias_checklist
  ADD COLUMN IF NOT EXISTS id_tipo_checklist INT REFERENCES tipos_checklist(id_tipo_checklist);

ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS id_tipo_checklist INT REFERENCES tipos_checklist(id_tipo_checklist);

ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS meta_visita JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE categorias_checklist c
SET id_tipo_checklist = t.id_tipo_checklist
FROM tipos_checklist t
WHERE t.codigo = 'auditoria_operacional'
  AND c.id_tipo_checklist IS NULL;

UPDATE visitas v
SET id_tipo_checklist = t.id_tipo_checklist
FROM tipos_checklist t
WHERE t.codigo = 'auditoria_operacional'
  AND v.id_tipo_checklist IS NULL;

ALTER TABLE categorias_checklist
  ALTER COLUMN id_tipo_checklist SET NOT NULL;

ALTER TABLE visitas
  ALTER COLUMN id_tipo_checklist SET NOT NULL;

-- Cargos adicionais (perfil em Usuários)
INSERT INTO cargos (nome, codigo, aprovador) VALUES
  ('Dono', 'dono', FALSE),
  ('Supervisor Regional', 'supervisor_regional', FALSE)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS cargo_checklist (
  cargo_codigo VARCHAR(50) NOT NULL REFERENCES cargos(codigo) ON UPDATE CASCADE ON DELETE CASCADE,
  id_tipo_checklist INT NOT NULL REFERENCES tipos_checklist(id_tipo_checklist) ON DELETE CASCADE,
  PRIMARY KEY (cargo_codigo, id_tipo_checklist)
);

-- Diretor / Dono → Auditoria Operacional
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('diretor', 'dono')
  AND t.codigo = 'auditoria_operacional'
ON CONFLICT DO NOTHING;

-- Supervisor Regional (+ coordenador legado) → Time de Campo
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('supervisor_regional', 'coordenador')
  AND t.codigo = 'time_de_campo'
ON CONFLICT DO NOTHING;

-- TI e Administrador podem usar os dois (testes / gestão)
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('ti', 'administrador')
ON CONFLICT DO NOTHING;

COMMIT;
