// Geographic reference point is based on the mapped KLE Technological University area.
// It is an anchor for the prototype, not a surveyed campus-centre or legal boundary.
export const MAIN_BUILDING_REFERENCE = { latitude: 15.36933, longitude: 75.12198 };
export const CAMPUS = {
  name: 'KLE Technological University – B. V. Bhoomaraddi Campus',
  shortName: 'KLE TECH HUBBALLI',
  latitude: 15.36877,
  longitude: 75.12312,
  cameraAltitude: 1700,
};

// Empty on purpose: these are not asserted real CCTV locations.
// Add authorised camera positions from the campus CCTV administrator or field survey.
export const INITIAL_CAMERAS = [];

export const DEMO_CAMERAS = [
  {
    id: 'DEMO-CAM-01', name: 'Demo · Library Walkway', latitude: 15.36982, longitude: 75.12142,
    heading: 115, fov: 78, range: 85, node: 'INTEL-EDGE-01', status: 'ONLINE', demo: true
  },
  {
    id: 'DEMO-CAM-02', name: 'Demo · Academic Approach', latitude: 15.36895, longitude: 75.12238,
    heading: 300, fov: 82, range: 95, node: 'JETSON-EDGE-01', status: 'ONLINE', demo: true
  },
  {
    id: 'DEMO-CAM-03', name: 'Demo · Main Path', latitude: 15.36952, longitude: 75.12302,
    heading: 205, fov: 70, range: 75, node: 'PI-GATEWAY-01', status: 'ONLINE', demo: true
  }
];

export const DEMO_RESPONDERS = [
  { id: 'RESP-01', name: 'Responder A', latitude: 15.36905, longitude: 75.12155, status: 'AVAILABLE' },
  { id: 'RESP-02', name: 'Responder B', latitude: 15.36872, longitude: 75.12272, status: 'AVAILABLE' }
];
