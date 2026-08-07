#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Instala o sync BK Office Terraço como serviço Windows (boot + 24h).

  powershell -ExecutionPolicy Bypass -File scripts\windows\install-servico-bkoffice.ps1
#>
$ErrorActionPreference = 'Stop'
$ServiceName = 'MeridianBkOfficeTerraco'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$NodeCmd = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $NodeCmd) { throw 'Node.js nao encontrado no PATH. Instale Node 20+ LTS.' }

$ToolsDir = Join-Path $RepoRoot 'scripts\windows\tools'
$NssmExe = Join-Path $ToolsDir 'nssm.exe'
$EnvFile = Join-Path $RepoRoot 'workers\bkoffice\.env'
$EnvExample = Join-Path $RepoRoot 'workers\bkoffice\.env.example'
$BackendEnv = Join-Path $RepoRoot 'backend\.env'
$LogDir = Join-Path $RepoRoot 'Logs'
New-Item -ItemType Directory -Force -Path $ToolsDir, $LogDir | Out-Null

Write-Host '== Meridian BK Office — instalar servico =='
Write-Host "Repo: $RepoRoot"

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim()
  }
  return $map
}

if (-not (Test-Path $EnvFile)) {
  $b = Read-DotEnv $BackendEnv
  if ($b.Count -eq 0 -and (Test-Path $EnvExample)) {
    Copy-Item $EnvExample $EnvFile
    Write-Host "ATENCAO: edite $EnvFile com senhas DB e BKOFFICE."
  } else {
    $dbName = if ($b['DB_NAME_PROD']) { $b['DB_NAME_PROD'] } else { 'vision_check' }
    $port = if ($b['DB_PORT']) { $b['DB_PORT'] } else { '5432' }
    $url = if ($b['BKOFFICE_URL']) { $b['BKOFFICE_URL'] } else { 'https://bkoffice-franquia.burgerking.com.br' }
    @(
      "DB_HOST=$($b['DB_HOST'])",
      "DB_PORT=$port",
      "DB_USER=$($b['DB_USER'])",
      "DB_PASS=$($b['DB_PASS'])",
      "DB_NAME_PROD=$dbName",
      "DB_NAME=$dbName",
      "BKOFFICE_USER=$($b['BKOFFICE_USER'])",
      "BKOFFICE_PASS=$($b['BKOFFICE_PASS'])",
      "BKOFFICE_URL=$url",
      'BKOFFICE_USE_CHROME=0',
      'BKOFFICE_HEADLESS=1',
      'BKOFFICE_TIMEOUT_MS=120000',
      'BKOFFICE_SYNC_ID_LOJA=21',
      'SYNC_INTERVAL_MS=60000'
    ) | Set-Content -Path $EnvFile -Encoding UTF8
    Write-Host "Criado $EnvFile"
  }
}

Write-Host 'Instalando Chromium Playwright...'
Push-Location $RepoRoot
try {
  & npm exec -- playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'playwright install falhou' }
} finally {
  Pop-Location
}

if (-not (Test-Path $NssmExe)) {
  Write-Host 'Baixando NSSM...'
  $zip = Join-Path $ToolsDir 'nssm.zip'
  Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip -UseBasicParsing
  $extract = Join-Path $ToolsDir 'nssm-extract'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $found = Get-ChildItem -Path $extract -Recurse -Filter nssm.exe |
    Where-Object { $_.FullName -match '\\win64\\nssm\.exe$' } |
    Select-Object -First 1
  if (-not $found) { throw 'nssm.exe win64 nao encontrado' }
  Copy-Item $found.FullName $NssmExe -Force
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
}

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  Write-Host 'Removendo servico antigo...'
  & $NssmExe stop $ServiceName confirm 2>$null | Out-Null
  Start-Sleep -Seconds 2
  & $NssmExe remove $ServiceName confirm 2>$null | Out-Null
  Start-Sleep -Seconds 1
}

$loop = 'workers/bkoffice/loop.mjs'
& $NssmExe install $ServiceName $NodeCmd $loop | Out-Null
& $NssmExe set $ServiceName AppDirectory $RepoRoot | Out-Null
& $NssmExe set $ServiceName AppStdout (Join-Path $LogDir 'bkoffice-service.out.log') | Out-Null
& $NssmExe set $ServiceName AppStderr (Join-Path $LogDir 'bkoffice-service.err.log') | Out-Null
& $NssmExe set $ServiceName AppRotateFiles 1 | Out-Null
& $NssmExe set $ServiceName AppRotateBytes 2097152 | Out-Null
& $NssmExe set $ServiceName AppRestartDelay 15000 | Out-Null
& $NssmExe set $ServiceName AppExit Default Restart | Out-Null
& $NssmExe set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmExe set $ServiceName Description 'Meridian sync BK Office Terraco -> producao (1 min)' | Out-Null
& $NssmExe set $ServiceName ObjectName LocalSystem | Out-Null

Write-Host 'Iniciando servico...'
& $NssmExe start $ServiceName | Out-Null
Start-Sleep -Seconds 3
Get-Service $ServiceName | Format-List Name, Status, StartType

Write-Host ''
Write-Host "OK: servico $ServiceName (Automatico no boot)."
Write-Host "Logs: $LogDir"
Write-Host 'Servidor Meridian fora do BR: BKOFFICE_SYNC_CRON_MS=0'
