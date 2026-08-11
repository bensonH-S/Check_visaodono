#Requires -Version 5.1
<#
.SYNOPSIS
  Gera pasta PORTATIL no Desktop para o PC da gerencia.

  Saida: Desktop\Meridian-BKOffice-Gerencia\
  Zip:   Desktop\Meridian-BKOffice-Gerencia.zip
#>
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Tpl = Join-Path $PSScriptRoot 'kit-templates'
$Desktop = [Environment]::GetFolderPath('Desktop')
$OutDir = Join-Path $Desktop 'Meridian-BKOffice-Gerencia'
$NodeVer = 'v20.18.1'
$PyVer = '3.12.8'

Write-Host '== Gerando kit portatil Meridian BK Office =='
Write-Host "Repo: $RepoRoot"
Write-Host "Saida: $OutDir"

if (Test-Path $OutDir) {
  Write-Host 'Removendo pasta antiga...'
  Remove-Item $OutDir -Recurse -Force
}
$Runtime = Join-Path $OutDir 'runtime'
$App = Join-Path $OutDir 'app'
New-Item -ItemType Directory -Force -Path $OutDir, $Runtime, $App, (Join-Path $OutDir 'Logs') | Out-Null

function Copy-Tree([string]$src, [string]$dst, [string[]]$excludeDir) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -Path $src -Force | ForEach-Object {
    if ($_.PSIsContainer -and ($excludeDir -contains $_.Name)) { return }
    $target = Join-Path $dst $_.Name
    if ($_.PSIsContainer) {
      Copy-Tree $_.FullName $target $excludeDir
    } else {
      Copy-Item $_.FullName $target -Force
    }
  }
}

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim()
  }
  return $map
}

Write-Host 'Copiando templates...'
Copy-Item (Join-Path $Tpl 'worker.mjs') (Join-Path $OutDir 'worker.mjs') -Force
Copy-Item (Join-Path $Tpl 'vault_tools.mjs') (Join-Path $OutDir 'vault_tools.mjs') -Force
Copy-Item (Join-Path $Tpl 'INSTALAR.bat') (Join-Path $OutDir 'INSTALAR.bat') -Force
Copy-Item (Join-Path $Tpl 'INSTALAR.ps1') (Join-Path $OutDir 'INSTALAR.ps1') -Force
Copy-Item (Join-Path $Tpl 'DESINSTALAR.bat') (Join-Path $OutDir 'DESINSTALAR.bat') -Force
Copy-Item (Join-Path $Tpl '0-LEIA-ME.txt') (Join-Path $OutDir '0-LEIA-ME.txt') -Force
Copy-Item (Join-Path $Tpl 'VERIFICAR.bat') (Join-Path $OutDir 'VERIFICAR.bat') -Force
Copy-Item (Join-Path $Tpl 'TESTAR-UMA-VEZ.bat') (Join-Path $OutDir 'TESTAR-UMA-VEZ.bat') -Force
Copy-Item (Join-Path $Tpl 'MeridianBkSync.cs') (Join-Path $OutDir 'MeridianBkSync.cs') -Force

Write-Host 'Copiando codigo do sync...'
New-Item -ItemType Directory -Force -Path (Join-Path $App 'backend\scripts') | Out-Null
Copy-Item (Join-Path $RepoRoot 'backend\scripts\sync-bkoffice-via-api.mjs') (Join-Path $App 'backend\scripts\') -Force
Copy-Item (Join-Path $RepoRoot 'backend\scripts\sync-bkoffice-vendas.mjs') (Join-Path $App 'backend\scripts\') -Force
Copy-Tree (Join-Path $RepoRoot 'backend\src') (Join-Path $App 'backend\src') @('__tests__')

$pkg = @{
  name = 'meridian-bkoffice-kit'
  private = $true
  type = 'module'
  dependencies = @{
    dotenv = '^16.4.7'
    pg = '^8.13.3'
    playwright = '^1.62.0'
    xlsx = '^0.18.5'
  }
} | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $App 'package.json'), $pkg)

Write-Host 'Baixando Node portatil...'
$nodeZip = Join-Path $Runtime 'node.zip'
Invoke-WebRequest -Uri "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" -OutFile $nodeZip -UseBasicParsing
Expand-Archive -Path $nodeZip -DestinationPath $Runtime -Force
$nodeFolder = Get-ChildItem $Runtime -Directory | Where-Object { $_.Name -like 'node-v*' } | Select-Object -First 1
$nodeDest = Join-Path $Runtime 'node'
if (Test-Path $nodeDest) { Remove-Item $nodeDest -Recurse -Force }
Move-Item $nodeFolder.FullName $nodeDest
Remove-Item $nodeZip -Force

Write-Host 'Baixando Python embeddable...'
$pyZip = Join-Path $Runtime 'python.zip'
Invoke-WebRequest -Uri "https://www.python.org/ftp/python/$PyVer/python-$PyVer-embed-amd64.zip" -OutFile $pyZip -UseBasicParsing
$pyDir = Join-Path $Runtime 'python'
New-Item -ItemType Directory -Force -Path $pyDir | Out-Null
Expand-Archive -Path $pyZip -DestinationPath $pyDir -Force
Remove-Item $pyZip -Force
$pth = Get-ChildItem $pyDir -Filter 'python*._pth' | Select-Object -First 1
if ($pth) {
  $lines = Get-Content $pth.FullName | ForEach-Object {
    if ($_ -match '^#\s*import site') { 'import site' } else { $_ }
  }
  if ($lines -notcontains 'import site') { $lines += 'import site' }
  Set-Content $pth.FullName $lines
}

Write-Host 'Baixando NSSM...'
$nssmZip = Join-Path $Runtime 'nssm.zip'
Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $nssmZip -UseBasicParsing
$nssmExt = Join-Path $Runtime 'nssm-extract'
Expand-Archive -Path $nssmZip -DestinationPath $nssmExt -Force
$nssmExe = Get-ChildItem $nssmExt -Recurse -Filter nssm.exe |
  Where-Object { $_.FullName -match '\\win64\\nssm\.exe$' } |
  Select-Object -First 1
Copy-Item $nssmExe.FullName (Join-Path $Runtime 'nssm.exe') -Force
Remove-Item $nssmZip, $nssmExt -Recurse -Force

$kitBrowsers = Join-Path $Runtime 'ms-playwright'
$env:PLAYWRIGHT_BROWSERS_PATH = $kitBrowsers

Write-Host 'npm install + Chromium (demora)...'
$nodeExe = Join-Path $Runtime 'node\node.exe'
$npmCmd = Join-Path $Runtime 'node\npm.cmd'
Push-Location $App
try {
  & $npmCmd install --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm install falhou' }
  & $nodeExe (Join-Path $App 'node_modules\playwright\cli.js') install chromium
  if ($LASTEXITCODE -ne 0) { throw 'playwright install chromium falhou' }
} finally {
  Pop-Location
}

Write-Host 'Gerando cofre criptografado (AES-256-GCM) - sem config.env...'
$nodeSeal = Join-Path $Runtime 'node\node.exe'
$envSrc = Join-Path $RepoRoot 'backend\.env'
& $nodeSeal (Join-Path $OutDir 'vault_tools.mjs') seal "--out=$OutDir" "--from-env=$envSrc"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao selar cofre de credenciais' }

# Garante que NAO existe plaintext no kit
@(
  (Join-Path $OutDir 'config.env'),
  (Join-Path $App '.env'),
  (Join-Path $App 'backend\.env'),
  (Join-Path $OutDir 'key_parts.generated.json')
) | ForEach-Object { if (Test-Path $_) { Remove-Item $_ -Force } }

Write-Host 'Compilando MeridianBkSync.exe...'
$cscCandidates = @(
  "${env:WINDIR}\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "${env:WINDIR}\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw 'csc.exe nao encontrado (precisa .NET Framework 4.x)' }
$exeOut = Join-Path $OutDir 'MeridianBkSync.exe'
& $csc /nologo /optimize+ /target:winexe /r:System.Windows.Forms.dll /out:"$exeOut" (Join-Path $OutDir 'MeridianBkSync.cs')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exeOut)) { throw 'Falha ao compilar MeridianBkSync.exe' }
# codigo-fonte do launcher nao precisa ir pro PC da gerencia
Remove-Item (Join-Path $OutDir 'MeridianBkSync.cs') -Force -ErrorAction SilentlyContinue

# db.js: sync CLI usa --db=prod e env injetado pelo worker (sem .env em disco)

$zipPath = Join-Path $Desktop 'Meridian-BKOffice-Gerencia.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Write-Host "Compactando $zipPath ..."
Compress-Archive -Path $OutDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ''
Write-Host 'OK - kit HTTPS (Chrome local + POST Meridian, sem Postgres na loja):'
Write-Host "  Pasta: $OutDir"
Write-Host "  Zip:   $zipPath"
Write-Host '  Exe:   MeridianBkSync.exe'
Write-Host '  Vault: data\vault.dat (AES) - SEM DB_HOST'
Write-Host 'No VPS: BKOFFICE_KIT_TOKEN=... + deploy + recreate'
Write-Host 'Leve a pasta ao PC da gerencia: TESTAR-UMA-VEZ.bat e depois INSTALAR.bat'
