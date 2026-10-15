-- Painel TI: tickets (estilo ClickUp) + notas de reunião + acessos extras.

BEGIN;

CREATE TABLE IF NOT EXISTS ti_tickets (
  id_ticket BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'chamado'
    CHECK (status IN ('chamado', 'backlog', 'fazer', 'pendente', 'feito')),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  area VARCHAR(40) NOT NULL DEFAULT 'geral',
  origem VARCHAR(20) NOT NULL DEFAULT 'colaborador'
    CHECK (origem IN ('colaborador', 'mesa', 'interno')),
  criado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  responsavel_id INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  avaliacao SMALLINT CHECK (avaliacao IS NULL OR (avaliacao BETWEEN 1 AND 5)),
  avaliacao_comentario TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ti_tickets_status ON ti_tickets(status, ordem, id_ticket);
CREATE INDEX IF NOT EXISTS idx_ti_tickets_criado ON ti_tickets(criado_por, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_tickets_area ON ti_tickets(area);

CREATE TABLE IF NOT EXISTS ti_ticket_comentarios (
  id_comentario BIGSERIAL PRIMARY KEY,
  id_ticket BIGINT NOT NULL REFERENCES ti_tickets(id_ticket) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ti_ticket_comentarios_ticket ON ti_ticket_comentarios(id_ticket, created_at);

CREATE TABLE IF NOT EXISTS ti_notas (
  id_nota BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL DEFAULT 'Anotações de reunião',
  corpo TEXT NOT NULL DEFAULT '',
  atualizado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ti_ticket_acessos (
  id_usuario INT PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  pode_gerenciar BOOLEAN NOT NULL DEFAULT TRUE,
  concedido_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('ti.tickets.abrir', 'Abrir chamado para o TI', 'TI / Tickets', 200),
  ('ti.tickets.gerenciar', 'Gerenciar board de tickets do TI', 'TI / Tickets', 201)
ON CONFLICT (codigo) DO NOTHING;

-- Qualquer usuário ativo pode abrir chamado
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'ti.tickets.abrir'
FROM usuarios u
WHERE COALESCE(u.ativo, TRUE)
ON CONFLICT DO NOTHING;

-- Gestores do board: admins + TI
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'ti.tickets.gerenciar'
FROM usuarios u
WHERE COALESCE(u.ativo, TRUE)
  AND (
    COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('administrador', 'ceo', 'diretor')
    OR LOWER(u.email) IN ('ti@grupoalvim.com.br', 'benson.henrique@grupoalvim.com.br')
    OR LOWER(u.nome) LIKE '%benson%'
  )
ON CONFLICT DO NOTHING;

-- Nota inicial
INSERT INTO ti_notas (titulo, corpo)
SELECT 'Anotações de reunião', ''
WHERE NOT EXISTS (SELECT 1 FROM ti_notas LIMIT 1);

COMMIT;
