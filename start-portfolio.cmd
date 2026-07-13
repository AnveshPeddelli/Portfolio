@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set "PORT=3000"
if "%PORTFOLIO_ADMIN_KEY%"=="" set "PORTFOLIO_ADMIN_KEY=dev"

set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if exist "%BUNDLED_NODE%" (
  set "NODE_EXE=%BUNDLED_NODE%"
) else (
  set "NODE_EXE=node"
)

echo Starting portfolio at http://localhost:%PORT%
echo Owner console: http://localhost:%PORT%/owner-console
echo Owner key: %PORTFOLIO_ADMIN_KEY%
echo.

"%NODE_EXE%" server.js
