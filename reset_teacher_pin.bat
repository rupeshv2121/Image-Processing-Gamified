@echo off
REM Forgot the teacher PIN and lost the recovery code? This removes the PIN;
REM the next teacher sign-in creates a new one. Students, progress and scores stay.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo ImageLab is not set up yet. Run setup_imagelab.bat first.
    pause
    exit /b 1
)
set "PYTHONPATH=%~dp0backend"
.venv\Scripts\python.exe -m imagelab.reset_pin %*
pause