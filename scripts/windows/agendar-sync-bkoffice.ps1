# DESATIVADO — nao agenda mais tarefa (abria shell).
# Use INSTALAR-SERVICO-BKOFFICE.bat (servico Python 24h).
Write-Host 'DESATIVADO: agendar-sync-bkoffice.ps1'
Write-Host 'Use INSTALAR-SERVICO-BKOFFICE.bat como administrador.'
Unregister-ScheduledTask -TaskName 'Meridian-BKOffice-Terraco' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'Tarefa Meridian-BKOffice-Terraco removida (se existia).'
