# Build da imagem Docker com a versão da última tag Git (ex.: v1.1.0).
param(
  [string]$ImageName = 'vision-check',
  [string]$Tag = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Tag) {
  try {
    $Tag = (git describe --tags --abbrev=0 2>$null).Trim()
  } catch {
    $Tag = ''
  }
}

if ($Tag) {
  Write-Host "[docker] versão da tag Git: $Tag"
  docker build --build-arg "GIT_TAG=$Tag" -t "${ImageName}:latest" -t "${ImageName}:$Tag" .
} else {
  Write-Host "[docker] nenhuma tag Git encontrada — build sem GIT_TAG (rodapé pode mostrar dev)"
  docker build -t "${ImageName}:latest" .
}
