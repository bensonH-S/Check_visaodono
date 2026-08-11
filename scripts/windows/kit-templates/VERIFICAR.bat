@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Meridian BK Office — verificar ===
echo Pasta: %CD%
echo.

echo --- Cofre / exe ---
if exist "MeridianBkSync.exe" (echo MeridianBkSync.exe: OK) else (echo MeridianBkSync.exe: AUSENTE)
if exist "data\vault.dat" (echo data\vault.dat: OK) else (echo data\vault.dat: AUSENTE)
if exist "config.env" (echo AVISO: config.env ainda existe — deveria ter sido removido) else (echo config.env: ausente OK)
echo.

echo --- Tarefa agendada ---
schtasks /Query /TN "MeridianBkOfficeTerraco" /V /FO LIST 2>nul | findstr /I "Status Nome Pasta Resultado Executando"
if errorlevel 1 echo (tarefa nao encontrada)
echo.

echo --- Processo MeridianBkSync / node worker ---
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='MeridianBkSync.exe' OR Name='node.exe'\" -ea SilentlyContinue | Where-Object { $_.CommandLine -like '*worker.mjs*' -or $_.ExecutablePath -like '*MeridianBkSync*' } | Select-Object ProcessId, Name | Format-Table -AutoSize"
echo.

echo --- Logs\bkoffice-python-service.log ---
if exist "Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\bkoffice-python-service.log' -Tail 40"
) else (
  echo (arquivo ainda nao existe)
)
echo.

echo --- ProgramData\MeridianBkOffice\Logs ---
if exist "%ProgramData%\MeridianBkOffice\Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath ($env:ProgramData + '\MeridianBkOffice\Logs\bkoffice-python-service.log') -Tail 40"
) else (
  echo (arquivo ainda nao existe)
)
echo.
pause
