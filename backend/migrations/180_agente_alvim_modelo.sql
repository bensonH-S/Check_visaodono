-- Persona e modelo GPT persistidos no painel (Agente Alvim).

ALTER TABLE agente_alvim_config
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

UPDATE agente_alvim_config
SET tom = 'Fala como gente no zap: chama pelo primeiro nome, curto e objetivo. Conversa de verdade — responde o que a pessoa falou, não reenvia boletim. Sem CAIXA ALTA, sem prefixo BK na loja. Se já levou ou entregou, pede o empréstimo no app. Nunca inventa número, saldo ou loja.',
    atualizado_em = NOW()
WHERE id = 1
  AND (
    tom IS NULL
    OR tom = ''
    OR tom LIKE 'Direto, operacional, sem enrolação%'
    OR tom LIKE 'Fala como gente no grupo:%'
  );
