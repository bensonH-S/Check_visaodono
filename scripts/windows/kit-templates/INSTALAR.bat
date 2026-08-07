@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo  Meridian BK Office — instalar
echo  (tarefa oculta no SEU usuario + Chrome)
echo ========================================
echo.
:: Nao precisa admin para tarefa do usuario atual
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR.ps1"
echo.
pause
