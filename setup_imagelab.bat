@echo off
REM ImageLab one-time setup:
REM   1. Python virtual environment with the MATLAB Engine API for Python
REM   2. Build of the user interface (needs Node.js)
cd /d "%~dp0"

echo [1/3] Creating Python virtual environment (.venv) ...
if not exist .venv\Scripts\python.exe (
    py -3.12 -m venv .venv 2>nul || python -m venv .venv
)
if not exist .venv\Scripts\python.exe (
    echo Python 3.9-3.12 is required. Install it from python.org and run this again.
    pause
    exit /b 1
)

echo [2/3] Installing the MATLAB Engine API for Python ...
.venv\Scripts\python.exe -m pip install --upgrade pip >nul
.venv\Scripts\python.exe -m pip install -r server\requirements.txt
if errorlevel 1 (
    echo.
    echo Could not install matlabengine from PyPI. Install it from your MATLAB folder instead:
    echo   cd "C:\Program Files\MATLAB\R20xxx\extern\engines\python"
    echo   "%cd%\.venv\Scripts\python.exe" -m pip install .
    pause
    exit /b 1
)

echo [3/3] Building the user interface ...
where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js not found - skipping the UI build. Install Node.js 18+ and run:  cd frontend ^&^& npm install ^&^& npm run build
) else (
    pushd frontend
    call npm install --no-audit --no-fund
    call npm run build
    popd
)

echo.
echo Setup complete. Start ImageLab with start_imagelab.bat, or type  ImageLab  in MATLAB.
pause
