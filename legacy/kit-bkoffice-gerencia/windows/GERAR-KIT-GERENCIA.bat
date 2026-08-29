@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo [LEGADO] Gera no DESKTOP a pasta Meridian-BKOffice-Gerencia
echo Leia: ..\README.md
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-kit-gerencia.ps1"
echo.
pause
