@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Meridian BK Office — verificar ===
echo Pasta: %CD%
echo.

echo --- Tarefa agendada ---
schtasks /Query /TN "MeridianBkOfficeTerraco" /V /FO LIST 2>nul | findstr /I "Status Nome Pasta Resultado Executando"
if errorlevel 1 echo (tarefa nao encontrada)
echo.

echo --- Servico NSSM antigo (deve estar ausente/parado) ---
sc query MeridianBkOfficeTerraco 2>nul | findstr /I "ESTADO STATE NOME"
if errorlevel 1 echo (servico NSSM nao existe — ok)
echo.

echo --- Processo python worker ---
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" -ea SilentlyContinue | Where-Object { $_.CommandLine -like '*worker.py*' } | Select-Object ProcessId, Name | Format-Table -AutoSize"
echo.

echo --- Logs\bkoffice-python-service.log ---
if exist "Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\bkoffice-python-service.log' -Tail 40"
) else (
  echo (arquivo ainda nao existe)
)
echo.

echo --- Logs\service.out.log ---
if exist "Logs\service.out.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\service.out.log' -Tail 20"
) else ( echo (vazio/ausente) )
echo.

echo --- Logs\service.err.log ---
if exist "Logs\service.err.log" (
  powershell -NoProfile -Command "if ((Get-Item -LiteralPath 'Logs\service.err.log').Length -gt 0) { Get-Content -LiteralPath 'Logs\service.err.log' -Tail 40 } else { '(vazio)' }"
) else ( echo (ausente) )
echo.

echo --- ProgramData\MeridianBkOffice\Logs ---
if exist "%ProgramData%\MeridianBkOffice\Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath ($env:ProgramData + '\MeridianBkOffice\Logs\bkoffice-python-service.log') -Tail 40"
) else (
  echo (arquivo ainda nao existe)
)
echo.
pause
