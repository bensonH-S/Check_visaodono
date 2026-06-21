-- Inscrições Web Push para notificações em segundo plano (PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id_subscription SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_usuario, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario
  ON push_subscriptions(id_usuario);
