@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%backend\run.py" (
    echo Backend not found at "%ROOT%backend".
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\package.json" (
    echo Frontend not found at "%ROOT%frontend".
    pause
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or is not available in PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js/npm is not installed or is not available in PATH.
    pause
    exit /b 1
)

start "TB Pneumonia Backend" /D "%ROOT%backend" cmd /k "python run.py"
start "TB Pneumonia Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

exit /b 0
