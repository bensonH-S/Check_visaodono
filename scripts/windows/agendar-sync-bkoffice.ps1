# Agenda sync BK Office a cada 1 minuto (PC gerencia Brasil -> banco producao).
$ErrorActionPreference = 'Stop'
$taskName = 'Meridian-BKOffice-Terraco'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bat = Join-Path $repo 'scripts\windows\sync-bkoffice-terraco.bat'
$logs = Join-Path $repo 'Logs'
$logFile = Join-Path $logs 'bkoffice-sync-local.log'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (-not (Test-Path $bat)) { throw "BAT nao encontrado: $bat" }

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $bat -WorkingDirectory $repo
# Repeticao 1 min por 1 ano (renovar depois se precisar)
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 365)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Meridian vendas BK Office Terraco 1 min -> producao' | Out-Null

Write-Host "OK: tarefa $taskName a cada 1 minuto."
Write-Host "Repo: $repo"
Write-Host "Log: $logFile"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State
Get-ScheduledTaskInfo -TaskName $taskName | Format-List NextRunTime
