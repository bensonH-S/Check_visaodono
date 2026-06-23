BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('frota.usar', 'Usar módulo de frota no app mobile', 'Frota', 140),
  ('frota.gerenciar', 'Cadastrar veículos e gerenciar frota', 'Frota', 145)
ON CONFLICT (codigo) DO NOTHING;

-- Veículos da frota
CREATE TABLE IF NOT EXISTS frota_veiculos (
  id_veiculo SERIAL PRIMARY KEY,
  placa VARCHAR(10) NOT NULL UNIQUE,
  marca VARCHAR(60),
  modelo VARCHAR(80),
  ano INT,
  cor VARCHAR(40),
  id_usuario_responsavel INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  assuncao_em TIMESTAMPTZ,
  km_atual INT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_assuncoes (
  id_assuncao SERIAL PRIMARY KEY,
  id_veiculo INT NOT NULL REFERENCES frota_veiculos(id_veiculo) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  km_inicio INT,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  observacao TEXT
);

CREATE TABLE IF NOT EXISTS frota_abastecimentos (
  id_abastecimento SERIAL PRIMARY KEY,
  id_veiculo INT NOT NULL REFERENCES frota_veiculos(id_veiculo) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  km_atual INT NOT NULL,
  valor_abastecido NUMERIC(10, 2) NOT NULL,
  id_anexo_comprovante INT,
  data_abastecimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_anexos (
  id_anexo SERIAL PRIMARY KEY,
  contexto VARCHAR(40) NOT NULL,
  id_referencia INT NOT NULL,
  nome_arquivo VARCHAR(200),
  arquivo_url TEXT NOT NULL,
  tipo_mime VARCHAR(80),
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_documentos (
  id_documento SERIAL PRIMARY KEY,
  id_veiculo INT NOT NULL REFERENCES frota_veiculos(id_veiculo) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  id_anexo INT REFERENCES frota_anexos(id_anexo) ON DELETE SET NULL,
  data_vencimento DATE,
  valor NUMERIC(10, 2),
  observacao TEXT,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_manutencoes_veiculo (
  id_manutencao SERIAL PRIMARY KEY,
  id_veiculo INT NOT NULL REFERENCES frota_veiculos(id_veiculo) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  km INT,
  valor NUMERIC(10, 2),
  data_manutencao DATE NOT NULL DEFAULT CURRENT_DATE,
  proxima_manutencao DATE,
  id_anexo INT REFERENCES frota_anexos(id_anexo) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_termos_ferramentas (
  id_termo SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  assinatura_url TEXT NOT NULL,
  termo_versao VARCHAR(20) NOT NULL DEFAULT '1.0',
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_termo_fotos (
  id_foto SERIAL PRIMARY KEY,
  id_termo INT NOT NULL REFERENCES frota_termos_ferramentas(id_termo) ON DELETE CASCADE,
  id_anexo INT NOT NULL REFERENCES frota_anexos(id_anexo) ON DELETE CASCADE,
  descricao VARCHAR(200)
);

-- Agendamentos de visita/manutenção na loja (WhatsApp na fase 2)
CREATE TABLE IF NOT EXISTS frota_agendamentos_loja (
  id_agendamento SERIAL PRIMARY KEY,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  data_agendada TIMESTAMPTZ NOT NULL,
  tipo VARCHAR(40) NOT NULL DEFAULT 'manutencao',
  descricao TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'agendado',
  notificado_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posição GPS dos técnicos (dispatch emergencial — fase 3)
CREATE TABLE IF NOT EXISTS frota_tecnico_posicao (
  id_usuario INT PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  precisao_metros NUMERIC(8, 2),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- Permissão frota para técnico e regional
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'frota.usar'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
  'tecnico', 'regional', 'supervisor_regional', 'coordenador', 'administrador', 'ti'
)
ON CONFLICT DO NOTHING;

COMMIT;
