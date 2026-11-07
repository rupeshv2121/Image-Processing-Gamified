@echo off
REM Development mode (for changing Spatia's code - not for the classroom):
REM   * the website runs from the Vite dev server: page and style changes appear at once
REM     at http://localhost:5173 (no build, no reload)
REM   * the backend restarts by itself in about a second when a .py file is saved
REM   * MATLAB starts once and stays running; edited .m files are used straight away
REM A backend restart signs everybody out (sessions are kept in memory).
REM start_imagelab_dev.bat --lan  also lets other devices reach the backend.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo ImageLab is not set up yet. Run setup_imagelab.bat first.
    pause
    exit /b 1
)
if not exist frontend\node_modules (
    echo The website's packages are missing. Run setup_imagelab.bat ^(it needs Node.js 18+^).
    pause
    exit /b 1
)
set "PYTHONPATH=%~dp0backend"
start "Spatia website (Vite dev server)" /D "%~dp0frontend" cmd /k npm run dev
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5173"
.venv\Scripts\python.exe -m imagelab.dev %*
pause
