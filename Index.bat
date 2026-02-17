@echo off
setlocal

REM --- This script's folder (should contain Index.html) ---
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM --- Sanity check ---
if not exist "Index.html" (
  echo ERROR: Index.html not found in:
  echo   %CD%
  echo.
  echo Make sure Run_PG_Scanner.bat is in the SAME folder as Index.html
  echo.
  pause
  exit /b 1
)

REM --- Choose a port unlikely to conflict ---
set "PORT=8765"

echo Serving folder:
echo   %CD%
echo Opening:
echo   http://127.0.0.1:%PORT%/Index.html
echo.
echo Keep this window open while using the app.
echo Close it to stop the server.
echo.

REM --- Open browser first ---
start "" "http://127.0.0.1:%PORT%/Index.html"

REM --- Run server in THIS window (guaranteed correct working directory) ---
python -m http.server %PORT% --bind 127.0.0.1

endlocal
