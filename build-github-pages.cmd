@echo off
setlocal

cd /d "%~dp0"

set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if exist "%BUNDLED_NODE%" (
  set "NODE_EXE=%BUNDLED_NODE%"
) else (
  set "NODE_EXE=node"
)

echo Building GitHub Pages output in docs...
"%NODE_EXE%" scripts\build-static.mjs
if errorlevel 1 exit /b %errorlevel%

echo.
echo Done. Review changes with:
echo   git status
echo.
echo Then publish with:
echo   git add data public docs README.md package.json server.js scripts start-portfolio.cmd build-github-pages.cmd .gitignore
echo   git commit -m "Update portfolio content"
echo   git push origin main
