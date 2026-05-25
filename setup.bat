@echo off
setlocal
cd /d "%~dp0"
title Local AI - Setup

echo.
echo  ========================================
echo   Local AI Assistant - First-time Setup
echo  ========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ from https://python.org
    echo         Enable "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo [OK] Python found:
python --version

echo.
echo Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo.
where ollama >nul 2>&1
if errorlevel 1 (
    echo [WARN] Ollama not in PATH. Install from https://ollama.com
    echo        The app needs Ollama running to chat with models.
) else (
    echo [OK] Ollama CLI found.
    ollama --version 2>nul
)

if not exist "data" mkdir data
if not exist "data\conversations" mkdir data\conversations
if not exist "data\uploads" mkdir data\uploads
if not exist "data\trash" mkdir data\trash

echo.
echo Optional - Image OCR (PNG/JPG):
echo   Install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
echo   Add tesseract.exe to your PATH, then restart the app.
echo.

echo.
echo  Setup complete. Double-click start.bat to run the app.
echo.
pause
