-- Motor operacional de estoque: saldos, movimentos, ficha técnica, vendas BK, break
BEGIN;

-- ── Permissão operacional ──────────────────────────────────────────────────
INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('estoque.operacional', 'Operacional — vendas, ficha, break e saldos', 'Estoque', 202)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, 'estoque.operacional'
FROM usuario_permissoes up
WHERE up.codigo IN ('estoque.produtos', 'estoque.conferencia')
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'estoque.operacional'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

-- ── Saldos contínuos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_saldos (
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
  quantidade NUMERIC(14, 3) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_loja, id_produto)
);

CREATE INDEX IF NOT EXISTS idx_estoque_saldos_loja ON estoque_saldos (id_loja);

-- ── Movimentos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id_movimento BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'venda', 'break', 'ajuste', 'contagem', 'entrada', 'importacao'
  )),
  quantidade NUMERIC(14, 3) NOT NULL,
  saldo_apos NUMERIC(14, 3),
  referencia_tipo TEXT,
  referencia_id INTEGER,
  observacao TEXT,
  criado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_loja_data
  ON estoque_movimentos (id_loja, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto
  ON estoque_movimentos (id_produto, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_ref
  ON estoque_movimentos (referencia_tipo, referencia_id);

-- ── Produtos de venda (códigos BK Office) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos_venda (
  id_produto_venda SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_produtos_venda_codigo UNIQUE (codigo)
);

-- ── Ficha técnica (produto venda → insumos) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ficha_tecnica (
  id_ficha SERIAL PRIMARY KEY,
  id_produto_venda INTEGER NOT NULL REFERENCES produtos_venda(id_produto_venda) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ficha_produto_venda UNIQUE (id_produto_venda)
);

CREATE TABLE IF NOT EXISTS ficha_tecnica_itens (
  id_item SERIAL PRIMARY KEY,
  id_ficha INTEGER NOT NULL REFERENCES ficha_tecnica(id_ficha) ON DELETE CASCADE,
  codigo_insumo TEXT NOT NULL,
  quantidade NUMERIC(14, 4) NOT NULL CHECK (quantidade > 0),
  observacao TEXT,
  CONSTRAINT uq_ficha_item UNIQUE (id_ficha, codigo_insumo)
);

CREATE INDEX IF NOT EXISTS idx_ficha_itens_codigo ON ficha_tecnica_itens (codigo_insumo);

-- ── Vendas importadas (BK Office / upload) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_vendas (
  id_venda SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  data_venda DATE NOT NULL,
  origem TEXT NOT NULL DEFAULT 'bkoffice'
    CHECK (origem IN ('bkoffice', 'upload', 'manual')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processada', 'parcial', 'erro')),
  arquivo_nome TEXT,
  observacao TEXT,
  criado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  CONSTRAINT uq_estoque_vendas_loja_data_origem UNIQUE (id_loja, data_venda, origem)
);

CREATE TABLE IF NOT EXISTS estoque_venda_itens (
  id_item SERIAL PRIMARY KEY,
  id_venda INTEGER NOT NULL REFERENCES estoque_vendas(id_venda) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  qtde NUMERIC(14, 3) NOT NULL DEFAULT 0,
  venda_liquida NUMERIC(14, 2),
  id_produto_venda INTEGER REFERENCES produtos_venda(id_produto_venda) ON DELETE SET NULL,
  processado BOOLEAN NOT NULL DEFAULT FALSE,
  sem_ficha BOOLEAN NOT NULL DEFAULT FALSE,
  erro TEXT,
  CONSTRAINT uq_estoque_venda_item UNIQUE (id_venda, codigo)
);

CREATE INDEX IF NOT EXISTS idx_estoque_venda_itens_sem_ficha
  ON estoque_venda_itens (sem_ficha) WHERE sem_ficha = TRUE AND processado = FALSE;

-- ── Jobs de sync BK Office ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_sync_jobs (
  id_job SERIAL PRIMARY KEY,
  id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'rodando', 'ok', 'erro')),
  mensagem TEXT,
  criado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  iniciado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Break (consumo colaboradores) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_break (
  id_break SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  data_break DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'refeicao'
    CHECK (tipo IN ('refeicao', 'outro')),
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'lancado'
    CHECK (status IN ('lancado', 'estornado')),
  criado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque_break_itens (
  id_item SERIAL PRIMARY KEY,
  id_break INTEGER NOT NULL REFERENCES estoque_break(id_break) ON DELETE CASCADE,
  id_produto INTEGER REFERENCES produtos(id_produto) ON DELETE SET NULL,
  id_produto_venda INTEGER REFERENCES produtos_venda(id_produto_venda) ON DELETE SET NULL,
  codigo TEXT,
  descricao TEXT,
  quantidade NUMERIC(14, 3) NOT NULL CHECK (quantidade > 0)
);

-- ── Seed saldos a partir da última contagem finalizada ─────────────────────
INSERT INTO estoque_saldos (id_loja, id_produto, quantidade, atualizado_em)
SELECT c.id_loja,
       i.id_produto,
       COALESCE(i.estoque_contado, i.estoque_sistema, 0),
       COALESCE(c.finalizado_em, NOW())
FROM estoque_itens i
JOIN estoque_contagens c ON c.id_contagem = i.id_contagem
JOIN (
  SELECT DISTINCT ON (id_loja) id_contagem, id_loja
  FROM estoque_contagens
  WHERE status = 'finalizada'
  ORDER BY id_loja, data_contagem DESC, id_contagem DESC
) u ON u.id_contagem = c.id_contagem
ON CONFLICT (id_loja, id_produto) DO NOTHING;

COMMIT;
