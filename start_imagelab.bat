@echo off
REM Start ImageLab without opening MATLAB yourself: the bridge server starts a
REM MATLAB engine in the background and opens http://localhost:8765
REM (Alternatively, open MATLAB in this folder and type:  ImageLab)
REM start_imagelab_lan.bat = the same in classroom network mode (live quiz on students' devices)
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo ImageLab is not set up yet. Run setup_imagelab.bat first.
    pause
    exit /b 1
)
if not exist frontend\dist\index.html (
    echo The user interface is not built. Run setup_imagelab.bat ^(it needs Node.js 18+^).
    pause
    exit /b 1
)
.venv\Scripts\python.exe server\server.py %*
