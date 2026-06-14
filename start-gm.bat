@echo off
title VTT — GM Launcher
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-gm.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo  Script exited with an error. See messages above.
    pause
)
