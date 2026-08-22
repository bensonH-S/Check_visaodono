@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   MERIDIAN BK OFFICE — VERIFICAR
echo ========================================
echo Pasta: %CD%
echo.

echo --- STATUS (todas as lojas) ---
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

echo --- Indice das 20 lojas ---
if exist "Logs\lojas\_indice.txt" (
  type "Logs\lojas\_indice.txt"
) else (
  echo (ainda nao gerado — aguarde o primeiro boot)
)
echo.

echo --- Arquivos de log por loja ---
if exist "Logs\lojas" (
  dir /b "Logs\lojas\*.log" 2>nul
) else (
  echo (pasta Logs\lojas ainda nao existe)
)
echo.

echo --- Servico (boot/rodizio) — ultimas 8 linhas ---
if exist "Logs\_servico.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\_servico.log' -Tail 8"
) else if exist "Logs\bkoffice-python-service.log" (
  powershell -NoProfile -Command "Get-Content -LiteralPath 'Logs\bkoffice-python-service.log' -Tail 8"
) else (
  echo (log de servico ainda nao existe)
)
echo.
pause
