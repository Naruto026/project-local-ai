@echo off
setlocal
cd /d "%~dp0"
title Local AI Assistant

echo.
echo  Starting Local AI Assistant...
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Run setup.bat first.
    pause
    exit /b 1
)

where ollama >nul 2>&1
if errorlevel 1 (
    echo [WARN] Ollama not in PATH - install from https://ollama.com
) else (
    echo Checking Ollama...
    curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Starting Ollama may be required. Run: ollama serve
    ) else (
        echo [OK] Ollama is reachable.
    )
)

set LOCAL_AI_OPEN_BROWSER=0
start "Local AI Server" /MIN cmd /c "python app.py"
echo Waiting for server at http://127.0.0.1:5000 ...

set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 40 (
    echo [WARN] Server slow to start. Open http://127.0.0.1:5000 manually.
    goto openbrowser
)
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitloop
)

echo [OK] Server is ready.
:openbrowser
start "" "http://127.0.0.1:5000"
echo.
echo  App running. Browser opened.
echo  Close the minimized "Local AI Server" window to stop.
echo.
pause
