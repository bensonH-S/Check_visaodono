#Requires -Version 5.1
<#
  Instala o worker BK Office como tarefa agendada OCULTA (usuario atual).
  Motivo: servico LocalSystem falha com Chrome + pasta OneDrive.

  powershell -ExecutionPolicy Bypass -File INSTALAR.ps1
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'MeridianBkOfficeTerraco'
$Kit = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Kit = $Kit.TrimEnd('\')
$Py = Join-Path $Kit 'runtime\python\python.exe'
$PyW = Join-Path $Kit 'runtime\python\pythonw.exe'
$Worker = Join-Path $Kit 'worker.py'
$LogDir = Join-Path $Kit 'Logs'
$Nssm = Join-Path $Kit 'runtime\nssm.exe'
$PdLog = Join-Path $env:ProgramData 'MeridianBkOffice\Logs'

New-Item -ItemType Directory -Force -Path $LogDir, $PdLog | Out-Null

function Write-InstallLog([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path (Join-Path $LogDir 'install.log') -Value $line -Encoding UTF8
  Write-Host $line
}

Write-Host ''
Write-Host '=== Meridian BK Office — instalar (tarefa oculta) ==='
Write-Host "Kit: $Kit"
Write-InstallLog "instalando tarefa KIT=$Kit"

if (-not (Test-Path $Py)) { throw "python.exe ausente: $Py" }
if (-not (Test-Path $Worker)) { throw "worker.py ausente: $Worker" }
if (-not (Test-Path (Join-Path $Kit 'config.env'))) { throw 'config.env ausente' }

# Forca Chrome no config
$cfg = Join-Path $Kit 'config.env'
$raw = Get-Content $cfg -Raw -Encoding UTF8
$raw = $raw -replace '(?m)^BKOFFICE_USE_CHROME=.*', 'BKOFFICE_USE_CHROME=1'
$raw = $raw -replace '(?m)^BKOFFICE_HEADLESS=.*', 'BKOFFICE_HEADLESS=1'
if ($raw -notmatch '(?m)^BKOFFICE_USE_CHROME=') { $raw += "`r`nBKOFFICE_USE_CHROME=1" }
if ($raw -notmatch '(?m)^BKOFFICE_HEADLESS=') { $raw += "`r`nBKOFFICE_HEADLESS=1" }
Set-Content -Path $cfg -Value $raw -Encoding UTF8 -NoNewline
Copy-Item $cfg (Join-Path $Kit 'app\backend\.env') -Force -ErrorAction SilentlyContinue
Copy-Item $cfg (Join-Path $Kit 'app\.env') -Force -ErrorAction SilentlyContinue

# Remove servico NSSM quebrado (LocalSystem) — pode precisar admin; nao aborta se falhar
if (Get-Service -Name $TaskName -ErrorAction SilentlyContinue) {
  Write-InstallLog 'removendo servico NSSM antigo...'
  try {
    if (Test-Path $Nssm) {
      & $Nssm stop $TaskName confirm 2>$null | Out-Null
      Start-Sleep -Seconds 1
      & $Nssm remove $TaskName confirm 2>$null | Out-Null
    }
  } catch {
    Write-InstallLog "NSSM remove falhou (ok se sem admin): $($_.Exception.Message)"
  }
  try {
    Stop-Service $TaskName -Force -ErrorAction SilentlyContinue
    sc.exe delete $TaskName 2>$null | Out-Null
  } catch { }
  Start-Sleep -Seconds 2
}

# Mata worker antigo
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$Kit*worker.py*" } |
  ForEach-Object {
    Write-InstallLog "matando pid $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'Meridian-BKOffice-Terraco' -Confirm:$false -ErrorAction SilentlyContinue

# pythonw = sem janela; -u = log sem buffer
$exe = if (Test-Path $PyW) { $PyW } else { $Py }
$arg = "-u `"$Worker`""

$action = New-ScheduledTaskAction -Execute $exe -Argument $arg -WorkingDirectory $Kit
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# tambem sobe agora (1x) — o worker fica em loop infinito
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
  -Description 'Meridian BK Office Terraco — worker Python 24h (oculto, usuario atual)' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$info = Get-ScheduledTask -TaskName $TaskName
$ti = Get-ScheduledTaskInfo -TaskName $TaskName
Write-InstallLog ("tarefa State={0} LastResult={1}" -f $info.State, $ti.LastTaskResult)

# Confere processo
$procs = Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*worker.py*' }
if ($procs) {
  Write-InstallLog ("OK processo rodando pid={0}" -f ($procs | Select-Object -First 1 -ExpandProperty ProcessId))
} else {
  Write-InstallLog 'AVISO: processo worker ainda nao apareceu — veja Logs'
}

Start-Sleep -Seconds 3
$logKit = Join-Path $LogDir 'bkoffice-python-service.log'
$logPd = Join-Path $PdLog 'bkoffice-python-service.log'
Write-Host ''
Write-Host '=== Status ==='
Write-Host ("Tarefa: {0}" -f $info.State)
if (Test-Path $logKit) {
  Write-Host '--- ultimas linhas Logs\bkoffice-python-service.log ---'
  Get-Content $logKit -Tail 15 -ErrorAction SilentlyContinue
} elseif (Test-Path $logPd) {
  Write-Host '--- ultimas linhas ProgramData ---'
  Get-Content $logPd -Tail 15 -ErrorAction SilentlyContinue
} else {
  Write-Host 'Log ainda nao criado — aguarde 10s e rode VERIFICAR.bat'
}

Write-Host ''
Write-Host 'OK. Worker em loop (1 min). Sem janela. Liga apos login.'
Write-Host "Log: $logKit"
