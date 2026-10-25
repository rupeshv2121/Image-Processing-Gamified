@echo off
REM Classroom network mode: students sign in on their own phones and laptops and use
REM the labs, quizzes and the live quiz (not the Code Lab or teacher mode). The server
REM window shows the address.
call "%~dp0start_imagelab.bat" --lan %*
