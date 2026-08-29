@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Teste manual — grupo de hoje (todas as lojas) ===
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
echo Se travou, espere ate 5 min (1 Excel do grupo inteiro).
pause
