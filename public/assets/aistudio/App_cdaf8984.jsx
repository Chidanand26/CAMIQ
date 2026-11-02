import { useCallback, useMemo, useRef, useState } from 'react';
import CampusGlobe from './components/CampusGlobe.jsx';
import { CAMPUS, DEMO_CAMERAS, DEMO_RESPONDERS } from './data/campus.js';
import { destinationPoint, isPointCovered } from './geo.js';
import { Cartesian3 } from 'cesium';

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

function App() {
  const [cameras, setCameras] = useState([]);
  const [responders, setResponders] = useState([]);
  const [incident, setIncident] = useState(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [addCameraMode, setAddCameraMode] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [notice, setNotice] = useState('Satellite basemap · OSM campus outline loaded · verify before deployment');
  const [buildingFileName, setBuildingFileName] = useState('No campus GeoJSON imported');
  const [showBuildings, setShowBuildings] = useState(false);
  const [showCampusBase, setShowCampusBase] = useState(true);
  const viewerRef = useRef(null);
  const buildingDataSourceRef = useRef(null);
  const incidentCounter = useRef(0);

  const selectedCamera = useMemo(
    () => cameras.find((camera) => camera.id === selectedCameraId) || null,
    [cameras, selectedCameraId]
  );
  const coveredCameras = useMemo(() => {
    if (!incident) return [];
    return cameras.filter((camera) => isPointCovered(camera, incident));
  }, [cameras, incident]);

  const handleMapReady = useCallback((viewer) => { viewerRef.current = viewer; }, []);

  const updateSelectedCamera = (field, value) => {
    setCameras((current) => current.map((camera) => camera.id === selectedCameraId ? { ...camera, [field]: Number(value) } : camera));
  };

  const handleMapPick = useCallback((point) => {
    if (!addCameraMode) return;
    const nextNumber = cameras.length + 1;
    const camera = {
      id: `CAM-${String(nextNumber).padStart(2, '0')}`,
      name: `Campus camera ${nextNumber}`,
      latitude: point.latitude,
      longitude: point.longitude,
      heading: 90,
      fov: 75,
      range: 70,
      node: 'UNASSIGNED',
      status: 'PENDING',
      demo: false
    };
    setCameras((current) => [...current, camera]);
    setSelectedCameraId(camera.id);
    setAddCameraMode(false);
    setNotice(`${camera.id} added as an unverified camera position. Configure heading and coverage after field survey.`);
  }, [addCameraMode, cameras.length]);

  const loadDemo = () => {
    setCameras(DEMO_CAMERAS);
    setResponders(DEMO_RESPONDERS);
    setSelectedCameraId(DEMO_CAMERAS[0].id);
    setNotice('Demo scenario loaded · all camera and responder locations are simulated');
  };

  const triggerSOS = () => {
    const workingCameras = cameras.length ? cameras : DEMO_CAMERAS;
    const workingResponders = responders.length ? responders : DEMO_RESPONDERS;
    if (!cameras.length) setCameras(DEMO_CAMERAS);
    if (!responders.length) setResponders(DEMO_RESPONDERS);
    const source = workingCameras[0];
    const [longitude, latitude] = destinationPoint(
      source.latitude, source.longitude, source.heading, Math.max(20, source.range * 0.72)
    );
    incidentCounter.current += 1;
    const nextIncident = {
      id: `SOS-DEMO-${String(incidentCounter.current).padStart(3, '0')}`,
      latitude,
      longitude,
      status: 'RECEIVED',
      createdAt: new Date(),
      locationAccuracy: 12,
      source: 'SIMULATED STUDENT SOS'
    };
    setIncident(nextIncident);
    setNotice(`SOS simulation created · ${workingCameras.filter((camera) => isPointCovered(camera, nextIncident)).length} cameras geometrically cover the test point`);
  };

  const clearIncident = () => {
    setIncident(null);
    setNotice('No active demonstration incident');
  };

  const flyHome = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(CAMPUS.longitude, CAMPUS.latitude, CAMPUS.cameraAltitude),
      duration: 1.2
    });
  };

  const setSceneMode = (mode) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (mode === '2D') viewer.scene.morphTo2D(0.8);
    if (mode === '3D') viewer.scene.morphTo3D(0.8);
    if (mode === '2.5D') viewer.scene.morphToColumbusView(0.8);
  };

  const handleBuildingFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
        throw new Error('Expected a GeoJSON FeatureCollection.');
      }
      const { GeoJsonDataSource, Color } = await import('cesium');
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) throw new Error('Map is not ready yet.');
      if (buildingDataSourceRef.current) viewer.dataSources.remove(buildingDataSourceRef.current, true);
      const source = await GeoJsonDataSource.load(parsed, { clampToGround: false });
      source.entities.values.forEach((entity) => {
        if (!entity.polygon) return;
        const rawHeight = entity.properties?.height?.getValue?.();
        const rawLevels = entity.properties?.levels?.getValue?.();
        const height = Number(rawHeight ?? (rawLevels ? rawLevels * 3 : 12));
        entity.polygon.extrudedHeight = Math.max(4, height);
        entity.polygon.height = 0;
        entity.polygon.material = Color.fromCssColorString('#55c7d9').withAlpha(0.28);
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Color.fromCssColorString('#9af4ff');
      });
      source.show = true;
      await viewer.dataSources.add(source);
      buildingDataSourceRef.current = source;
      setBuildingFileName(`${file.name} · ${parsed.features.length} features`);
      setShowBuildings(true);
      setNotice('Campus GeoJSON loaded. Verify the geometry and heights against an authoritative campus plan.');
    } catch (error) {
      setNotice(`Could not load campus GeoJSON: ${error.message}`);
    }
    event.target.value = '';
  };

  return (
    <main className="app-shell">
      <CampusGlobe
        cameras={cameras}
        responders={responders}
        incident={incident}
        showCoverage={showCoverage}
        showCameras={showCameras}
        showResponders={showResponders}
        showIncidents={showIncidents}
        showCampusBase={showCampusBase}
        addCameraMode={addCameraMode}
        selectedCameraId={selectedCameraId}
        onMapPick={handleMapPick}
        onCameraSelect={setSelectedCameraId}
        onMapReady={handleMapReady}
        ionToken={ionToken}
      />
      <div className="vignette" />
      <header className="topbar glass">
        <div className="brand-lockup">
          <div className="brand-mark"><span>◉</span></div>
          <div>
            <div className="brand-name">CAMIQ <span>COMMAND</span></div>
            <div className="brand-subtitle">COLLABORATIVE CAMPUS INTELLIGENCE NETWORK</div>
          </div>
        </div>
        <div className="top-status">
          <span className="live-dot" /> CAMPUS VIEW
          <span className="status-divider" />
          <span className="muted">HUBBALLI · IN</span>
        </div>
        <div className="top-right"><span className="tiny-label">DEMO ENVIRONMENT</span><strong>CAMIQ / 01</strong></div>
      </header>

      <aside className="left-panel glass panel-scroll">
        <div className="panel-title-row">
          <div><div className="eyebrow">SPATIAL OPERATIONS</div><h2>Campus layers</h2></div>
          <span className="mini-chip">{cameras.length.toString().padStart(2, '0')} CAM</span>
        </div>
        <div className="campus-card">
          <div className="campus-card-icon"><Icon>⌖</Icon></div>
          <div><strong>KLE Tech · Hubballi</strong><span>B. V. Bhoomaraddi Campus</span></div>
        </div>
        <div className="section-label">MAP MODES</div>
        <div className="segmented">
          <button onClick={() => setSceneMode('2D')}>2D</button>
          <button className="active" onClick={() => setSceneMode('2.5D')}>2.5D</button>
          <button onClick={() => setSceneMode('3D')}>3D</button>
        </div>
        <div className="section-label">INTELLIGENCE LAYERS</div>
        <LayerToggle icon="▧" title="Satellite imagery" subtitle="ArcGIS World Imagery" checked disabled />
        <LayerToggle icon="◫" title="OSM campus area + main block" subtitle="Community-mapped reference geometry" checked={showCampusBase} onChange={setShowCampusBase} />
        <LayerToggle icon="▦" title="Additional campus buildings" subtitle={buildingFileName} checked={showBuildings} onChange={() => { const next = !showBuildings; setShowBuildings(next); if (buildingDataSourceRef.current) buildingDataSourceRef.current.show = next; }} />
        <LayerToggle icon="◉" title="CCTV network" subtitle={`${cameras.length} registered / demo cameras`} checked={showCameras} onChange={setShowCameras} />
        <LayerToggle icon="◌" title="Camera coverage" subtitle="Illustrative fields of view" checked={showCoverage} onChange={setShowCoverage} />
        <LayerToggle icon="!" title="Active SOS incidents" subtitle={incident ? '1 active demo incident' : 'No active incident'} checked={showIncidents && Boolean(incident)} onChange={setShowIncidents} />
        <LayerToggle icon="⌖" title="Security responders" subtitle={`${responders.length} visible in demo`} checked={showResponders} onChange={setShowResponders} />
        <div className="section-label">CAMPUS MODEL</div>
        <label className="upload-control">
          <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleBuildingFile} />
          <span>＋ Import campus GeoJSON</span>
        </label>
        <div className="helper-text">Use surveyed building footprints from QGIS or an authorised campus site plan. The starter file is intentionally empty.</div>
        {ionToken ? <div className="success-note">Cesium ion token detected · global OSM 3D buildings enabled when available.</div> : <div className="helper-text warning-note">Optional: add a Cesium ion token to enable global OSM 3D buildings.</div>}
        <div className="section-label">CAMERA MANAGEMENT</div>
        <button className={`action-button ${addCameraMode ? 'active-action' : ''}`} onClick={() => { setAddCameraMode((value) => !value); setNotice(addCameraMode ? 'Camera placement cancelled' : 'Click the map to place a camera. This location is unverified until surveyed.'); }}>
          <Icon>＋</Icon> {addCameraMode ? 'Cancel camera placement' : 'Add camera at map click'}
        </button>
        <button className="action-button secondary" onClick={loadDemo}><Icon>⚙</Icon> Load demo cameras & responders</button>
        {selectedCamera && <div className="selected-camera-card"><div className="eyebrow">SELECTED CAMERA</div><strong>{selectedCamera.name}</strong><span>{selectedCamera.id} · {selectedCamera.status}</span><div className="camera-config-grid"><label>HEADING °<input type="number" min="0" max="359" value={selectedCamera.heading} onChange={(event) => updateSelectedCamera('heading', event.target.value)} /></label><label>FOV °<input type="number" min="20" max="150" value={selectedCamera.fov} onChange={(event) => updateSelectedCamera('fov', event.target.value)} /></label><label>RANGE m<input type="number" min="5" max="250" value={selectedCamera.range} onChange={(event) => updateSelectedCamera('range', event.target.value)} /></label></div>{selectedCamera.demo && <em>SIMULATED POSITION · NOT SURVEYED</em>}</div>}
      </aside>

      <section className="map-toolbar glass">
        <button title="Fly to campus" onClick={flyHome}>⌖</button>
        <button title="2D view" onClick={() => setSceneMode('2D')}>2D</button>
        <button title="3D view" onClick={() => setSceneMode('3D')}>3D</button>
        <button title="Toggle camera coverage" className={showCoverage ? 'selected' : ''} onClick={() => setShowCoverage((value) => !value)}>◉</button>
      </section>

      <aside className="right-panel glass panel-scroll">
        <div className="panel-title-row"><div><div className="eyebrow">INCIDENT CONSOLE</div><h2>{incident ? 'Active SOS' : 'Situation overview'}</h2></div><span className={`state-pill ${incident ? 'danger' : 'ok'}`}>{incident ? 'SOS ACTIVE' : 'NOMINAL'}</span></div>
        {incident ? (
          <>
            <div className="incident-banner"><div className="pulse-ring">!</div><div><strong>{incident.id}</strong><span>Student SOS · simulated</span></div></div>
            <div className="data-row"><span>REPORTED LOCATION</span><strong>{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</strong></div>
            <div className="data-row"><span>LOCATION ACCURACY</span><strong>±{incident.locationAccuracy} m (simulated)</strong></div>
            <div className="data-row"><span>INCIDENT STATE</span><strong className="amber">{incident.status}</strong></div>
            <div className="section-label">CAMERAS COVERING LOCATION</div>
            {coveredCameras.length ? coveredCameras.map((camera) => <div className="camera-result" key={camera.id}><span className="camera-dot" /><div><strong>{camera.id}</strong><span>{camera.name}</span></div><b>IN FOV</b></div>) : <div className="empty-state">No currently registered camera's illustrative field of view covers this point.</div>}
            <div className="section-label">RESPONSE WORKFLOW</div>
            <div className="workflow-step complete"><i>✓</i><div><strong>SOS accepted by prototype</strong><span>Local UI simulation only · no server notification</span></div></div>
            <div className="workflow-step"><i>2</i><div><strong>Notify security & trusted contacts</strong><span>Backend integration not connected</span></div></div>
            <div className="workflow-step"><i>3</i><div><strong>Responder acknowledgement</strong><span>Demo responders shown on map</span></div></div>
            <div className="workflow-step"><i>4</i><div><strong>Incident resolution</strong><span>Requires authorised operator action</span></div></div>
            <button className="action-button danger-button" onClick={clearIncident}>Clear demo incident</button>
          </>
        ) : (
          <>
            <div className="metric-grid">
              <Metric value={String(cameras.length).padStart(2, '0')} label="CAMERAS" />
              <Metric value={String(responders.length).padStart(2, '0')} label="RESPONDERS" />
              <Metric value="00" label="ACTIVE SOS" />
              <Metric value={ionToken ? 'ON' : 'OFF'} label="ION 3D DATA" />
            </div>
            <div className="section-label">CAMPUS REFERENCE</div>
            <div className="data-row"><span>MAP ANCHOR</span><strong>15.36933° N · 75.12198° E</strong></div>
            <div className="data-row"><span>INSTITUTIONAL AREA</span><strong>OSM mapped · verify on site</strong></div>
            <div className="data-row"><span>BUILDING MODEL</span><strong>1 mapped OSM footprint + optional import</strong></div>
            <div className="section-label">EDGE COMPUTE NODES</div>
            <NodeCard name="INTEL EDGE" detail="OpenVINO · awaiting connection" status="NOT CONNECTED" />
            <NodeCard name="NVIDIA JETSON" detail="TensorRT · awaiting connection" status="NOT CONNECTED" />
            <NodeCard name="RASPBERRY PI" detail="Gateway · awaiting connection" status="NOT CONNECTED" />
            <div className="section-label">NEXT ACTION</div>
            <div className="empty-state">Load simulated cameras or add surveyed camera locations. Then trigger a test SOS to see spatial camera selection.</div>
          </>
        )}
      </aside>

      <div className="bottom-center glass"><div className="coordinate-block"><span>MAP CENTRE</span><strong>15°22′07.6″N</strong><strong>075°07′23.2″E</strong></div><div className="bottom-divider"/><div className="coordinate-block"><span>DATA MODE</span><strong>SATELLITE / 3D</strong><small>NOT A LIVE CCTV FEED</small></div></div>
      <div className="bottom-actions"><div className="notice glass"><span className="live-dot" />{notice}</div><button className="sos-button" onClick={triggerSOS}><Icon>!</Icon> RUN DEMO SOS</button></div>
      <footer className="footer"><span>CAMIQ · CAMPUS INTELLIGENCE NETWORK</span><span>MAP DATA: ESRI / OPENSTREETMAP · VERIFY BEFORE DEPLOYMENT</span></footer>
    </main>
  );
}

function LayerToggle({ icon, title, subtitle, checked, onChange, disabled = false }) {
  return <button className={`layer-row ${checked ? 'layer-enabled' : ''}`} onClick={() => onChange?.(!checked)} disabled={disabled}>
    <span className="layer-icon">{icon}</span><span className="layer-text"><strong>{title}</strong><small>{subtitle}</small></span><span className={`switch ${checked ? 'on' : ''}`} />
  </button>;
}
function Metric({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function NodeCard({ name, detail, status }) { return <div className="node-card"><div className="node-indicator"/><div><strong>{name}</strong><span>{detail}</span></div><small>{status}</small></div>; }

export default App;
