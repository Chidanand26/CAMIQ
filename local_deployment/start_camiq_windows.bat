@echo off
title CAMIQ 3D Digital Twin & 3-Camera WebRTC Launcher (Windows)
echo ============================================================================
echo CAMIQ — 3D Campus Digital Twin ^& 3-Camera WebRTC Platform
echo ============================================================================

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Opening standalone Browser WebRTC 3D Digital Twin directly...
    start "" "local_deployment\web_app\index.html"
    exit /b 0
)

python -m pip install --quiet opencv-python fastapi uvicorn numpy pydantic
start "CAMIQ Server" cmd /k "python local_deployment\camera_manager\camera_manager.py"
timeout /t 2 >nul
start "" "http://localhost:8090"
