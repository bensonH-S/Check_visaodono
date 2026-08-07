@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo  1) Gera kit no DESKTOP (automatizado)
echo  2) Leva a pasta Meridian-BKOffice-Gerencia
echo  3) No PC gerencia: INSTALAR.bat como admin
echo ========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\build-kit-gerencia.ps1"
echo.
pause
