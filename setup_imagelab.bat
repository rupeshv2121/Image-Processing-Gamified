@echo off
REM ImageLab one-click setup: finds MATLAB and a matching Python, installs the
REM MATLAB Engine API for Python into .venv and builds the user interface.
REM Options:  -CheckOnly   (only report)   -SkipUI   -MatlabRoot "C:\...\R2025b"
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_imagelab.ps1" %*
set RESULT=%ERRORLEVEL%
echo.
pause
exit /b %RESULT%
