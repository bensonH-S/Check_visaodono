BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('estoque.produtos', 'Produtos — cadastrar e editar', 'Estoque', 200),
  ('estoque.conferencia', 'Conferência — iniciar, salvar e finalizar', 'Estoque', 201)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('estoque.produtos'), ('estoque.conferencia')) AS p(codigo)
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS produtos (
  id_produto SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  unidade_contagem TEXT NOT NULL DEFAULT 'und',
  preco_caixa NUMERIC(14, 4) NOT NULL DEFAULT 0,
  und_convertida NUMERIC(14, 4) NOT NULL DEFAULT 1,
  valor_unidade NUMERIC(14, 6) GENERATED ALWAYS AS (
    CASE WHEN und_convertida > 0 THEN ROUND(preco_caixa / und_convertida, 6) ELSE 0 END
  ) STORED,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos (descricao);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos (ativo);

CREATE TABLE IF NOT EXISTS estoque_contagens (
  id_contagem SERIAL PRIMARY KEY,
  id_loja INT REFERENCES lojas(id_loja) ON DELETE SET NULL,
  data_contagem DATE NOT NULL DEFAULT CURRENT_DATE,
  titulo TEXT,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'finalizada')),
  observacao TEXT,
  total_valor NUMERIC(14, 2),
  criado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_estoque_contagens_loja ON estoque_contagens (id_loja);
CREATE INDEX IF NOT EXISTS idx_estoque_contagens_data ON estoque_contagens (data_contagem DESC);

CREATE TABLE IF NOT EXISTS estoque_itens (
  id_item SERIAL PRIMARY KEY,
  id_contagem INT NOT NULL REFERENCES estoque_contagens(id_contagem) ON DELETE CASCADE,
  id_produto INT NOT NULL REFERENCES produtos(id_produto),
  estoque_sistema NUMERIC(14, 4) NOT NULL DEFAULT 0,
  estoque_contado NUMERIC(14, 4),
  UNIQUE (id_contagem, id_produto)
);

CREATE INDEX IF NOT EXISTS idx_estoque_itens_contagem ON estoque_itens (id_contagem);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_produto ON estoque_itens (id_produto);

-- Catálogo inicial (planilha Contagem PLK — códigos gerados PLK-####)
INSERT INTO produtos (codigo, descricao, unidade_contagem, preco_caixa, und_convertida)
VALUES
  ('PLK-0001', 'BATATA PREF CONG CAJUN PLK C/4X2,5KG IMP', 'kg', 195.13, 10.0),
  ('PLK-0002', 'BATTER GOLD STANDARD CX C/6X2,1 12,6KG', 'kg', 442.34, 12.6),
  ('PLK-0003', 'CEBOLA FRITA CRISPY BENASSI SC 10x500G', 'kg', 197.09, 5.0),
  ('PLK-0004', 'PAO CONG BRIOCHE CLEAN LABEL CX C/270UN', 'und', 183.74, 270.0),
  ('PLK-0005', 'PAO RIVIERA CONGELADO CX C/270 UN', 'und', 236.39, 270.0),
  ('PLK-0006', 'FILES FRANGO TIRAS PLK 252 UN CX C/12KG', 'und', 245.02, 252.0),
  ('PLK-0007', 'MINI FILES DE FRANGO PLK 545 UN C/12 KG', 'und', 336.84, 545.0),
  ('PLK-0008', 'PEDACOS DE FRANGO PLK CX 108UN 13,62KG', 'und', 194.51, 108.0),
  ('PLK-0009', 'PEITO DE FRANGO 100G PLK 180 UN  C/18 KG', 'und', 531.98, 180.0),
  ('PLK-0010', 'PEITO DE FRANGO 70G PLK CX 168UN C/12KG', 'und', 299.01, 168.0),
  ('PLK-0011', 'BACON PRONTO CONG 1187 UND CX/ 4KG DIS', 'und', 160.65, 1187.0),
  ('PLK-0012', 'MANTEIGA LIQUIDA BD C/ 3,2 KG', 'und', 76.42, 3.2),
  ('PLK-0013', 'MOLHO BBQ BRANCO CX C/5,5KG 5X1 ,1KG', 'kg', 95.12, 5.5),
  ('PLK-0014', 'DOCE DE LEITE CONFEITARIA MOCA CX 8X1 ,01KG', 'kg', 286.14, 1.01),
  ('PLK-0015', 'CALDA DE CHOCOLATE GANACHE CX 6KG', 'kg', 120.86, 1.5),
  ('PLK-0016', 'MOLHO CHEDDAR BISNAGA PPY CX 1,5 KG X 4UND', 'kg', 148.54, 4.0),
  ('PLK-0017', 'BOMBOM SORBET DE PACOCA CX C 12UN', 'und', 107.76, 1.29),
  ('PLK-0018', 'CHURROS STICK CX C/198 UND 3X66UN', 'und', 92.96, 2.0),
  ('PLK-0019', 'ALFACE AMERICANA POPEYES C/4 KG', 'kg', 70.22, 4.0),
  ('PLK-0020', 'TOMATE CARMEN INTEIRO POPEYES CX 7KG', 'kg', 87.71, 7.0),
  ('PLK-0021', 'QUEIJO MGA CHEDDAR PLK 768 UN KG 8,4', 'und', 302.31, 768.0),
  ('PLK-0022', 'FARINHA DE TRIGO POPEYES 25KG029294', 'kg', 109.61, 25.0),
  ('PLK-0023', 'OLEO ALGODAO PLK 18KG CX 6X3', 'kg', 211.47, 18.0),
  ('PLK-0024', 'PICKLES C/ SALMOURA PLK CX 6X200 1200 UN', 'und', 275.45, 1200.0),
  ('PLK-0025', 'SAL REFINADO SACHE CX 0.8X2500UN NOVO', 'und', 29.46, 2500.0),
  ('PLK-0026', 'AGUA COPO 310 ML CX C/48 UN POPEYES', 'und', 47.87, 48.0),
  ('PLK-0027', 'TEMPERO SUAVE CX C/22KG', 'kg', 451.35, 22.0),
  ('PLK-0028', 'BALDE EM PAPEL CARTONADO 3,0 LT PPY CX 160UND', 'und', 201.1, 160.0),
  ('PLK-0029', 'BALDE GRANDE 1,5LT PLK CX C/200 UN', 'und', 247.37, 200.0),
  ('PLK-0030', 'POTE  900 ML PPY 500 UND', 'und', 325.33, 500.0),
  ('PLK-0031', 'CAIXA VIAGEM GRANDE PLK CX C/100UN', 'und', 155.77, 100.0),
  ('PLK-0032', 'CAIXA VIAGEM MEDIA POPEYES CX C/100 UN', 'und', 100.27, 100.0),
  ('PLK-0033', 'CANUDO PAPEL REFRIGERANTE PLK CX C/3000', 'und', 138.4, 300.0),
  ('PLK-0034', 'CART BATATA GRANDE POPEYES CX C/1600 UN', 'und', 302.46, 1600.0),
  ('PLK-0035', 'CART BATATA MD PLK CX C/1600UN NOVA', 'und', 190.31, 1600.0),
  ('PLK-0036', 'CARTONAGEM DELIVERY FRITOS M PLK 500UN', 'und', 137.28, 500.0),
  ('PLK-0037', 'COPO 440 ML POPEYES CX C/900 UN', 'und', 277.7, 900.0),
  ('PLK-0038', 'POTE 150 ML PPY TUICIAL CX500UN', 'und', 100.47, 500.0),
  ('PLK-0039', 'TAMPA 150ML PPY TUICIAL CX 1000UN', 'und', 88.21, 1000.0),
  ('PLK-0040', 'FUNDO BANDEJA POPEYES BOX CX C/ 600 UN', 'und', 108.25, 1000.0),
  ('PLK-0041', 'GUARDANAPO EMB SACHE 40X15 CX C/4000', 'und', 111.81, 4000.0),
  ('PLK-0042', 'LACRE DE SEGURANCA DLV PLK C/ 500UN', 'und', 12.21, 500.0),
  ('PLK-0043', 'LAMINA BOOM BOX POPEYES PT C/3000 UN', 'und', 291.42, 3000.0),
  ('PLK-0044', 'LAMINA POPEYES POP BOX 25X30 FD/3000 UN', 'und', 156.9, 3000.0),
  ('PLK-0045', 'SACO 12 LIBRAS GD PLK  PT C/1000 UN', 'und', 149.9, 1000.0),
  ('PLK-0046', 'SACO 6 LIBRAS PQ PLK PT C/1000 UN', 'und', 136.1, 1000.0),
  ('PLK-0047', 'SACO DE BATATA PEQUENA 22x11 PLK', 'und', 33.15, 242.0),
  ('PLK-0048', 'SACO DE PAPEL PLK C/ 250UN', 'und', 146.27, 250.0),
  ('PLK-0049', 'SAQUINHO DE MINI FILE 34X19 PLK', 'und', 32.47, 500.0),
  ('PLK-0050', 'COPO CORTESIA 200ML CX C/2500 UN', 'und', 119.97, 2500.0),
  ('PLK-0051', 'GUARDANAPO INTERFOLHADO CX C/ 5400 UN', 'und', 112.53, 5400.0),
  ('PLK-0052', 'KIT GARFO/FACA EMBALADOS 400UN', 'und', 179.28, 400.0),
  ('PLK-0053', 'TAMPA COPO 440 ML CX C/ 1800 UN', 'und', 173.92, 1800.0),
  ('PLK-0054', 'KETCHUP HEINZ SACHE 176X7G', 'und', 10.73, 176.0),
  ('PLK-0055', 'MAIONESE DE ALHO BLISTER CX C/96UN', 'und', 97.4, 36.0),
  ('PLK-0056', 'MAIONESE POPEYES  C/5,5 KG', 'kg', 104.63, 5.5),
  ('PLK-0057', 'MOLHO BARBECUE BLISTER PLK CX 144X28G', 'und', 92.69, 144.0),
  ('PLK-0058', 'MOLHO BARBECUE POPEYES  C/5,5 KG', 'kg', 87.88, 5.5),
  ('PLK-0059', 'MOLHO LOUISIANA POPEYES C/5,5 KG', 'kg', 111.99, 5.5),
  ('PLK-0060', 'MOLHO LOUSIANA PLK PT 30G CX/ 72 UN NOVO', 'und', 104.28, 72.0),
  ('PLK-0061', 'MOLHO NOLA POPEYES C/5,5 KG', 'kg', 115.15, 5.5),
  ('PLK-0062', 'MOSTARDA HEINZ SC 5G POPEYES CX C/192', 'und', 8.44, 192.0),
  ('PLK-0063', 'MOLHO PARMESAO E ALHO BAG PLK CX5X1', 'und', 83.13, 5.5),
  ('PLK-0064', 'MOLHO HOT LEMON PEPPER BAG PLK CX 5X1', 'und', 65.59, 5.5),
  ('PLK-0065', 'CC ZERO LT 6X310ML', 'und', 13.52, 2.25),
  ('PLK-0066', 'COCA COLA LT 15X310ML', 'und', 34.81, 2.32),
  ('PLK-0067', 'FANTA GUARANA LT SIX 6X310ML', 'und', 13.75, 2.29),
  ('PLK-0068', 'FANTA GUARANA ZERO 6X310ML', 'und', 13.37, 2.22),
  ('PLK-0069', 'FANTA LARANJA LT 6X310ML', 'und', 13.05, 2.17),
  ('PLK-0070', 'SPRITE ORIGINAL LT 6X310ML', 'und', 13.05, 2.17),
  ('PLK-0071', 'SUCO DE LARANJA INTEGRAL CX 12X300ML', 'und', 38.66, 12.0),
  ('PLK-0072', 'COCA S/A BAG IN BOX 10L', 'kg', 197.67, 10.0),
  ('PLK-0073', 'SPRITE BAG IN BOX 10L', 'kg', 197.67, 10.0),
  ('PLK-0074', 'FANTA LAR BAG IN BOX 10L', 'kg', 197.67, 10.0),
  ('PLK-0075', 'FANTA GUARANA BAG IN BOX 10L', 'kg', 197.67, 10.0),
  ('PLK-0076', 'COCA COLA BIB 18L', 'kg', 355.8, 18.0),
  ('PLK-0077', 'SUCO DE UVA INTEGRAL CX 12X300ML', 'und', 36.31, 12.0)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  unidade_contagem = EXCLUDED.unidade_contagem,
  preco_caixa = EXCLUDED.preco_caixa,
  und_convertida = EXCLUDED.und_convertida,
  atualizado_em = NOW();

-- Contagem de referência (01/07/2026 PLK 15022) com estoque da planilha
INSERT INTO estoque_contagens (data_contagem, titulo, status, observacao, finalizado_em)
SELECT
  DATE '2026-07-01',
  'Contagem PLK 15022 — 01/07/2026',
  'finalizada',
  'Importada da planilha Estoque 01 de julho de 2026 PLK 15022',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM estoque_contagens
  WHERE titulo = 'Contagem PLK 15022 — 01/07/2026'
);

INSERT INTO estoque_itens (id_contagem, id_produto, estoque_sistema, estoque_contado)
SELECT c.id_contagem, p.id_produto, s.estoque_final, s.estoque_final
FROM estoque_contagens c
CROSS JOIN (VALUES
  ('PLK-0001', 10.0),
  ('PLK-0002', 75.0),
  ('PLK-0003', 2.0),
  ('PLK-0004', 823.0),
  ('PLK-0005', 382.0),
  ('PLK-0006', 948.0),
  ('PLK-0007', 3598.0),
  ('PLK-0008', 0.0),
  ('PLK-0009', 478.0),
  ('PLK-0010', 987.0),
  ('PLK-0011', 1187.0),
  ('PLK-0012', 1.0),
  ('PLK-0013', 27.0),
  ('PLK-0014', 1.0),
  ('PLK-0015', 1.0),
  ('PLK-0016', 0.0),
  ('PLK-0017', 12.0),
  ('PLK-0018', 37.0),
  ('PLK-0019', 4.0),
  ('PLK-0020', 7.0),
  ('PLK-0021', 384.0),
  ('PLK-0022', 125.0),
  ('PLK-0023', 216.0),
  ('PLK-0024', 54.0),
  ('PLK-0025', 1956.0),
  ('PLK-0026', 0.0),
  ('PLK-0027', 24.0),
  ('PLK-0028', 0.0),
  ('PLK-0029', 112.0),
  ('PLK-0030', 325.0),
  ('PLK-0031', 49.0),
  ('PLK-0032', 16.0),
  ('PLK-0033', 2418.0),
  ('PLK-0034', 1520.0),
  ('PLK-0035', 1435.0),
  ('PLK-0036', 408.0),
  ('PLK-0037', 1100.0),
  ('PLK-0038', 875.0),
  ('PLK-0039', 12.0),
  ('PLK-0040', 1158.0),
  ('PLK-0041', 471.0),
  ('PLK-0042', 1500.0),
  ('PLK-0043', 6000.0),
  ('PLK-0044', 3000.0),
  ('PLK-0045', 236.0),
  ('PLK-0046', 946.0),
  ('PLK-0047', 1068.0),
  ('PLK-0048', 769.0),
  ('PLK-0049', 1031.0),
  ('PLK-0050', 3500.0),
  ('PLK-0051', 5000.0),
  ('PLK-0052', 210.0),
  ('PLK-0053', 1700.0),
  ('PLK-0054', 5104.0),
  ('PLK-0055', 38.0),
  ('PLK-0056', 11.0),
  ('PLK-0057', 140.0),
  ('PLK-0058', 44.0),
  ('PLK-0059', 27.0),
  ('PLK-0060', 0.0),
  ('PLK-0061', 16.0),
  ('PLK-0062', 384.0),
  ('PLK-0063', 0.0),
  ('PLK-0064', 0.0),
  ('PLK-0065', 329.0),
  ('PLK-0066', 525.0),
  ('PLK-0067', 324.0),
  ('PLK-0068', 363.0),
  ('PLK-0069', 244.0),
  ('PLK-0070', 183.0),
  ('PLK-0071', 6.0),
  ('PLK-0072', 10.0),
  ('PLK-0073', 10.0),
  ('PLK-0074', 10.0),
  ('PLK-0075', 10.0),
  ('PLK-0076', 18.0),
  ('PLK-0077', 4.0)
) AS s(codigo, estoque_final)
JOIN produtos p ON p.codigo = s.codigo
WHERE c.titulo = 'Contagem PLK 15022 — 01/07/2026'
ON CONFLICT (id_contagem, id_produto) DO UPDATE SET
  estoque_sistema = EXCLUDED.estoque_sistema,
  estoque_contado = EXCLUDED.estoque_contado;

UPDATE estoque_contagens c
SET total_valor = sub.total
FROM (
  SELECT i.id_contagem,
         ROUND(SUM(COALESCE(i.estoque_contado, 0) * p.valor_unidade)::numeric, 2) AS total
  FROM estoque_itens i
  JOIN produtos p ON p.id_produto = i.id_produto
  GROUP BY i.id_contagem
) sub
WHERE c.id_contagem = sub.id_contagem
  AND c.titulo = 'Contagem PLK 15022 — 01/07/2026';

COMMIT;
