-- Manutenção integrada ao Vision Check (mesmo banco vision_check, lojas + usuarios do checklist)
BEGIN;

DO $$ BEGIN
  CREATE TYPE manut_urgencia AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE manut_status_chamado AS ENUM ('aberto', 'em_atendimento', 'concluido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS manut_categorias (
  id_categoria SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  sla_horas INT NOT NULL DEFAULT 24,
  urgencia_padrao manut_urgencia NOT NULL DEFAULT 'media',
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS manut_chamados (
  id_chamado SERIAL PRIMARY KEY,
  numero SERIAL UNIQUE,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NOT NULL,
  status manut_status_chamado NOT NULL DEFAULT 'aberto',
  urgencia manut_urgencia NOT NULL,
  id_categoria INT NOT NULL REFERENCES manut_categorias(id_categoria),
  id_loja INT NOT NULL REFERENCES lojas(id_loja),
  id_solicitante INT NOT NULL REFERENCES usuarios(id_usuario),
  id_tecnico INT REFERENCES usuarios(id_usuario),
  local_detalhe VARCHAR(200),
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prazo_sla TIMESTAMPTZ NOT NULL,
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manut_chamados_status ON manut_chamados(status);
CREATE INDEX IF NOT EXISTS idx_manut_chamados_prazo ON manut_chamados(prazo_sla);

CREATE TABLE IF NOT EXISTS manut_anexos (
  id_anexo SERIAL PRIMARY KEY,
  id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario),
  nome_arquivo VARCHAR(255),
  arquivo_url TEXT NOT NULL,
  tipo_mime VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO manut_categorias (nome, sla_horas, urgencia_padrao) VALUES
  ('Elétrico', 4, 'alta'),
  ('Hidráulico', 6, 'media'),
  ('Pintura', 48, 'baixa'),
  ('Reforma', 72, 'baixa'),
  ('Piso / revestimento', 48, 'media'),
  ('Ar condicionado', 8, 'alta'),
  ('Marcenaria', 24, 'media'),
  ('Alvenaria', 24, 'media'),
  ('Vidraçaria', 24, 'media'),
  ('Limpeza / conservação', 12, 'baixa')
ON CONFLICT (nome) DO NOTHING;

COMMIT;
