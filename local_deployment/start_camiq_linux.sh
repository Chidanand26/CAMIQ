#!/usr/bin/env bash
set -e
echo "============================================================================"
echo "CAMIQ — 3D Campus Digital Twin & 3-Camera WebRTC Platform"
echo "Launching at http://localhost:8090"
echo "============================================================================"

python3 -m pip install --quiet opencv-python fastapi uvicorn numpy pydantic
python3 local_deployment/camera_manager/camera_manager.py
