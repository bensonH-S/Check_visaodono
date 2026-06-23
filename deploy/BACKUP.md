# Backup automático — Meridian (vision_check)

Backup diário do PostgreSQL às **00:00** (horário de Brasília), com retenção configurável.

## Instalação no servidor (uma vez)

```bash
cd /var/www/app/Check_visaodono   # pasta do projeto no servidor

# Teste manual
chmod +x deploy/backup-db.sh deploy/install-backup-cron.sh deploy/restore-db.sh
./deploy/backup-db.sh

# Agenda cron à meia-noite
./deploy/install-backup-cron.sh
```

Requisito: `postgresql-client` (`pg_dump`):

```bash
sudo apt update && sudo apt install -y postgresql-client
```

## Configuração (.env na raiz)

```env
# Pasta dos dumps (padrão: ./backups na raiz do projeto)
BACKUP_DIR=backups

# Quantos dias manter (padrão: 30)
BACKUP_RETENTION_DAYS=30

# Incluir pasta uploads/ no backup (opcional, aumenta bastante o tamanho)
BACKUP_UPLOADS=false
```

Se já existir `/var/www/app/backups/`, pode apontar:

```env
BACKUP_DIR=/var/www/app/backups
```

## O que é gerado

| Arquivo | Descrição |
|---------|-----------|
| `vision_check_YYYYMMDD_HHMMSS.sql.gz` | Dump SQL compactado |
| `latest.sql.gz` | Link simbólico para o backup mais recente |
| `uploads_*.tar.gz` | Só se `BACKUP_UPLOADS=true` |

Log do cron: `Logs/backup-cron.log`

## Restaurar um backup

```bash
# Listar backups disponíveis
./deploy/restore-db.sh

# Restaurar (pede confirmação RESTAURAR)
./deploy/restore-db.sh backups/vision_check_20260606_000012.sql.gz
./deploy/restore-db.sh latest
```

**Atenção:** o restore sobrescreve o banco atual. Pare o app antes se quiser evitar conexões durante a operação:

```bash
docker compose stop app
./deploy/restore-db.sh latest
docker compose start app
```

## Verificar se o cron está ativo

```bash
crontab -l
tail -f Logs/backup-cron.log
ls -lah backups/
```

## Remover o agendamento

```bash
crontab -l | grep -v backup-db.sh | crontab -
```
