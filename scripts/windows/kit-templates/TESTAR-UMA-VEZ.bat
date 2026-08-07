@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Teste manual (1 ciclo, COM janela) ===
echo Se der erro, aparece aqui na tela.
echo.
set "PY=%~dp0runtime\python\python.exe"
if not exist "%PY%" (
  echo ERRO: python.exe nao encontrado
  pause
  exit /b 1
)
"%PY%" -u "%~dp0worker.py"
echo.
echo Se travou no sync, espere 1-2 min (Playwright).
pause
