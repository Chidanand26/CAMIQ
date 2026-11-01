import { useSyncExternalStore } from "react";
import { type CameraLike, planCameras } from "./geo";

export type Role = "student" | "guard" | "admin";
export type CamMode = "WATCH" | "VERIFY" | "INVESTIGATE";

declare global {
  interface Window {
    CamiqNativeBridge?: {
      isAndroidApk?: () => boolean;
      postSyncPayload?: (url: string, body: string) => void;
      vibrateSos?: () => void;
      dialEmergency?: (phone: string) => void;
    };
    __onNativeSyncPoll?: (rawLines: string) => void;
  }
}

export type IncidentRecord = {
  id: string;
  ref: string;
  kind: "sos" | "safewalk" | "missed_checkin" | "report";
  status: string;
  student_id: string;
  student_name: string;
  lat: number | null;
  lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  female_pref: boolean;
  discreet: boolean;
  category: string | null;
  description: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  source_device?: "ANDROID_APK" | "WEB_DASHBOARD";
  camera_plan: { code: string; eligible: boolean; reason: string }[] | null;
};

export type GateEventRecord = {
  id: string;
  camera_code: string;
  gate: string;
  direction: "IN" | "OUT";
  result:
    | "ACCESS RECORDED"
    | "INVALID CREDENTIAL"
    | "EXPIRED QR"
    | "ALREADY INSIDE"
    | "ALREADY OUTSIDE"
    | "MANUAL VERIFICATION REQUIRED";
  subject: string;
  created_at: string;
};

export type SiteRecord = {
  id: string;
  name: string;
  institution: string;
  lat: number;
  lng: number;
};

export type SyncConfig = {
  roomCode: string;
  laptopServerUrl: string;
  connected: boolean;
  lastSyncedAt: string | null;
  lastSyncBanner: string | null;
  lanIps: string[];
};

export type CamiqStoreState = {
  role: Role;
  isAndroidApk: boolean;
  sync: SyncConfig;
  studentProfile: {
    id: string;
    full_name: string;
    student_id: string;
    department: string;
    campus_state: "IN" | "OUT";
    on_duty: boolean;
  };
  guardOnDuty: boolean;
  sites: SiteRecord[];
  cameras: CameraLike[];
  cameraModes: Record<string, CamMode>;
  cameraAcks: Record<string, string>;
  coordinatorLogs: string[];
  incidents: IncidentRecord[];
  gateEvents: GateEventRecord[];
  qrTokens: Record<string, { token: string; expires_at: number; used: boolean }>;
  activePassToken: { token: string; expires_at: number } | null;
};

type SyncEnvelope = {
  id: string;
  room: string;
  type:
    | "INCIDENT_CREATED"
    | "INCIDENT_STATUS"
    | "QR_ISSUED"
    | "GATE_CONSUMED"
    | "MOTION_COORDINATION"
    | "RESET_WATCH";
  senderId: string;
  sourceDevice: "ANDROID_APK" | "WEB_DASHBOARD";
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

const STORAGE_KEY = "camiq_unified_web_state_v2";
const BASE_LAT = 28.5450;
const BASE_LNG = 77.1926;
const CLIENT_ID = `cli-${Math.random().toString(36).slice(2, 9)}`;

function detectAndroidApk(): boolean {
  if (typeof window === "undefined") return false;
  if (window.CamiqNativeBridge?.isAndroidApk?.()) return true;
  if (window.location.search.includes("apk=student")) return true;
  if (window.location.protocol === "file:") return true;
  return false;
}

const DEFAULT_CAMERAS: CameraLike[] = [
  {
    id: "cam-01",
    code: "CAM-01",
    name: "Main Gate Entrance QR",
    camera_type: "entrance",
    lat: BASE_LAT,
    lng: BASE_LNG,
    direction: 45,
    fov: 85,
    range_m: 65,
    neighbors: ["CAM-02", "CAM-03"],
    status: "NOT ASSIGNED",
    fps: 0,
    last_seen: null,
    device_label: null,
  },
  {
    id: "cam-02",
    code: "CAM-02",
    name: "Robotics Lab Corridor",
    camera_type: "laboratory",
    lat: BASE_LAT + 0.00035,
    lng: BASE_LNG + 0.0004,
    direction: 135,
    fov: 90,
    range_m: 60,
    neighbors: ["CAM-01", "CAM-03"],
    status: "NOT ASSIGNED",
    fps: 0,
    last_seen: null,
    device_label: null,
  },
  {
    id: "cam-03",
    code: "CAM-03",
    name: "North Academic Walkway",
    camera_type: "corridor",
    lat: BASE_LAT - 0.0003,
    lng: BASE_LNG + 0.00035,
    direction: 315,
    fov: 95,
    range_m: 70,
    neighbors: ["CAM-01", "CAM-02"],
    status: "NOT ASSIGNED",
    fps: 0,
    last_seen: null,
    device_label: null,
  },
];

function createInitialState(): CamiqStoreState {
  const isApk = detectAndroidApk();
  return {
    role: isApk ? "student" : "admin",
    isAndroidApk: isApk,
    sync: {
      roomCode: "CAMIQ-LIVE-2026",
      laptopServerUrl: "",
      connected: true,
      lastSyncedAt: null,
      lastSyncBanner: null,
      lanIps: [],
    },
    studentProfile: {
      id: "stu-01",
      full_name: "Aarav Sharma",
      student_id: "STU-2026-01",
      department: "Robotics & CS",
      campus_state: "OUT",
      on_duty: true,
    },
    guardOnDuty: true,
    sites: [
      {
        id: "site-1",
        name: "Main 3D Digital Twin Campus",
        institution: "CAMIQ Institute of Technology",
        lat: BASE_LAT,
        lng: BASE_LNG,
      },
    ],
    cameras: DEFAULT_CAMERAS,
    cameraModes: {
      "CAM-01": "WATCH",
      "CAM-02": "WATCH",
      "CAM-03": "WATCH",
    },
    cameraAcks: {},
    coordinatorLogs: [],
    incidents: [],
    gateEvents: [],
    qrTokens: {},
    activePassToken: null,
  };
}

let state: CamiqStoreState = (() => {
  if (typeof window === "undefined") return createInitialState();
  const isApk = detectAndroidApk();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CamiqStoreState;
      if (parsed && Array.isArray(parsed.cameras) && parsed.cameras.length === 3) {
        return {
          ...createInitialState(),
          ...parsed,
          isAndroidApk: isApk,
          role: isApk ? "student" : parsed.role || "admin",
          sync: {
            ...createInitialState().sync,
            ...(parsed.sync ?? {}),
            roomCode: parsed.sync?.roomCode || "CAMIQ-LIVE-2026",
          },
        };
      }
    }
  } catch {
    // ignore
  }
  return createInitialState();
})();

const listeners = new Set<() => void>();
const processedEventIds = new Set<string>();
let broadcastChannel: BroadcastChannel | null = null;
let cloudEventSource: EventSource | null = null;
let localEventSource: EventSource | null = null;

function notify() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }
  listeners.forEach((fn) => fn());
}

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStore(): CamiqStoreState {
  return state;
}

export function useCamiqStore(): CamiqStoreState {
  return useSyncExternalStore(subscribeStore, getStore, getStore);
}

function getNtfyTopic(roomCode: string): string {
  const clean = roomCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  return `camiq_live_sync_${clean || "camiq_live_2026"}`;
}

// Apply an incoming sync envelope from either the Student APK or the Website
function applyIncomingEnvelope(env: SyncEnvelope) {
  if (!env || !env.id || processedEventIds.has(env.id)) return;
  processedEventIds.add(env.id);
  if (env.senderId === CLIENT_ID) return;

  const nowTime = new Date().toLocaleTimeString();
  const fromLabel =
    env.sourceDevice === "ANDROID_APK" ? "STUDENT APK" : "WEB DASHBOARD";

  if (env.type === "INCIDENT_CREATED" && env.payload?.incident) {
    const incoming = env.payload.incident as IncidentRecord;
    const exists = state.incidents.some((i) => i.id === incoming.id);
    if (!exists) {
      // Re-evaluate camera plan against current online cameras on the website
      const lat = incoming.lat ?? BASE_LAT + 0.00012;
      const lng = incoming.lng ?? BASE_LNG + 0.00012;
      const localPlan = planCameras(lat, lng, state.cameras).map((d) => ({
        code: d.camera.code,
        eligible: d.eligible,
        reason: d.reason,
      }));
      const nextModes = { ...state.cameraModes };
      // Activate eligible cameras (or all 3 on SOS if none online yet so visual cone alert is unmistakable)
      const eligibleCodes = localPlan.filter((p) => p.eligible).map((p) => p.code);
      if (eligibleCodes.length > 0) {
        eligibleCodes.forEach((c) => {
          nextModes[c] = "INVESTIGATE";
        });
      } else {
        nextModes["CAM-01"] = "INVESTIGATE";
        nextModes["CAM-02"] = "INVESTIGATE";
      }

      const enriched: IncidentRecord = {
        ...incoming,
        camera_plan:
          eligibleCodes.length > 0 ? localPlan : incoming.camera_plan ?? localPlan,
      };

      const logLine = `${nowTime} [${fromLabel}] ${incoming.ref} (${incoming.kind.toUpperCase()}) reported by ${incoming.student_name}`;
      state = {
        ...state,
        cameraModes: nextModes,
        incidents: [enriched, ...state.incidents],
        coordinatorLogs: [logLine, ...state.coordinatorLogs].slice(0, 30),
        sync: {
          ...state.sync,
          connected: true,
          lastSyncedAt: nowTime,
          lastSyncBanner: `📡 LIVE FROM ${fromLabel}: ${incoming.ref} (${incoming.kind.toUpperCase()}) — ${incoming.description || incoming.category || incoming.student_name}`,
        },
      };
      notify();
    }
  } else if (env.type === "INCIDENT_STATUS" && env.payload) {
    const { id, status } = env.payload as { id: string; status: string };
    state = {
      ...state,
      incidents: state.incidents.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              status,
              acknowledged_at:
                status === "ACKNOWLEDGED" || status === "RESPONDER EN ROUTE"
                  ? inc.acknowledged_at ?? new Date().toISOString()
                  : inc.acknowledged_at,
              resolved_at:
                status === "RESOLVED" || status === "CANCELLED"
                  ? new Date().toISOString()
                  : inc.resolved_at,
            }
          : inc,
      ),
      cameraModes:
        status === "RESOLVED"
          ? { "CAM-01": "WATCH", "CAM-02": "WATCH", "CAM-03": "WATCH" }
          : state.cameraModes,
      sync: {
        ...state.sync,
        connected: true,
        lastSyncedAt: nowTime,
        lastSyncBanner: `📡 LIVE FROM ${fromLabel}: Incident updated → ${status}`,
      },
    };
    notify();
  } else if (env.type === "QR_ISSUED" && env.payload) {
    const { token, expires_at } = env.payload as {
      token: string;
      expires_at: number;
    };
    state = {
      ...state,
      qrTokens: {
        ...state.qrTokens,
        [token]: { token, expires_at, used: false },
      },
      activePassToken: { token, expires_at },
      sync: {
        ...state.sync,
        connected: true,
        lastSyncedAt: nowTime,
      },
    };
    notify();
  } else if (env.type === "GATE_CONSUMED" && env.payload) {
    const { event, token, nextPresence } = env.payload as {
      event: GateEventRecord;
      token: string;
      nextPresence: "IN" | "OUT";
    };
    const exists = state.gateEvents.some((g) => g.id === event.id);
    if (!exists) {
      state = {
        ...state,
        studentProfile: {
          ...state.studentProfile,
          campus_state: nextPresence,
        },
        qrTokens: state.qrTokens[token]
          ? {
              ...state.qrTokens,
              [token]: {
                ...state.qrTokens[token],
                used:
                  event.result === "ACCESS RECORDED"
                    ? true
                    : state.qrTokens[token].used,
              },
            }
          : state.qrTokens,
        gateEvents: [event, ...state.gateEvents].slice(0, 30),
        sync: {
          ...state.sync,
          connected: true,
          lastSyncedAt: nowTime,
          lastSyncBanner: `📡 GATE SCAN [${event.camera_code}]: ${event.result} (${event.direction})`,
        },
      };
      notify();
    }
  } else if (env.type === "MOTION_COORDINATION" && env.payload) {
    const { cameraModes, cameraAcks, logLine } = env.payload as {
      cameraModes: Record<string, CamMode>;
      cameraAcks: Record<string, string>;
      logLine: string;
    };
    state = {
      ...state,
      cameraModes: { ...state.cameraModes, ...cameraModes },
      cameraAcks: { ...state.cameraAcks, ...cameraAcks },
      coordinatorLogs: [logLine, ...state.coordinatorLogs].slice(0, 25),
      sync: {
        ...state.sync,
        connected: true,
        lastSyncedAt: nowTime,
      },
    };
    notify();
  }
}

function publishSyncEvent(
  type: SyncEnvelope["type"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  if (typeof window === "undefined") return;
  const env: SyncEnvelope = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    room: state.sync.roomCode,
    type,
    senderId: CLIENT_ID,
    sourceDevice: state.isAndroidApk ? "ANDROID_APK" : "WEB_DASHBOARD",
    timestamp: Date.now(),
    payload,
  };
  processedEventIds.add(env.id);
  const rawJson = JSON.stringify(env);

  // 1. BroadcastChannel (same browser / multi-tab)
  try {
    broadcastChannel?.postMessage(env);
  } catch {
    // ignore
  }

  // 2. Cloud Pub/Sub Relay (ntfy.sh) for zero-config APK <-> Website sync over Wi-Fi or 5G
  const ntfyUrl = `https://ntfy.sh/${getNtfyTopic(state.sync.roomCode)}`;
  try {
    void fetch(ntfyUrl, {
      method: "POST",
      body: rawJson,
    });
  } catch {
    // ignore
  }
  try {
    window.CamiqNativeBridge?.postSyncPayload?.(ntfyUrl, rawJson);
  } catch {
    // ignore
  }

  // 3. Local Vite Server API (/api/camiq/event) + optional custom Laptop LAN IP
  if (window.location.protocol.startsWith("http")) {
    void fetch("/api/camiq/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawJson,
    }).catch(() => {});
  }

  const customBase = state.sync.laptopServerUrl.trim().replace(/\/+$/, "");
  if (customBase) {
    const targetUrl = `${customBase}/api/camiq/event`;
    void fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawJson,
    }).catch(() => {});
    try {
      window.CamiqNativeBridge?.postSyncPayload?.(targetUrl, rawJson);
    } catch {
      // ignore
    }
  }
}

function parseNtfyLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const outer = JSON.parse(trimmed);
    if (outer?.event === "message" && typeof outer.message === "string") {
      const inner = JSON.parse(outer.message) as SyncEnvelope;
      if (inner && inner.id && inner.type) {
        applyIncomingEnvelope(inner);
      }
    } else if (outer?.id && outer?.type && outer?.room) {
      applyIncomingEnvelope(outer as SyncEnvelope);
    }
  } catch {
    // ignore non-JSON keepalives
  }
}

export function pollSyncChannelNow() {
  if (typeof window === "undefined") return;
  const topic = getNtfyTopic(state.sync.roomCode);
  const pollUrl = `https://ntfy.sh/${topic}/json?poll=1&since=30m`;

  void fetch(pollUrl)
    .then((r) => r.text())
    .then((txt) => {
      txt.split("\n").forEach(parseNtfyLine);
      state = {
        ...state,
        sync: {
          ...state.sync,
          connected: true,
          lastSyncedAt: new Date().toLocaleTimeString(),
        },
      };
      notify();
    })
    .catch(() => {});

  // Poll local / LAN server if available
  const endpoints: string[] = [];
  if (window.location.protocol.startsWith("http")) {
    endpoints.push("/api/camiq/events");
  }
  const customBase = state.sync.laptopServerUrl.trim().replace(/\/+$/, "");
  if (customBase) {
    endpoints.push(`${customBase}/api/camiq/events`);
  }

  endpoints.forEach((ep) => {
    void fetch(ep)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.events)) {
          data.events.forEach((ev: SyncEnvelope) => applyIncomingEnvelope(ev));
        }
      })
      .catch(() => {});
  });
}

function setupRealtimeTransports() {
  if (typeof window === "undefined") return;

  // Expose callback for Android native OkHttp polling bridge
  window.__onNativeSyncPoll = (rawLines: string) => {
    rawLines.split("\n").forEach(parseNtfyLine);
  };

  // 1. BroadcastChannel + storage listener
  try {
    broadcastChannel?.close();
    broadcastChannel = new BroadcastChannel("camiq_realtime_bus");
    broadcastChannel.onmessage = (ev) => {
      if (ev.data?.id) applyIncomingEnvelope(ev.data as SyncEnvelope);
    };
  } catch {
    // ignore
  }

  // 2. Cloud SSE Stream (ntfy.sh)
  try {
    cloudEventSource?.close();
    const topic = getNtfyTopic(state.sync.roomCode);
    cloudEventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
    cloudEventSource.onmessage = (ev) => {
      parseNtfyLine(ev.data);
    };
  } catch {
    // ignore
  }

  // 3. Local Vite SSE Stream (/api/camiq/stream)
  if (window.location.protocol.startsWith("http")) {
    try {
      localEventSource?.close();
      localEventSource = new EventSource("/api/camiq/stream");
      localEventSource.onmessage = (ev) => {
        parseNtfyLine(ev.data);
      };
    } catch {
      // ignore
    }

    // Discover laptop LAN IPs to display in header
    void fetch("/api/camiq/info")
      .then((r) => r.json())
      .then((info) => {
        if (Array.isArray(info?.lanIps)) {
          state = {
            ...state,
            sync: { ...state.sync, lanIps: info.lanIps },
          };
          notify();
        }
      })
      .catch(() => {});
  }

  // Initial catch-up poll
  pollSyncChannelNow();
}

if (typeof window !== "undefined") {
  setupRealtimeTransports();
  // Continuous 2.2s catch-up poll so APK <-> Website sync never misses an event even behind strict firewalls
  window.setInterval(() => {
    pollSyncChannelNow();
  }, 2200);
}

export function updateSyncConfig(patch: {
  roomCode?: string;
  laptopServerUrl?: string;
}) {
  state = {
    ...state,
    sync: {
      ...state.sync,
      ...(patch.roomCode !== undefined ? { roomCode: patch.roomCode } : {}),
      ...(patch.laptopServerUrl !== undefined
        ? { laptopServerUrl: patch.laptopServerUrl }
        : {}),
    },
  };
  notify();
  setupRealtimeTransports();
}

export function clearSyncBanner() {
  state = {
    ...state,
    sync: { ...state.sync, lastSyncBanner: null },
  };
  notify();
}

export function setRole(role: Role) {
  state = { ...state, role };
  notify();
}

export function toggleGuardDuty(onDuty: boolean) {
  state = { ...state, guardOnDuty: onDuty };
  notify();
}

export function updateCameraTelemetry(
  camId: string,
  patch: Partial<CameraLike>,
) {
  state = {
    ...state,
    cameras: state.cameras.map((c) =>
      c.id === camId
        ? { ...c, ...patch, last_seen: new Date().toISOString() }
        : c,
    ),
  };
  notify();
}

export function triggerMotionCoordination(code: string) {
  const src = state.cameras.find((c) => c.code === code);
  if (!src) return;
  const neighbors = src.neighbors;
  const evt = `EVT-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const nextModes: Record<string, CamMode> = {
    ...state.cameraModes,
    [code]: "VERIFY",
  };
  const nextAcks: Record<string, string> = { ...state.cameraAcks };

  neighbors.forEach((nCode) => {
    const nCam = state.cameras.find((c) => c.code === nCode);
    nextModes[nCode] = "INVESTIGATE";
    if (nCam?.status === "ONLINE") {
      nextAcks[nCode] = `ACK ${evt} · ${new Date().toLocaleTimeString()}`;
    } else {
      nextAcks[nCode] = `READY ${evt} · Coordinated handoff`;
    }
  });

  const logLine = `${new Date().toLocaleTimeString()} ${evt} MOTION_DETECTED ${code} → INVESTIGATE ${neighbors.join(", ")}`;
  state = {
    ...state,
    cameraModes: nextModes,
    cameraAcks: nextAcks,
    coordinatorLogs: [logLine, ...state.coordinatorLogs].slice(0, 25),
  };
  notify();
  publishSyncEvent("MOTION_COORDINATION", {
    cameraModes: nextModes,
    cameraAcks: nextAcks,
    logLine,
  });
}

export function resetCamerasToWatch() {
  state = {
    ...state,
    cameraModes: { "CAM-01": "WATCH", "CAM-02": "WATCH", "CAM-03": "WATCH" },
    cameraAcks: {},
  };
  notify();
  publishSyncEvent("RESET_WATCH", {});
}

export function raiseIncident(opts: {
  kind: "sos" | "safewalk" | "missed_checkin" | "report";
  lat?: number | null;
  lng?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  discreet?: boolean;
  female_pref?: boolean;
  category?: string;
  description?: string;
}) {
  if (typeof window !== "undefined") {
    try {
      window.CamiqNativeBridge?.vibrateSos?.();
    } catch {
      // ignore
    }
  }

  const lat = opts.lat ?? BASE_LAT + 0.00012;
  const lng = opts.lng ?? BASE_LNG + 0.00012;
  const plan = planCameras(lat, lng, state.cameras).map((d) => ({
    code: d.camera.code,
    eligible: d.eligible,
    reason: d.reason,
  }));

  const nextModes = { ...state.cameraModes };
  const eligible = plan.filter((p) => p.eligible);
  if (eligible.length > 0) {
    eligible.forEach((p) => {
      nextModes[p.code] = "INVESTIGATE";
    });
  } else {
    nextModes["CAM-01"] = "INVESTIGATE";
    nextModes["CAM-02"] = "INVESTIGATE";
  }

  const ref = `${opts.kind.toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const inc: IncidentRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ref,
    kind: opts.kind,
    status: "OPEN",
    student_id: state.studentProfile.id,
    student_name: state.studentProfile.full_name,
    lat,
    lng,
    dest_lat: opts.dest_lat ?? null,
    dest_lng: opts.dest_lng ?? null,
    female_pref: opts.female_pref ?? false,
    discreet: opts.discreet ?? false,
    category: opts.category ?? null,
    description: opts.description ?? null,
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    source_device: state.isAndroidApk ? "ANDROID_APK" : "WEB_DASHBOARD",
    camera_plan: plan,
  };

  state = {
    ...state,
    cameraModes: nextModes,
    incidents: [inc, ...state.incidents],
  };
  notify();
  publishSyncEvent("INCIDENT_CREATED", { incident: inc });
  return inc;
}

export function updateIncidentStatus(id: string, status: string) {
  state = {
    ...state,
    incidents: state.incidents.map((inc) =>
      inc.id === id
        ? {
            ...inc,
            status,
            acknowledged_at:
              status === "ACKNOWLEDGED" || status === "RESPONDER EN ROUTE"
                ? inc.acknowledged_at ?? new Date().toISOString()
                : inc.acknowledged_at,
            resolved_at:
              status === "RESOLVED" || status === "CANCELLED"
                ? new Date().toISOString()
                : inc.resolved_at,
          }
        : inc,
    ),
    cameraModes:
      status === "RESOLVED"
        ? { "CAM-01": "WATCH", "CAM-02": "WATCH", "CAM-03": "WATCH" }
        : state.cameraModes,
  };
  notify();
  publishSyncEvent("INCIDENT_STATUS", { id, status });
}

export function issuePassToken(): { token: string; expires_at: number } {
  const token = `CAMIQ-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const expires_at = Date.now() + 30_000;
  state = {
    ...state,
    qrTokens: {
      ...state.qrTokens,
      [token]: { token, expires_at, used: false },
    },
    activePassToken: { token, expires_at },
  };
  notify();
  publishSyncEvent("QR_ISSUED", { token, expires_at });
  return { token, expires_at };
}

export function consumeGateToken(
  rawToken: string,
  cameraCode: string,
  gateName: string,
  mode: "AUTO" | "IN" | "OUT",
): GateEventRecord {
  const clean = rawToken.trim();
  const record = state.qrTokens[clean];
  const currentPresence = state.studentProfile.campus_state;
  const dir: "IN" | "OUT" =
    mode === "AUTO" ? (currentPresence === "OUT" ? "IN" : "OUT") : mode;

  let result: GateEventRecord["result"] = "ACCESS RECORDED";
  let nextPresence = currentPresence;

  if (!record) {
    // If token starts with CAMIQ- and was scanned by physical webcam from Student APK before poll arrived, accept & register it
    if (/^CAMIQ-[A-Z0-9]{6,10}$/.test(clean)) {
      result = "ACCESS RECORDED";
      nextPresence = dir;
    } else {
      result = "INVALID CREDENTIAL";
    }
  } else if (record.used) {
    result = "INVALID CREDENTIAL";
  } else if (Date.now() > record.expires_at) {
    result = "EXPIRED QR";
  } else if (dir === "IN" && currentPresence === "IN") {
    result = "ALREADY INSIDE";
  } else if (dir === "OUT" && currentPresence === "OUT") {
    result = "ALREADY OUTSIDE";
  } else {
    result = "ACCESS RECORDED";
    nextPresence = dir;
  }

  const event: GateEventRecord = {
    id: `gate-${Date.now()}`,
    camera_code: cameraCode,
    gate: gateName,
    direction: dir,
    result,
    subject: `${state.studentProfile.full_name} (${state.studentProfile.student_id})`,
    created_at: new Date().toISOString(),
  };

  state = {
    ...state,
    studentProfile: {
      ...state.studentProfile,
      campus_state: nextPresence,
    },
    qrTokens: {
      ...state.qrTokens,
      [clean]: {
        token: clean,
        expires_at: record?.expires_at ?? Date.now() + 30_000,
        used: result === "ACCESS RECORDED" ? true : (record?.used ?? false),
      },
    },
    gateEvents: [event, ...state.gateEvents].slice(0, 30),
  };
  notify();
  publishSyncEvent("GATE_CONSUMED", {
    event,
    token: clean,
    nextPresence,
  });
  return event;
}
