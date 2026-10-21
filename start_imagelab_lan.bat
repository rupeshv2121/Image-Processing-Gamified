@echo off
REM Classroom network mode: students join the live quiz from their own phones and
REM laptops (they can do nothing else from there). The server window shows the address.
call "%~dp0start_imagelab.bat" --lan %*
