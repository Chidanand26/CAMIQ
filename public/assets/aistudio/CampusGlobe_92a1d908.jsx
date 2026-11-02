import { useEffect, useRef } from 'react';
import {
  Viewer,
  ArcGisMapServerImageryProvider,
  ImageryLayer,
  EllipsoidTerrainProvider,
  Cartesian3,
  Cartographic,
  Color,
  LabelStyle,
  HeightReference,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  GeoJsonDataSource,
  Ion,
  createOsmBuildingsAsync
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CAMPUS, MAIN_BUILDING_REFERENCE } from '../data/campus.js';
import { createCoverageArc } from '../geo.js';

const toPosition = (longitude, latitude, height = 0) => Cartesian3.fromDegrees(longitude, latitude, height);

export default function CampusGlobe({ cameras, responders, incident, showCoverage, showCameras, showResponders, showIncidents, showCampusBase, addCameraMode, onMapPick, onCameraSelect, selectedCameraId, onMapReady, ionToken }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const campusBaseRef = useRef(null);
  const latestRef = useRef({ onMapPick, onCameraSelect, onMapReady });
  latestRef.current = { onMapPick, onCameraSelect, onMapReady, showCampusBase };

  useEffect(() => {
    let cancelled = false;
    let handler;
    let buildingTileset;

    async function init() {
      let imageryLayer;
      try {
        const provider = await ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        );
        imageryLayer = ImageryLayer.fromProviderAsync(provider);
      } catch (error) {
        console.warn('Satellite imagery unavailable; falling back to OpenStreetMap.', error);
        imageryLayer = ImageryLayer.fromProviderAsync(Promise.resolve(new UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '© OpenStreetMap contributors'
        })));
      }
      if (cancelled) return;

      const viewer = new Viewer(hostRef.current, {
        baseLayer: imageryLayer,
        terrainProvider: new EllipsoidTerrainProvider(),
        animation: false,
        timeline: false,
        geocoder: false,
        baseLayerPicker: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        scene3DOnly: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity
      });
      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.backgroundColor = Color.fromCssColorString('#05090d');
      viewer.scene.fog.enabled = false;
      viewer.camera.flyTo({
        destination: toPosition(CAMPUS.longitude, CAMPUS.latitude, CAMPUS.cameraAltitude),
        orientation: { heading: 0, pitch: -0.72, roll: 0 },
        duration: 1.5
      });

      viewer.entities.add({
        id: 'camiq-campus-anchor',
        position: toPosition(CAMPUS.longitude, CAMPUS.latitude, 4),
        point: { pixelSize: 8, color: Color.fromCssColorString('#00e5ff'), outlineColor: Color.BLACK, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
        label: {
          text: 'KLE TECH · CAMPUS ANCHOR',
          font: 'bold 11px monospace',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: { x: 0, y: -18 },
          distanceDisplayCondition: undefined
        }
      });

      viewer.entities.add({
        id: 'camiq-main-building-reference',
        position: toPosition(MAIN_BUILDING_REFERENCE.longitude, MAIN_BUILDING_REFERENCE.latitude, 3),
        point: { pixelSize: 6, color: Color.fromCssColorString('#ffbf5f'), outlineColor: Color.BLACK, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
        label: {
          text: 'MAPPED UNIVERSITY BUILDING REFERENCE',
          font: '9px monospace',
          fillColor: Color.fromCssColorString('#ffe0a6'),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: { x: 0, y: 16 }
        }
      });


      // Load mapped OSM reference geometry: an indicative institutional area and one named building footprint.
      try {
        const campusBase = await GeoJsonDataSource.load('/data/campus-base.geojson', { clampToGround: false });
        campusBase.entities.values.forEach((entity) => {
          if (!entity.polygon) return;
          const kind = entity.properties?.kind?.getValue?.();
          if (kind === 'institutional_boundary') {
            entity.polygon.height = 0;
            entity.polygon.extrudedHeight = 0;
            entity.polygon.material = Color.fromCssColorString('#00d7ff').withAlpha(0.035);
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Color.fromCssColorString('#00d7ff').withAlpha(0.85);
          } else if (kind === 'building') {
            const levels = Number(entity.properties?.levels?.getValue?.() ?? 5);
            const height = Number(entity.properties?.height?.getValue?.() ?? levels * 3);
            entity.polygon.height = 0;
            entity.polygon.extrudedHeight = Math.max(4, height);
            entity.polygon.material = Color.fromCssColorString('#55c7d9').withAlpha(0.34);
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Color.fromCssColorString('#a6f4ff');
          }
        });
        campusBase.show = latestRef.current.showCampusBase;
        await viewer.dataSources.add(campusBase);
        campusBaseRef.current = campusBase;
      } catch (error) {
        console.warn('Could not load bundled OSM campus reference geometry:', error);
      }

      // Optional global OSM building layer; load it in the background so the map stays interactive.
      if (ionToken) {
        Ion.defaultAccessToken = ionToken;
        createOsmBuildingsAsync().then((tileset) => {
          if (cancelled || viewer.isDestroyed()) {
            tileset.destroy();
            return;
          }
          buildingTileset = tileset;
          viewer.scene.primitives.add(buildingTileset);
          viewer.scene.requestRender();
        }).catch((error) => {
          console.warn('Cesium OSM Buildings could not be loaded. The rest of CAMIQ remains available.', error);
        });
      }

      handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const picked = viewer.scene.pick(movement.position);
        if (picked?.id?.properties?.cameraId) {
          latestRef.current.onCameraSelect?.(picked.id.properties.cameraId.getValue());
          return;
        }
        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
        const cartographic = Cartographic.fromCartesian(cartesian);
        latestRef.current.onMapPick?.({
          latitude: (cartographic.latitude * 180) / Math.PI,
          longitude: (cartographic.longitude * 180) / Math.PI
        });
      }, ScreenSpaceEventType.LEFT_CLICK);
      latestRef.current.onMapReady?.(viewer);
    }

    init().catch((error) => console.error('Could not initialise Cesium viewer:', error));
    return () => {
      cancelled = true;
      if (handler && !handler.isDestroyed()) handler.destroy();
      if (buildingTileset && viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.scene.primitives.remove(buildingTileset);
      }
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
      campusBaseRef.current = null;
    };
  }, [ionToken]);

  useEffect(() => {
    if (campusBaseRef.current) campusBaseRef.current.show = showCampusBase;
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender();
  }, [showCampusBase]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const existing = viewer.entities.values.filter((entity) =>
      typeof entity.id === 'string' && (entity.id.startsWith('camera-') || entity.id.startsWith('coverage-') || entity.id.startsWith('responder-') || entity.id.startsWith('incident-'))
    );
    existing.forEach((entity) => viewer.entities.remove(entity));

    (showCameras ? cameras : []).forEach((camera) => {
      const selected = camera.id === selectedCameraId;
      const cameraColor = camera.demo ? Color.fromCssColorString('#ffbf5f') : Color.fromCssColorString('#00e5ff');
      viewer.entities.add({
        id: `camera-${camera.id}`,
        position: toPosition(camera.longitude, camera.latitude, 3),
        properties: { cameraId: camera.id },
        point: { pixelSize: selected ? 13 : 10, color: cameraColor, outlineColor: Color.BLACK, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
        label: {
          text: `${camera.demo ? 'DEMO ' : ''}${camera.id}`,
          font: 'bold 10px monospace',
          fillColor: cameraColor,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: { x: 0, y: -18 },
          show: true
        }
      });
      if (showCoverage) {
        const arc = createCoverageArc(camera).flatMap(([lon, lat]) => [lon, lat, 0]);
        viewer.entities.add({
          id: `coverage-${camera.id}`,
          polygon: {
            hierarchy: Cartesian3.fromDegreesArrayHeights(arc),
            material: cameraColor.withAlpha(selected ? 0.24 : 0.12),
            outline: true,
            outlineColor: cameraColor.withAlpha(0.8),
            height: 0
          }
        });
      }
    });

    (showResponders ? responders : []).forEach((responder) => {
      viewer.entities.add({
        id: `responder-${responder.id}`,
        position: toPosition(responder.longitude, responder.latitude, 4),
        point: { pixelSize: 10, color: Color.fromCssColorString('#66e6a2'), outlineColor: Color.BLACK, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
        label: { text: responder.name.toUpperCase(), font: 'bold 9px monospace', fillColor: Color.fromCssColorString('#a9ffd0'), outlineColor: Color.BLACK, outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: { x: 0, y: -16 } }
      });
    });

    if (incident && showIncidents) {
      viewer.entities.add({
        id: `incident-${incident.id}`,
        position: toPosition(incident.longitude, incident.latitude, 8),
        point: { pixelSize: 16, color: Color.fromCssColorString('#ff475e'), outlineColor: Color.WHITE, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND },
        label: { text: `SOS · ${incident.id}`, font: 'bold 12px monospace', fillColor: Color.WHITE, outlineColor: Color.fromCssColorString('#8e1426'), outlineWidth: 4, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: { x: 0, y: -25 } }
      });
    }
    viewer.scene.requestRender();
  }, [cameras, responders, incident, showCoverage, showCameras, showResponders, showIncidents, selectedCameraId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !incident || !showIncidents) return;
    viewer.camera.flyTo({
      destination: toPosition(incident.longitude, incident.latitude, 350),
      orientation: { heading: 0, pitch: -0.85, roll: 0 }, duration: 1.2
    });
  }, [incident?.id, showIncidents]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.canvas.style.cursor = addCameraMode ? 'crosshair' : 'grab';
  }, [addCameraMode]);

  return <div className="cesium-host" ref={hostRef} aria-label="Interactive 3D campus map" />;
}
