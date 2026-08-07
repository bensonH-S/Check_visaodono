@echo off
:: Clique com o botao DIREITO > Executar como administrador
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: execute como administrador.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\uninstall-servico-bkoffice.ps1"
pause
