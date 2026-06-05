-- Permissões granulares por usuário (substitui regras fixas por perfil)
BEGIN;

CREATE TABLE IF NOT EXISTS permissoes (
  codigo VARCHAR(60) PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  grupo VARCHAR(60) NOT NULL,
  ordem INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  codigo VARCHAR(60) NOT NULL REFERENCES permissoes(codigo) ON DELETE CASCADE,
  PRIMARY KEY (id_usuario, codigo)
);

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('portal.dashboard.ver', 'Ver dashboard (início)', 'Portal', 10),
  ('portal.ranking.ver', 'Ver ranking de lojas', 'Portal', 20),
  ('portal.visitas.ver', 'Ver histórico de visitas', 'Portal', 30),
  ('portal.lojas.ver', 'Ver cadastro de lojas', 'Portal', 40),
  ('portal.ncs.ver', 'Ver não conformidades', 'Portal', 50),
  ('checklist.ver', 'Ver módulo de checklist', 'Checklist', 60),
  ('checklist.executar', 'Executar checklist em loja', 'Checklist', 70),
  ('chamados.ver', 'Ver chamados de manutenção', 'Manutenção', 80),
  ('chamados.abrir', 'Abrir chamado de manutenção', 'Manutenção', 90),
  ('chamados.assumir', 'Assumir chamado (técnico)', 'Manutenção', 100),
  ('usuarios.listar', 'Listar usuários (ex.: escolher auditor)', 'Usuários', 110),
  ('usuarios.gerenciar', 'Gerenciar usuários e permissões', 'Usuários', 120),
  ('lojas.todas', 'Acesso a todas as lojas', 'Lojas', 130)
ON CONFLICT (codigo) DO NOTHING;

-- Zera permissões herdadas por perfil; TI recebe só gestão no seed
DELETE FROM usuario_permissoes;

COMMIT;
