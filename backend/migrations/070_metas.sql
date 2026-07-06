BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('metas.gerenciar', 'Gerenciar metas e indicadores', 'Metas', 160),
  ('metas.ver', 'Ver metas da empresa e gestores', 'Metas', 161)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('metas.gerenciar'), ('metas.ver')) AS p(codigo)
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS metas_periodos (
  id_periodo SERIAL PRIMARY KEY,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  titulo TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes)
);

CREATE TABLE IF NOT EXISTS metas_indicadores (
  id_indicador SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'resumo',
  tipo_valor TEXT NOT NULL DEFAULT 'texto',
  meta_minima NUMERIC,
  ordem INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metas_paineis (
  id_painel SERIAL PRIMARY KEY,
  id_periodo INT NOT NULL REFERENCES metas_periodos(id_periodo) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  UNIQUE (id_periodo, codigo)
);

CREATE TABLE IF NOT EXISTS metas_painel_indicadores (
  id_painel INT NOT NULL REFERENCES metas_paineis(id_painel) ON DELETE CASCADE,
  id_indicador INT NOT NULL REFERENCES metas_indicadores(id_indicador),
  peso INT NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id_painel, id_indicador)
);

CREATE TABLE IF NOT EXISTS metas_painel_lojas (
  id_painel INT NOT NULL REFERENCES metas_paineis(id_painel) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja),
  rotulo_curto TEXT,
  ordem INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id_painel, id_loja)
);

CREATE TABLE IF NOT EXISTS metas_realizados (
  id_realizado SERIAL PRIMARY KEY,
  id_periodo INT NOT NULL REFERENCES metas_periodos(id_periodo) ON DELETE CASCADE,
  id_painel INT NOT NULL REFERENCES metas_paineis(id_painel) ON DELETE CASCADE,
  id_indicador INT NOT NULL REFERENCES metas_indicadores(id_indicador),
  id_loja INT REFERENCES lojas(id_loja),
  valor_texto TEXT,
  valor_numero NUMERIC,
  atingiu BOOLEAN,
  pontos_obtidos INT,
  UNIQUE (id_painel, id_indicador, id_loja)
);

CREATE TABLE IF NOT EXISTS metas_rankings (
  id_ranking SERIAL PRIMARY KEY,
  id_periodo INT NOT NULL REFERENCES metas_periodos(id_periodo) ON DELETE CASCADE,
  id_indicador INT NOT NULL REFERENCES metas_indicadores(id_indicador),
  id_loja INT REFERENCES lojas(id_loja),
  posicao INT,
  valor_numero NUMERIC,
  valor_texto TEXT,
  pontos INT,
  id_gestor INT REFERENCES usuarios(id_usuario),
  nome_gestor TEXT,
  classe TEXT,
  destaque TEXT,
  UNIQUE (id_periodo, id_indicador, id_loja)
);

CREATE TABLE IF NOT EXISTS metas_premios (
  id_premio SERIAL PRIMARY KEY,
  id_periodo INT NOT NULL REFERENCES metas_periodos(id_periodo) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario),
  nome TEXT NOT NULL,
  premio_saude INT,
  premio_rev INT,
  valor_unitario NUMERIC,
  subtotal NUMERIC,
  total NUMERIC,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_metas_realizados_periodo ON metas_realizados(id_periodo);
CREATE INDEX IF NOT EXISTS idx_metas_rankings_periodo ON metas_rankings(id_periodo);

COMMIT;
