@echo off
REM Start ImageLab without opening MATLAB yourself: the bridge server starts a
REM MATLAB engine in the background and opens http://localhost:8765
REM (Alternatively, open MATLAB in this folder and type:  ImageLab)
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo Run setup_imagelab.bat first.
    pause
    exit /b 1
)
.venv\Scripts\python.exe server\server.py
