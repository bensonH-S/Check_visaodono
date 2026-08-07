@echo off
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo Execute como administrador.
  pause
  exit /b 1
)
set "NSSM=%~dp0runtime\nssm.exe"
set "SVC=MeridianBkOfficeTerraco"
"%NSSM%" stop %SVC% confirm
"%NSSM%" remove %SVC% confirm
schtasks /Delete /TN "Meridian-BKOffice-Terraco" /F >nul 2>&1
echo Removido.
pause
