-- Chamados de energia: protocolo da concessionária (Neoenergia ou genérica),
-- fotos e status para comprovar ocorrência (queda/surto) caso queime equipamento.
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('energia.ver', 'Ver chamados de energia e relatórios', 'Energia', 175),
  ('energia.abrir', 'Registrar protocolo e fotos de ocorrência de energia', 'Energia', 176)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

DO $$ BEGIN
  CREATE TYPE energia_status_chamado AS ENUM ('aberto', 'em_andamento', 'finalizado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS energia_chamados (
  id_chamado SERIAL PRIMARY KEY,
  numero SERIAL UNIQUE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja),
  protocolo VARCHAR(80) NOT NULL,
  concessionaria VARCHAR(120) NOT NULL DEFAULT 'Concessionária de energia',
  tipo_ocorrencia VARCHAR(60) NOT NULL DEFAULT 'falta_energia',
  descricao TEXT,
  status energia_status_chamado NOT NULL DEFAULT 'aberto',
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_usuario_abriu INT NOT NULL REFERENCES usuarios(id_usuario),
  id_usuario_finalizou INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  finalizado_em TIMESTAMPTZ,
  observacao_final TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energia_chamados_loja ON energia_chamados(id_loja);
CREATE INDEX IF NOT EXISTS idx_energia_chamados_status ON energia_chamados(status);
CREATE INDEX IF NOT EXISTS idx_energia_chamados_ocorrido ON energia_chamados(ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS energia_anexos (
  id_anexo SERIAL PRIMARY KEY,
  id_chamado INT NOT NULL REFERENCES energia_chamados(id_chamado) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nome_arquivo VARCHAR(255),
  arquivo_url BYTEA NOT NULL,
  tipo_mime VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energia_anexos_chamado ON energia_anexos(id_chamado);

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('energia.ver'), ('energia.abrir')) AS p(codigo)
WHERE u.ativo = TRUE
  AND (
    COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
      'gerente', 'coordenador', 'diretor', 'ceo', 'administrador', 'supervisor_regional'
    )
    OR EXISTS (
      SELECT 1 FROM usuario_permissoes up
      WHERE up.id_usuario = u.id_usuario AND up.codigo IN ('chamados.abrir', 'chamados.ver')
    )
  )
ON CONFLICT DO NOTHING;

COMMIT;
