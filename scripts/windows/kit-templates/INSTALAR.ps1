#Requires -Version 5.1
<#
  Instala MeridianBkSync.exe como tarefa agendada OCULTA (usuario atual).
  Credenciais: apenas cofre criptografado data\vault.dat (sem config.env).
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'MeridianBkOfficeTerraco'
$Kit = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Kit = $Kit.TrimEnd('\')
$Exe = Join-Path $Kit 'MeridianBkSync.exe'
$WorkerMjs = Join-Path $Kit 'worker.mjs'
$Vault = Join-Path $Kit 'data\vault.dat'
$LogDir = Join-Path $Kit 'Logs'
$PdLog = Join-Path $env:ProgramData 'MeridianBkOffice\Logs'

New-Item -ItemType Directory -Force -Path $LogDir, $PdLog | Out-Null

function Write-InstallLog([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path (Join-Path $LogDir 'install.log') -Value $line -Encoding UTF8
  Write-Host $line
}

Write-Host ''
Write-Host '=== Meridian BK Office — instalar (cofre criptografado) ==='
Write-Host "Kit: $Kit"
Write-InstallLog "instalando tarefa KIT=$Kit"

if (-not (Test-Path $Exe)) { throw "MeridianBkSync.exe ausente: $Exe" }
if (-not (Test-Path $WorkerMjs)) { throw "worker.mjs ausente: $WorkerMjs" }
if (-not (Test-Path $Vault)) { throw "cofre ausente: $Vault (regenere o kit)" }
if (-not (Test-Path (Join-Path $Kit 'key_parts.generated.mjs'))) {
  throw 'key_parts.generated.mjs ausente — regenere o kit com GERAR-KIT-PC-GERENCIA.bat'
}

# Remove qualquer vazamento em texto claro
@(
  (Join-Path $Kit 'config.env'),
  (Join-Path $Kit 'app\.env'),
  (Join-Path $Kit 'app\backend\.env'),
  (Join-Path $Kit 'key_parts.generated.json')
) | ForEach-Object {
  if (Test-Path $_) {
    Write-InstallLog "removendo plaintext $_"
    Remove-Item $_ -Force -ErrorAction SilentlyContinue
  }
}

# Oculta cofre e chave embaralhada
foreach ($f in @($Vault, (Join-Path $Kit 'key_parts.generated.mjs'), (Join-Path $Kit 'data'))) {
  if (Test-Path $f) {
    attrib +H +S $f 2>$null
  }
}

# Remove servico NSSM antigo
$Nssm = Join-Path $Kit 'runtime\nssm.exe'
if (Get-Service -Name $TaskName -ErrorAction SilentlyContinue) {
  Write-InstallLog 'removendo servico NSSM antigo...'
  try {
    if (Test-Path $Nssm) {
      & $Nssm stop $TaskName confirm 2>$null | Out-Null
      Start-Sleep -Seconds 1
      & $Nssm remove $TaskName confirm 2>$null | Out-Null
    }
  } catch { }
  try {
    Stop-Service $TaskName -Force -ErrorAction SilentlyContinue
    sc.exe delete $TaskName 2>$null | Out-Null
  } catch { }
  Start-Sleep -Seconds 2
}

Get-CimInstance Win32_Process -Filter "Name='MeridianBkSync.exe' OR Name='node.exe' OR Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -like "*$Kit*worker*" -or
      $_.ExecutablePath -like "*$Kit*MeridianBkSync*"
    )
  } |
  ForEach-Object {
    Write-InstallLog "matando pid $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'Meridian-BKOffice-Terraco' -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $Exe -WorkingDirectory $Kit
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerOnce = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(5)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -Hidden
$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($triggerLogon, $triggerOnce) `
  -Settings $settings `
  -Principal $principal `
  -Description 'Meridian BK Office Terraco — sync oculto (cofre criptografado)' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$info = Get-ScheduledTask -TaskName $TaskName
$ti = Get-ScheduledTaskInfo -TaskName $TaskName
Write-InstallLog ("tarefa State={0} LastResult={1}" -f $info.State, $ti.LastTaskResult)

Write-Host ''
Write-Host '=== Status ==='
Write-Host ("Tarefa: {0}" -f $info.State)
Write-Host 'Credenciais: cofre AES (data\vault.dat) — sem config.env'
Write-Host "Log: $(Join-Path $LogDir 'bkoffice-python-service.log')"
Write-Host ''
Write-Host 'OK. Executavel em loop. Liga apos login.'
