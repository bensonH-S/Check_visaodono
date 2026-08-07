@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo.
echo Gera no DESKTOP a pasta Meridian-BKOffice-Gerencia
echo (com Node + Python + Chromium + config ja prontos)
echo.
echo Demora alguns minutos na primeira vez...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-kit-gerencia.ps1"
echo.
pause
