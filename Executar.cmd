@echo off
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel% equ 0 (
  node server.mjs
) else (
  echo Node.js nao encontrado. Instale Node.js 22 ou superior e abra este arquivo novamente.
)
pause
