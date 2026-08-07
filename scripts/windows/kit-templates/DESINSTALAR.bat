@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Removendo tarefa e servico antigos...
schtasks /Delete /TN "MeridianBkOfficeTerraco" /F >nul 2>&1
schtasks /Delete /TN "Meridian-BKOffice-Terraco" /F >nul 2>&1
if exist "%~dp0runtime\nssm.exe" (
  "%~dp0runtime\nssm.exe" stop MeridianBkOfficeTerraco confirm >nul 2>&1
  "%~dp0runtime\nssm.exe" remove MeridianBkOfficeTerraco confirm >nul 2>&1
)
sc delete MeridianBkOfficeTerraco >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" -ea SilentlyContinue | Where-Object { $_.CommandLine -like '*worker.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ea SilentlyContinue }"
echo Removido.
pause
