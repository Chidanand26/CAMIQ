# CAMIQ — Unified Campus Safety Platform (Web Application)

**CAMIQ** (*Collaborative Intelligence for Existing Camera Infrastructure*) is a minimal, single-screen-per-role web application built with **React 19, TypeScript, Tailwind CSS, CesiumJS 3D Digital Twin, WebRTC (`getUserMedia` / `enumerateDevices`), and `jsQR`**.

---

## Quick Start (Presentation Laptop with 3 USB Webcams)

1. Plug up to **3 physical USB webcams** into your laptop (`CAM-01`, `CAM-02`, `CAM-03`).
2. Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

3. Open **`http://localhost:3000`** in Chrome or Edge.
4. Click **`Auto-Connect 3 USB Cams`** in the top header (or select a specific USB webcam from the dropdown at the bottom of each camera card) to stream all 3 physical cameras live on the dashboard simultaneously.

---

## Role-Based Single-Screen Interfaces (Use `ROLE PREVIEW` in Header)

1. **`SAFE · Student` (`/student`)**
   - **Press-and-Hold 1.2s Emergency SOS Orb** (`.sos-orb`) + **Discreet SOS** + **Call 112**.
   - **Rotating 30s Campus Gate QR Pass** (`qrcode` + anti-passback state `IN`/`OUT`).
   - **Monitored SafeWalk Escort** with Female Responder preference and interactive **CesiumJS 3D Digital Twin** destination selection.

2. **`RESPONSE · Guard` (`/guard`)**
   - **Duty Status Toggle** (`ON DUTY` / `OFF DUTY`).
   - **3-Camera Live USB Webcam Wall** (`CAM-01`, `CAM-02`, `CAM-03`) with real-time `jsQR` decoding on `CAM-01`.
   - **CesiumJS 3D Digital Twin** with volumetric camera FOV cones (`WATCH`, `VERIFY`, `INVESTIGATE`) and 3D SOS beacons.
   - **Active Incident Queue** (`Acknowledge`, `Accept & Go`, `Resolve`) + **CAM-01 Gate QR Monitor** (`AUTO` / `IN` / `OUT`).

3. **`COMMAND · Admin` (`/admin`)**
   - **Live KPI Strip** (`ACTIVE INCIDENTS`, `USB CAMERAS ONLINE`, `COORDINATOR EVENTS`, `GATE QR SCANS`).
   - **3-Camera Live Wall & USB Webcam Orchestrator** (`Auto-Connect 3 USB Cams`, `Coordinate CAM-01 → Neighbors`, `Reset WATCH`).
   - **CesiumJS 3D Campus Digital Twin** (`STD` / `NVG` / `FLIR` shaders + `3D ORBIT` / `POV CAM-01..03` lock-on + Click-to-Probe Coverage-to-Compute planner `planCameras`).
   - **Coordinator & Incident Event Stream**.
