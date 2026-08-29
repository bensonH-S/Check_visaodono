@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Atualizar worker (logs limpos + incremental) ===
echo Pasta: %CD%
echo.

echo Parando processo antigo...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='MeridianBkSync.exe' OR Name='node.exe'\" -ea SilentlyContinue | Where-Object { $_.CommandLine -like '*worker.mjs*' -or $_.ExecutablePath -like '*MeridianBkSync*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ea SilentlyContinue }"
timeout /t 2 /nobreak >nul

if not exist "data" mkdir data
if not exist "data\synced-days.json" (
  echo Criando synced-days.json com dias 01-11...
  powershell -NoProfile -Command "$j=@{nota='historico ja no Meridian';dias=@('2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07','2026-08-08','2026-08-09','2026-08-10','2026-08-11');atualizado_em=(Get-Date).ToString('o')};$j|ConvertTo-Json|Set-Content 'data\synced-days.json' -Encoding UTF8"
) else (
  echo synced-days.json ja existe — mantendo.
)

echo.
echo Pronto. Rode TESTAR-UMA-VEZ.bat para testar so hoje.
echo Depois INSTALAR.bat para religar a tarefa.
echo.
pause
