-- Razão social do proprietário (SEFAZ-DF IPVA) e suporte a sync de débitos independente
ALTER TABLE frota_debitos_detran ADD COLUMN IF NOT EXISTS razao_social TEXT;

COMMENT ON COLUMN frota_debitos_detran.razao_social IS 'Razão social / proprietário retornado pela consulta SEFAZ-DF IPVA';
COMMENT ON COLUMN frota_debitos_detran.valor_original IS 'Valor principal (IPVA SEFAZ) ou valor original (licenciamento)';
COMMENT ON COLUMN frota_debitos_detran.valor_mora IS 'Valor juros (IPVA SEFAZ) ou mora (licenciamento)';
COMMENT ON COLUMN frota_debitos_detran.boleto IS 'URL do boleto PDF (boleto_pdf_url) ou linha digitável';
