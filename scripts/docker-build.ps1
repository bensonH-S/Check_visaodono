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
  $env:GIT_TAG = $Tag
  docker compose build --build-arg "GIT_TAG=$Tag"
  docker compose up -d
} else {
  Write-Host "[docker] nenhuma tag Git encontrada — build sem GIT_TAG (rodapé pode mostrar dev)"
  docker compose build
  docker compose up -d
}
