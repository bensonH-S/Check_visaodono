@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Teste manual (1 ciclo via MeridianBkSync / node) ===
echo Credenciais: cofre data\vault.dat (sem config.env)
echo.
if not exist "%~dp0data\vault.dat" (
  echo ERRO: cofre data\vault.dat ausente — regenere o kit
  pause
  exit /b 1
)
set "NODE=%~dp0runtime\node\node.exe"
if not exist "%NODE%" (
  echo ERRO: node.exe nao encontrado
  pause
  exit /b 1
)
"%NODE%" "%~dp0worker.mjs" --once
echo.
echo Se travou no sync, espere alguns minutos (Playwright).
pause
