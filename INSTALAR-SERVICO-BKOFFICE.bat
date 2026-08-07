@echo off
:: Botao DIREITO > Executar como administrador
cd /d "%~dp0"
echo.
echo === Meridian: servico Python BK Office (24h, sem janela) ===
echo Pasta: %CD%
echo.
net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: botao DIREITO neste arquivo ^> "Executar como administrador".
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  where py >nul 2>&1
  if errorlevel 1 (
    echo ERRO: Python nao encontrado. Instale https://www.python.org ^(Add to PATH^).
    pause
    exit /b 1
  )
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale Node 20 LTS https://nodejs.org
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\install-servico-bkoffice.ps1"
echo.
pause
