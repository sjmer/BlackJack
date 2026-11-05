@echo off
setlocal
cd /d "%~dp0"

rem ============ BLACKJACK 21 one-click launcher (offline + online) ============
where node >nul 2>nul
if errorlevel 1 goto :missing
where pnpm >nul 2>nul
if errorlevel 1 goto :missing

if not exist "node_modules\express" (
  echo [1/3] Installing dependencies...
  call pnpm install
  if errorlevel 1 goto :fail
)

if not exist "packages\client\dist\index.html" (
  echo [2/3] Building client...
  call pnpm --filter @bj/client build
  if errorlevel 1 goto :fail
)

if not defined PORT set "PORT=3000"

echo [3/3] Starting server at http://127.0.0.1:%PORT%/  (Ctrl+C to stop)
start "" "http://127.0.0.1:%PORT%/"
call pnpm --filter @bj/server start
goto :eof

:missing
echo.
echo Node.js 22+ and pnpm 11+ are required:
echo   https://nodejs.org/
echo   npm install -g pnpm
echo.
pause
exit /b 1

:fail
echo.
echo Startup failed. Check the errors above.
pause
exit /b 1
