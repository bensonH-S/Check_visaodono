#Requires -Version 5.1
<#
  Liga o sync AUTOMATICO na sessao do usuario (o mesmo caminho do TESTAR-UMA-VEZ).
  Tarefa oculta + MeridianBkSync.exe nao abre o Chrome do BK Office — por isso
  so funcionava no clique. Aqui: node worker.mjs na sessao logada + Inicializar
  + cao de guarda a cada 5 min se o processo morrer.
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'MeridianBkOfficeTerraco'
$Kit = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Kit = $Kit.TrimEnd('\')
$Node = Join-Path $Kit 'runtime\node\node.exe'
$WorkerMjs = Join-Path $Kit 'worker.mjs'
$Vault = Join-Path $Kit 'data\vault.dat'
$Vbs = Join-Path $Kit 'START-LOOP.vbs'
$LogDir = Join-Path $Kit 'Logs'
$StartupDir = [Environment]::GetFolderPath('Startup')
$Lnk = Join-Path $StartupDir 'Meridian BK Office.lnk'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-InstallLog([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path (Join-Path $LogDir 'install.log') -Value $line -Encoding UTF8
  Write-Host $line
}

function Stop-KitProcesses {
  Get-CimInstance Win32_Process -Filter "Name='MeridianBkSync.exe' OR Name='node.exe' OR Name='wscript.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -like "*$Kit*worker*" -or
        $_.CommandLine -like "*$Kit*START-LOOP*" -or
        $_.ExecutablePath -like "*$Kit*MeridianBkSync*"
      )
    } |
    ForEach-Object {
      Write-InstallLog "matando pid $($_.ProcessId)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host '=== Meridian BK Office — instalar automatico (sessao do usuario) ==='
Write-Host "Kit: $Kit"
Write-InstallLog "instalando KIT=$Kit"

if (-not (Test-Path $Node)) { throw "node.exe ausente: $Node" }
if (-not (Test-Path $WorkerMjs)) { throw "worker.mjs ausente: $WorkerMjs" }
if (-not (Test-Path $Vault)) { throw "cofre ausente: $Vault (regenere o kit)" }
if (-not (Test-Path (Join-Path $Kit 'key_parts.generated.mjs'))) {
  throw 'key_parts.generated.mjs ausente — regenere o kit com GERAR-KIT-PC-GERENCIA.bat'
}

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

foreach ($f in @($Vault, (Join-Path $Kit 'key_parts.generated.mjs'), (Join-Path $Kit 'data'))) {
  if (Test-Path $f) { attrib +H +S $f 2>$null }
}

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

Stop-KitProcesses

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'Meridian-BKOffice-Terraco' -Confirm:$false -ErrorAction SilentlyContinue

$vbsBody = @"
Option Explicit
Dim fso, sh, root, node, worker, wmi, procs, p, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
node = root & "\runtime\node\node.exe"
worker = root & "\worker.mjs"
If Not fso.FileExists(node) Then WScript.Quit 2
If Not fso.FileExists(worker) Then WScript.Quit 3
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each p In procs
  cmd = LCase(p.CommandLine & "")
  If InStr(cmd, "worker.mjs") > 0 And InStr(cmd, "--once") = 0 Then
    WScript.Quit 0
  End If
Next
sh.CurrentDirectory = root
sh.Run """" & node & """ """ & worker & """", 7, False
"@
[System.IO.File]::WriteAllText($Vbs, $vbsBody, [System.Text.Encoding]::ASCII)
Write-InstallLog "START-LOOP.vbs gravado"

$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($Lnk)
$sc.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$sc.Arguments = "//B `"$Vbs`""
$sc.WorkingDirectory = $Kit
$sc.WindowStyle = 7
$sc.Description = 'Meridian BK Office — loop automatico (mesma sessao do Testar)'
$sc.Save()
Write-InstallLog "atalho Inicializar: $Lnk"

$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$action = New-ScheduledTaskAction -Execute $wscript -Argument "//B `"$Vbs`"" -WorkingDirectory $Kit
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerWatch = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($triggerLogon, $triggerWatch) `
  -Settings $settings `
  -Principal $principal `
  -Description 'Meridian BK Office — se o loop morrer, religa na sessao logada (nao usa exe oculto)' `
  -Force | Out-Null

Write-InstallLog 'iniciando loop agora (node worker.mjs, janela minimizada)'
Start-Process -FilePath $Node -ArgumentList "`"$WorkerMjs`"" -WorkingDirectory $Kit -WindowStyle Minimized
Start-Sleep -Seconds 3

$rodando = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*worker.mjs*' -and $_.CommandLine -notlike '*--once*' }
$info = Get-ScheduledTask -TaskName $TaskName
$ti = Get-ScheduledTaskInfo -TaskName $TaskName
Write-InstallLog ("tarefa State={0} LastResult={1}" -f $info.State, $ti.LastTaskResult)
Write-InstallLog ("loop node={0}" -f ($(if ($rodando) { 'SIM pid=' + $rodando[0].ProcessId } else { 'NAO' })))

Write-Host ''
Write-Host '=== Status ==='
Write-Host ("Tarefa: {0}" -f $info.State)
Write-Host ("Loop node worker: {0}" -f ($(if ($rodando) { 'RODANDO' } else { 'NAO SUBIU — veja Logs\_servico.log' })))
Write-Host 'Atalho: Inicializar do Windows (liga depois do login)'
Write-Host 'Cao de guarda: a cada 5 min, se o processo morrer'
Write-Host "Log: $(Join-Path $LogDir '_servico.log')"
Write-Host ''
Write-Host 'Nao feche a sessao deste usuario. Testar e so disparo manual.'
Write-Host 'OK.'
