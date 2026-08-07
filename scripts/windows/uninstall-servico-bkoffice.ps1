#Requires -RunAsAdministrator
<#
  Remove o serviço MeridianBkOfficeTerraco.
  powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall-servico-bkoffice.ps1
#>
$ErrorActionPreference = 'Stop'
$ServiceName = 'MeridianBkOfficeTerraco'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$NssmExe = Join-Path $RepoRoot 'scripts\windows\tools\nssm.exe'

if (Test-Path $NssmExe) {
  & $NssmExe stop $ServiceName confirm 2>$null
  Start-Sleep -Seconds 2
  & $NssmExe remove $ServiceName confirm 2>$null
} else {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $ServiceName | Out-Null
}

Unregister-ScheduledTask -TaskName 'Meridian-BKOffice-Terraco' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "OK: servico/tarefa removidos (se existiam)."
