@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   MERIDIAN BK OFFICE — VERIFICAR
echo ========================================
echo Pasta: %CD%
echo.

echo --- STATUS (leia isto) ---
if exist "data\STATUS.txt" (
  type "data\STATUS.txt"
) else (
  echo STATUS ainda nao gerado — rode TESTAR-UMA-VEZ.bat ou aguarde o ciclo.
)
echo.

echo --- Processo rodando? ---
set RODANDO=NAO
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter \"Name='MeridianBkSync.exe' OR Name='node.exe'\" -ea SilentlyContinue | Where-Object { $_.CommandLine -like '*worker.mjs*' -or $_.ExecutablePath -like '*MeridianBkSync*' }; if($p){$p|Select-Object ProcessId,Name|Format-Table -AutoSize; exit 0}else{exit 1}"
if %errorlevel%==0 (set RODANDO=SIM)
echo Rodando: %RODANDO%
echo.

echo --- Tarefa agendada ---
schtasks /Query /TN "MeridianBkOfficeTerraco" /V /FO LIST 2>nul | findstr /I "Status Nome Resultado"
if errorlevel 1 echo (tarefa nao encontrada)
echo.

echo --- Dias ja enviados (synced-days.json) ---
if exist "data\synced-days.json" (
  powershell -NoProfile -Command "$j=Get-Content 'data\synced-days.json' -Raw|ConvertFrom-Json; Write-Host ('Total: '+$j.dias.Count+' dias'); if($j.dias.Count -le 20){$j.dias}else{$j.dias[-10..-1] -join ', ' + ' ... (ultimos 10)'}"
) else (
  echo (arquivo ainda nao existe)
)
echo.

echo --- Ultimas 15 linhas do log ---
if exist "Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\bkoffice-python-service.log' -Tail 15"
) else (
  echo (log ainda nao existe)
)
echo.
pause
