-- Responsável e data de notificação da autuação (Infosimples DETRAN-DF)
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS responsavel_infracao TEXT;
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS data_notificacao_autuacao DATE;
