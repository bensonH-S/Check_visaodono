@echo off
cd /d "%~dp0.."
echo.
echo === Criando usuarios de acesso ===
echo.
node backend\scripts\seed-auth.js
if errorlevel 1 (
  echo.
  echo Tentando migrations e seed novamente...
  node backend\scripts\migrate-full.js
  node backend\scripts\seed-auth.js
)
echo.
node backend\scripts\check-auth.js
echo.
pause
