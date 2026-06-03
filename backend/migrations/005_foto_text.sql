-- Fotos em base64 ou URL precisam de mais espaço que VARCHAR(500)
ALTER TABLE respostas ALTER COLUMN foto_url TYPE TEXT;
