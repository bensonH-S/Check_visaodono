BEGIN;

CREATE TABLE IF NOT EXISTS escala_visitas_delivery_status (
  id_semana INT NOT NULL PRIMARY KEY REFERENCES escala_visitas_semana(id_semana) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovado')),
  submetido_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  submetido_em TIMESTAMPTZ,
  revisado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  comentario TEXT
);

COMMIT;
