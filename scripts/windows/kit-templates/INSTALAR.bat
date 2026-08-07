@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo  Meridian BK Office - instalar servico
echo  (Python + Node JA inclusos neste kit)
echo ========================================
echo.
net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: clique com o BOTAO DIREITO neste arquivo
  echo        e escolha "Executar como administrador".
  pause
  exit /b 1
)

set "KIT=%~dp0"
set "NSSM=%KIT%runtime\nssm.exe"
set "PYW=%KIT%runtime\python\pythonw.exe"
set "WORKER=%KIT%worker.py"
set "SVC=MeridianBkOfficeTerraco"

if not exist "%PYW%" (
  echo ERRO: pythonw ausente em runtime\python\
  pause
  exit /b 1
)
if not exist "%NSSM%" (
  echo ERRO: nssm ausente
  pause
  exit /b 1
)
if not exist "%KIT%config.env" (
  echo ERRO: falta config.env
  pause
  exit /b 1
)

echo Removendo tarefa agendada antiga (se existir)...
schtasks /Delete /TN "Meridian-BKOffice-Terraco" /F >nul 2>&1

echo Parando servico antigo (se existir)...
"%NSSM%" stop %SVC% confirm >nul 2>&1
"%NSSM%" remove %SVC% confirm >nul 2>&1
timeout /t 2 /nobreak >nul

echo Instalando servico Windows...
"%NSSM%" install %SVC% "%PYW%" "%WORKER%"
"%NSSM%" set %SVC% AppDirectory "%KIT%"
"%NSSM%" set %SVC% AppStdout "%KIT%Logs\service.out.log"
"%NSSM%" set %SVC% AppStderr "%KIT%Logs\service.err.log"
"%NSSM%" set %SVC% AppRotateFiles 1
"%NSSM%" set %SVC% AppRotateBytes 2097152
"%NSSM%" set %SVC% AppRestartDelay 15000
"%NSSM%" set %SVC% AppExit Default Restart
"%NSSM%" set %SVC% Start SERVICE_AUTO_START
"%NSSM%" set %SVC% Description "Meridian BK Office Terraco 24h (kit portatil)"
"%NSSM%" set %SVC% ObjectName LocalSystem
"%NSSM%" set %SVC% AppEnvironmentExtra "PLAYWRIGHT_BROWSERS_PATH=%KIT%runtime\ms-playwright" "NODE_ENV=production"

echo Iniciando...
"%NSSM%" start %SVC%
timeout /t 3 /nobreak >nul

sc query %SVC%
echo.
echo OK. Servico: %SVC%
echo - Liga sozinho apos reiniciar
echo - Sem janela / sem CMD
echo - Logs: %KIT%Logs\
echo.
pause
