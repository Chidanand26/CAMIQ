# CAMIQ – KLE Tech Campus Digital Twin (starter)

A browser prototype built with React, Vite and CesiumJS. It starts at the mapped KLE Technological University / B. V. Bhoomaraddi Campus area in Hubballi and provides a CAMIQ-style spatial operations UI.

## What works in this starter

- Satellite basemap using the ArcGIS World Imagery map service, with OpenStreetMap fallback.
- Cesium 3D/2D/Columbus-view controls.
- An OSM-sourced indicative institutional-area outline and one mapped university-building footprint, plus a separately labelled campus anchor. These are community map references, not a cadastral survey.
- Add camera markers by clicking the map.
- Optional camera coverage sectors generated from heading, FOV and range.
- Load a clearly labelled simulated camera/responder scenario.
- Trigger a local demo SOS and determine which configured camera sectors geometrically cover the test point.
- Import a GeoJSON FeatureCollection of campus building footprints and extrude polygons using a `height` or `levels` property.
- Optional Cesium ion OSM Buildings layer when `VITE_CESIUM_ION_TOKEN` is configured.

## Important limitations

This is a **front-end demonstration**, not a live emergency response system. It does not send SMS, push notifications, calls, trusted-contact alerts, CCTV commands or edge-node messages. The SOS button creates a local simulated incident only. Do not use this prototype for real emergencies.

The three demo cameras and two responders are fictional positions. The camera fields of view are geometric illustrations, not measured optical coverage. They do not account for walls, trees, elevation, obstructions, lens distortion, night performance or camera orientation calibration. No real camera positions are included by default.

The map anchor (15.36877, 75.12312) is based on the OpenStreetMap-mapped university area. The bundled institutional-area polygon is derived from OSM way 381443665, and the bundled main university-building footprint is derived from OSM way 388061988. The building is mapped with 5 levels; the 15 m visual extrusion is an estimate (3 m per level), not a measured height. The institutional polygon includes community-mapped geometry that may encompass associated facilities and must not be treated as an official property boundary. Verify all geometry against a recent satellite image, campus site plan and on-site survey before using it for safety routing or emergency decisions.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ recommended, npm, and an internet connection for Cesium, map imagery and basemap resources.

```bash
npm install
cp .env.example .env
# Optional: put your Cesium ion token in .env as VITE_CESIUM_ION_TOKEN=...
npm run dev
```

Open `http://localhost:5173`.

To make a production build:

```bash
npm run build
npm run preview
```

## Add actual campus buildings

1. Obtain permission to use the campus site plan / CAD / GIS material.
2. In QGIS, create or import building footprints and ensure coordinates are WGS84 (EPSG:4326).
3. Export a GeoJSON **FeatureCollection** with Polygon or MultiPolygon geometries.
4. Add numeric `height` (metres) or `levels` properties where known.
5. In the app, use **Import campus GeoJSON** and choose the file.

The bundled `public/data/campus-base.geojson` contains the indicative OSM area outline and one mapped university-building footprint. The separate `public/data/campus-buildings.geojson` is an empty template for additional verified buildings.

## Add actual CCTV cameras

Use only camera positions supplied by the authorised campus CCTV/network administrator or obtained through a permitted site survey. For each camera, record:

- Unique camera ID and name
- WGS84 latitude / longitude
- Mounting height
- Heading / azimuth (degrees clockwise from north)
- Horizontal field of view (degrees)
- Verified ground coverage / estimated range (metres)
- Assigned edge node and operational status

For now, click **Add camera at map click** and place a marker. These positions are unverified and should remain clearly labelled until surveyed. The simulated cameras are loaded only with **Load demo cameras & responders**.

## Optional Cesium ion data

Create an access token at https://ion.cesium.com/tokens and place it in `.env`. Cesium OSM Buildings is an optional world building layer; coverage and building detail at this campus must be checked. It is based on OpenStreetMap and may omit, simplify or misclassify buildings. Cesium's OSM Buildings usage requires OpenStreetMap attribution.

## Data attribution

- Campus area geometry: [OpenStreetMap way 381443665](https://www.openstreetmap.org/way/381443665). Mapped main university-building footprint: [OpenStreetMap way 388061988](https://www.openstreetmap.org/way/388061988). © OpenStreetMap contributors, ODbL. Attribute OpenStreetMap and review ODbL obligations if distributing a derived database.
- Satellite imagery: [ArcGIS World Imagery service](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer). Follow the service's attribution and usage requirements shown in the viewer and the provider's current terms.
- Optional 3D buildings: Cesium OSM Buildings, © OpenStreetMap contributors.
- CesiumJS: Apache-2.0 licensed open-source library.

## Next engineering milestones

1. Verify the OSM institutional area and building footprint against a permitted recent satellite/site-plan reference.
2. Add real camera registry and camera calibration workflow.
3. Connect RTSP through an authenticated edge/video gateway; never expose camera credentials to the browser.
4. Add FastAPI + PostGIS SOS API and WebSocket event delivery.
5. Add MQTT edge-agent requests and authenticated responder workflows.
6. Add authentication, consent, audit trails, rate limits, retention policy and failure handling before any campus pilot.
