# CAMIQ — Minimal 3D Digital Twin & WebRTC 3-Camera Command Platform

Streamline CAMIQ into a focused, single-screen-per-role tactical experience powered by a **CesiumJS 3D Digital Twin** (inspired by `bilawalsidhu/gods-eye-view`) and a **Browser WebRTC 3-Camera Web Application + Android Companion** so that plugging three USB webcams into a laptop immediately displays all three live streams alongside 3D spatial camera frustums, SOS Coverage-to-Compute orchestration, and rotating QR gate validation.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below incorporate your answers and establish how the CesiumJS 3D Digital Twin, Browser WebRTC 3-Camera Wall, and minimal single-screen role views will operate together.

- **Confirmed Decision 1 — CesiumJS 3D Digital Twin (`gods-eye-view` Aesthetic)**: Replace the 2D map with an interactive **CesiumJS 3D Digital Twin** featuring 3D OSM/campus building extrusions, volumetric 3D camera field-of-view frustum cones (`CAM-01`, `CAM-02`, `CAM-03`), tactical HUD post-processing modes (Standard, Night-Vision / NVG, FLIR Thermal, and CRT Scanline overlays), click-to-fly camera lock-on ("ride-along" view from any camera's perspective), and pulsing 3D SOS distress beacons.
- **Confirmed Decision 2 — Browser WebRTC 3-Camera Web App + Android Companion**: Deliver a standalone Browser WebRTC Web Application (served locally so your laptop browser enumerates all 3 physical USB webcams via `navigator.mediaDevices.enumerateDevices()` and `getUserMedia()`) paired with the streamlined Android companion app. Both render the exact same CesiumJS 3D Digital Twin and 3-camera tactical HUD.
- **Confirmed Decision 3 — Minimal Single-Screen Layout Per Role (Zero Sub-Tabs)**: Remove all multi-tab clutter (`7` Admin tabs, `6` Guard tabs, and `5` Student tabs are eliminated). Each role (`/student`, `/guard`, `/admin`) renders on **one clean, unified screen** with zero sub-tabs.
- **Keyless-First CesiumJS with Optional Token Support**: The CesiumJS 3D Digital Twin will work out-of-the-box without requiring paid API keys (using keyless OpenStreetMap 3D terrain/imagery and procedural 3D campus building extrusions), while also providing an optional input for a Cesium Ion / Google Photorealistic 3D Tiles key if you wish to load photorealistic satellite meshes.

---

## 1. Overview & Core Concept

- **What It Does**: CAMIQ transforms three physical USB webcams plugged into a laptop and a student's mobile phone into a unified 3D spatial campus safety command system.
- **Target Audience / Persona**:
  - **Student (`CAMIQ SAFE — /student`)**: Needs an immediate, zero-clutter screen with a Press-and-Hold SOS trigger, rotating 30-second opaque QR campus pass, and 1-tap SafeWalk request.
  - **Security Guard (`CAMIQ RESPONSE — /guard`)**: Needs a single tactical screen showing the 3D Campus Digital Twin, the live 3-Camera Wall (`CAM-01`, `CAM-02`, `CAM-03`), active SOS / SafeWalk alerts, and `CAM-01` QR Gate validation.
  - **Administrator (`CAMIQ COMMAND — /admin`)**: Needs a "God's-Eye View" 3D Digital Twin command center where plugging in 3 USB webcams auto-populates `CAM-01`, `CAM-02`, and `CAM-03`, projects their 3D volumetric FOV cones onto the campus twin, and visualizes `WATCH → VERIFY → INVESTIGATE` orchestration in real time.
- **Key Value**: Eliminates multi-tab administrative bloat in favor of a high-impact spatial operations interface where every camera stream, QR scan, motion orchestration event, and SOS alert is immediately visible on one screen.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Plug & Play 3-Camera WebRTC Auto-Discovery**: On the laptop Web App (and Android Command view), clicking **"Auto-Connect 3 USB Webcams"** enumerates connected video inputs, binds them to `CAM-01` (Entrance QR), `CAM-02` (Lab/Corridor), and `CAM-03` (Perimeter), and renders all three live feeds side-by-side (`DISCONNECTED` shown honestly for any unplugged slot).
  2. **CesiumJS "God's-Eye View" 3D Digital Twin Interaction**:
     - Orbit, tilt, and zoom across the 3D campus digital twin.
     - Click `CAM-01`, `CAM-02`, or `CAM-03` in the 3-Camera Dock or in the 3D scene to smoothly fly the Cesium 3D camera into a locked-in perspective looking down that camera's 3D FOV frustum cone.
     - Toggle tactical shader overlays (**STD**, **NVG Night Vision**, **FLIR Thermal**, **Tactical Grid**) inspired by `bilawalsidhu/gods-eye-view`.
  3. **Single-Screen Student Distress & Smart Entry (`/student`)**:
     - Top: Press-and-Hold SOS button + `TEST SOS` + manual `CALL 112` button.
     - Middle: Rotating 30-second opaque QR Pass with **"Present to CAM-01"** action and current `INSIDE` / `OUTSIDE` badge.
     - Bottom: 1-card SafeWalk Escort toggle (with explicit Female Responder preference) and live status pill.
  4. **Single-Screen Guard & Admin Operations (`/guard` & `/admin`)**:
     - Full-bleed CesiumJS 3D Digital Twin canvas as the primary workspace, overlaid with floating glassmorphic HUD panels:
       - **Top HUD**: Role Preview switcher (`SAFE` | `RESPONSE` | `COMMAND`), Tactical Shader selector (`STD` / `NVG` / `FLIR`), and real-time DB telemetry counters.
       - **Bottom HUD Dock**: Live 3-Camera Wall (`CAM-01`, `CAM-02`, `CAM-03`) with WebRTC/CameraX video feeds, `WATCH / VERIFY / INVESTIGATE` mode badges, motion trigger button, and USB device selector dropdowns.
       - **Right Floating HUD**: Active SOS & SafeWalk Incident Queue (with Coverage-to-Compute camera selection reasoning) + `CAM-01` QR Gate Scanner (`IN` / `OUT` toggle & anti-passback badge).

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactical Spatial Intelligence ("God's-Eye View" dark command HUD).
  - *Color Palette & Mood*:
    - `--background`: `#050811` (Deep Orbital Obsidian)
    - `--surface`: `rgba(15, 23, 42, 0.78)` (Translucent Tactical Slate with backdrop blur)
    - `--primary`: `#06B6D4` (Telemetry Cyan for camera frustums and active HUD borders)
    - `--accent-emergency`: `#F43F5E` (Distress Coral for SOS beacons and `INVESTIGATE` cones)
    - `--accent-safe`: `#10B981` (Phosphor Emerald for `ACCESS RECORDED` and NVG mode)
    - `--accent-warn`: `#F59E0B` (Amber for `VERIFY` mode and `CAMERA COVERAGE GAP`)
  - *Typography & Hierarchy*: `Space Grotesk` for uppercase tactical HUD headers, `Plus Jakarta Sans` for crisp readable controls, and `JetBrains Mono` for live coordinates, FPS/latency readouts, and opaque QR tokens.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Bleed CesiumJS 3D Digital Twin + Floating HUD Dock vs. Multi-Tab Forms**
  - *Chosen Approach*: Replace the 7-tab Admin and 6-tab Guard layouts with a single-screen spatial canvas where the CesiumJS 3D Digital Twin fills the viewport and the 3 live USB cameras sit in a persistent bottom HUD dock.
  - *Why*: During a live hardware demo, switching between 7 tabs hides the cameras and map. Keeping the 3D Digital Twin and all 3 camera feeds permanently visible on one screen makes motion orchestration (`CAM-01 → CAM-02, CAM-03`) and SOS Coverage-to-Compute visually unmistakable.
  - *Alternatives Considered*: Keeping separate tabs for Map, Cameras, and Incidents (rejected because it fragments the demo and feels cluttered).

- **Decision 2: Browser WebRTC (`getUserMedia`) for the Laptop 3-Camera Wall + Shared REST/WebSocket Sync**
  - *Chosen Approach*: Build a self-contained Web App (`local_deployment/web_app/index.html` + FastAPI/WebSocket server) that uses browser-native WebRTC `navigator.mediaDevices.enumerateDevices()` and `getUserMedia({ video: { deviceId } })` to open all 3 USB webcams directly in Chrome/Edge on your laptop, plus QR decoding on `CAM-01` and real-time sync with the Android app.
  - *Why*: Browser WebRTC enumerates all 3 USB webcams immediately when plugged into your laptop without driver index guessing, while allowing you to pick which physical USB webcam maps to `CAM-01`, `CAM-02`, and `CAM-03` directly from a dropdown on each camera card.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                CAMIQ UNIFIED SPATIAL & 3-CAMERA PLATFORM                     │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   LAPTOP BROWSER WEB APP (WebRTC)    │     ANDROID COMPANION APP (Compose)   │
│  ┌────────────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Single-Screen Role Switcher    │  │  │ Single-Screen Role Switcher     │  │
│  │ (/student | /guard | /admin)   │  │  │ (/student | /guard | /admin)    │  │
│  └───────────────┬────────────────┘  │  └────────────────┬────────────────┘  │
│                  │                   │                   │                   │
│  ┌───────────────▼────────────────┐  │  ┌────────────────▼────────────────┐  │
│  │ CesiumJS 3D Digital Twin HUD   │  │  │ CesiumJS 3D Digital Twin View   │  │
│  │ • 3D Campus Buildings & Globe  │  │  │ • 3D Campus Buildings & Globe   │  │
│  │ • 3D Volumetric Camera Cones   │  │  │ • 3D Volumetric Camera Cones    │  │
│  │ • NVG / FLIR / CRT Shaders     │  │  │ • NVG / FLIR / CRT Shaders      │  │
│  │ • Fly-To Camera Perspective    │  │  │ • Fly-To Camera Perspective     │  │
│  └───────────────┬────────────────┘  │  └────────────────┬────────────────┘  │
│                  │                   │                   │                   │
│  ┌───────────────▼────────────────┐  │  ┌────────────────▼────────────────┐  │
│  │ Persistent 3-Camera HUD Dock   │  │  │ Persistent 3-Camera HUD Dock    │  │
│  │ • CAM-01 (WebRTC + QR Scanner) │  │  │ • CAM-01, CAM-02, CAM-03 Cards  │  │
│  │ • CAM-02 (WebRTC + Motion Δ)   │  │  │ • CameraX + Local Stream Sync   │  │
│  │ • CAM-03 (WebRTC + Motion Δ)   │  │  │ • WATCH / VERIFY / INVESTIGATE  │  │
│  └───────────────┬────────────────┘  │  └────────────────┬────────────────┘  │
└──────────────────┼───────────────────┴───────────────────┼───────────────────┘
                   │          REST + WebSocket Sync        │
                   └───────────────────┬───────────────────┘
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │   LOCAL BACKEND & SQLITE / ROOM PERSISTENCE (:8090)         │
        │   • Coverage-to-Compute 3D Frustum Evaluator                │
        │   • Collaborative Motion Orchestrator (CAM-01 -> 02, 03)    │
        │   • One-Time 30s Rotating QR Validator & Anti-Passback      │
        └─────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

1. **CesiumJS 3D Digital Twin Component (Web & Android WebView)**:
   - Renders 3D terrain/globe, extruded 3D campus buildings around the active site coordinates, 3D volumetric pyramid/cone geometries for `CAM-01`, `CAM-02`, and `CAM-03` colored by mode (`WATCH` = Cyan `#06B6D4`, `VERIFY` = Amber `#F59E0B`, `INVESTIGATE` = Coral `#F43F5E`), and pulsing 3D cylinder beacons for active SOS incidents.
   - Includes interactive HUD buttons for **Fly to Campus Overview**, **Lock-On CAM-01 / CAM-02 / CAM-03 POV**, and **Tactical Vision Mode (`STD`, `NVG`, `FLIR`)**.
2. **Browser WebRTC 3-Camera Wall (`CAM-01`, `CAM-02`, `CAM-03`)**:
   - Automatically enumerates all connected USB video devices via `navigator.mediaDevices.enumerateDevices()`.
   - Each of the 3 camera slots has a device selector dropdown, live `<video>` WebRTC feed, real-time canvas frame-differencing motion meter, FPS/latency badge, and automatic `QRCodeDetector` / `jsQR` scanning on `CAM-01`.
   - Unplugging a USB webcam triggers `devicechange` / track `ended` events and immediately flips that slot to **`DISCONNECTED`**.
3. **Minimal Single-Screen Layouts in Android & Web**:
   - **`/student` (CAMIQ SAFE)**: Single scrollable card stack with Press-and-Hold SOS, Rotating 30s QR Pass, and 1-click SafeWalk Escort request (with Female Responder toggle).
   - **`/guard` (CAMIQ RESPONSE)**: Single-screen split view with the CesiumJS 3D Digital Twin on top, the 3-Camera Wall in the middle, and the unified Incident + Gate Scan action bar at the bottom.
   - **`/admin` (CAMIQ COMMAND)**: Full-screen "God's-Eye View" CesiumJS 3D Digital Twin with floating HUD overlays for 3-Camera WebRTC/Hardware binding, 1-click Demo Setup (to register `CAM-01`, `CAM-02`, `CAM-03` on the 3D campus), Motion Orchestration trigger, and live Coverage-to-Compute logs.
