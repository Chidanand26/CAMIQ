"""
CAMIQ — Unified Local Server (FastAPI + Uvicorn)
1. Serves the Browser WebRTC 3-Camera + CesiumJS 3D Digital Twin Web App at http://localhost:8090/
2. Manages local OpenCV USB webcam streams and orchestration endpoints for the Android Companion App.
"""

import os
import time
import threading
from typing import Dict, Optional
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="CAMIQ Unified 3D Twin & Camera Server", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_APP_HTML_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "web_app",
    "index.html",
)


@app.get("/")
def serve_web_app():
    if os.path.exists(WEB_APP_HTML_PATH):
        return FileResponse(WEB_APP_HTML_PATH, media_type="text/html")
    return {"message": "CAMIQ Server Running"}


class CameraAssignmentRequest(BaseModel):
    camera_code: str
    device_index: int
    camera_type: str = "CORRIDOR"
    orchestration_mode: str = "WATCH"


class CameraModeRequest(BaseModel):
    camera_code: str
    mode: str
    event_id: str


class PhysicalCameraSlot:
    def __init__(self, camera_code: str, device_index: int, camera_type: str):
        self.camera_code = camera_code
        self.device_index = device_index
        self.camera_type = camera_type
        self.orchestration_mode = "WATCH"
        self.connected = False
        self.fps = 0.0
        self.latency_ms = 0.0
        self.motion_delta_pct = 0.0
        self.last_decoded_qr: Optional[str] = None
        self.last_ack_event_id: str = ""
        self.latest_jpeg: Optional[bytes] = None
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._qr_detector = cv2.QRCodeDetector()

    def start(self):
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)

    def _capture_loop(self):
        cap = None
        prev_gray = None
        while not self._stop_event.is_set():
            if cap is None or not cap.isOpened():
                cap = cv2.VideoCapture(self.device_index)
                if not cap.isOpened():
                    self.connected = False
                    self.fps = 0.0
                    time.sleep(2.0)
                    continue
                self.connected = True

            t0 = time.perf_counter()
            ok, frame = cap.read()
            if not ok or frame is None:
                self.connected = False
                self.fps = 0.0
                cap.release()
                cap = None
                time.sleep(1.5)
                continue

            self.connected = True
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            small_gray = cv2.resize(gray, (160, 120))
            if prev_gray is not None:
                diff = cv2.absdiff(small_gray, prev_gray)
                self.motion_delta_pct = float(np.mean(diff) / 255.0 * 100.0)
            prev_gray = small_gray

            if self.camera_type == "ENTRANCE_QR":
                decoded_text, _, _ = self._qr_detector.detectAndDecode(frame)
                if decoded_text:
                    self.last_decoded_qr = decoded_text.strip()

            ok_jpg, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if ok_jpg:
                self.latest_jpeg = buf.tobytes()

            elapsed = time.perf_counter() - t0
            self.latency_ms = round(elapsed * 1000.0, 2)
            sleep_budget = 0.06 if self.orchestration_mode == "WATCH" else 0.02
            self.fps = round(1.0 / max(elapsed + sleep_budget, 0.016), 1)
            time.sleep(sleep_budget)

        if cap is not None:
            cap.release()


CAMERA_SLOTS: Dict[str, PhysicalCameraSlot] = {}
LOCK = threading.Lock()


@app.get("/cameras/status")
def get_cameras_status():
    with LOCK:
        return [
            {
                "camera_code": slot.camera_code,
                "device_index": slot.device_index,
                "camera_type": slot.camera_type,
                "orchestration_mode": slot.orchestration_mode,
                "connected": slot.connected,
                "fps": slot.fps,
                "latency_ms": slot.latency_ms,
                "motion_delta_pct": round(slot.motion_delta_pct, 2),
                "last_decoded_qr": slot.last_decoded_qr,
                "last_ack_event_id": slot.last_ack_event_id,
            }
            for slot in CAMERA_SLOTS.values()
        ]


@app.post("/cameras/configure")
def configure_camera(req: CameraAssignmentRequest):
    code = req.camera_code.strip().upper()
    with LOCK:
        for existing_code, slot in CAMERA_SLOTS.items():
            if existing_code != code and slot.device_index == req.device_index:
                raise HTTPException(
                    status_code=409,
                    detail=f"Device index {req.device_index} already in use by {existing_code}",
                )
        if code in CAMERA_SLOTS:
            CAMERA_SLOTS[code].stop()
        slot = PhysicalCameraSlot(code, req.device_index, req.camera_type)
        slot.orchestration_mode = req.orchestration_mode
        CAMERA_SLOTS[code] = slot
        slot.start()
        return {"status": "CONFIGURED", "camera_code": code}


@app.get("/stream/{camera_code}")
def stream_camera_mjpeg(camera_code: str):
    code = camera_code.strip().upper()
    slot = CAMERA_SLOTS.get(code)
    if slot is None or not slot.connected:
        raise HTTPException(status_code=503, detail=f"{code} DISCONNECTED")

    def frame_generator():
        while slot.connected:
            if slot.latest_jpeg is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + slot.latest_jpeg + b"\r\n"
                )
            time.sleep(0.04)

    return StreamingResponse(
        frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
