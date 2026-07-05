// ============================================================
// Mock Data & WebSocket Simulation Service
// Simulates Spring Boot backend + AI service in the browser
// ============================================================

export interface Drone {
  id: number;
  name: string;
  status: 'Flying' | 'Idle' | 'Charging' | 'Error' | 'Returning' | 'Mission';
  battery: number;
  speed: number;
  altitude: number;
  latitude: number;
  longitude: number;
  mission: string | null;
  lastUpdated: string;
}

export interface Mission {
  id: number;
  droneId: number;
  droneName: string;
  missionType: string;
  startLocation: string;
  destination: string;
  status: 'Planned' | 'Active' | 'Completed' | 'Cancelled' | 'Aborted';
  startTime: string;
  endTime: string | null;
  distance: number;
  duration: number | null;
  batteryUsed: number | null;
  altitude?: number;
  speed?: number;
  waypoints?: string;
}

export interface DroneImage {
  id: number;
  droneId: number;
  imageUrl: string;
  prediction: string;
  confidence: number;
  timestamp: string;
  detections: Detection[];
}

export interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface FlightLog {
  id: number;
  droneId: number;
  action: string;
  type: 'info' | 'warning' | 'critical' | 'success' | 'ai';
  timestamp: string;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  humidity: number;
  visibility: number;
  condition: string;
  rainChance?: number;   // legacy mock field
  rain?: number;         // real AI service field
  isSafe?: boolean;      // legacy mock field
  flightSafe?: boolean;  // real AI service field
  pressure?: number;
  uvIndex?: number;
  cloudCover?: number;
  warnings?: string[];
}

export interface AIDecision {
  timestamp: string;
  state: string;
  action: string;
  reason: string;
  droneId: number;
}

// ─── Initial Drone Fleet ───────────────────────────────────────
const BASE_DRONES: Drone[] = [
  { id: 1, name: 'Drone-01', status: 'Flying', battery: 86, speed: 12.4, altitude: 110, latitude: 28.6139, longitude: 77.2090, mission: 'Mapping Mission', lastUpdated: new Date().toISOString() },
  { id: 2, name: 'Drone-02', status: 'Mission', battery: 62, speed: 8.1, altitude: 85, latitude: 28.6200, longitude: 77.2150, mission: 'Crop Monitoring', lastUpdated: new Date().toISOString() },
  { id: 3, name: 'Drone-03', status: 'Idle', battery: 100, speed: 0, altitude: 0, latitude: 28.6100, longitude: 77.2050, mission: null, lastUpdated: new Date().toISOString() },
  { id: 4, name: 'Drone-04', status: 'Charging', battery: 34, speed: 0, altitude: 0, latitude: 28.6080, longitude: 77.2030, mission: null, lastUpdated: new Date().toISOString() },
  { id: 5, name: 'Drone-05', status: 'Returning', battery: 22, speed: 15.0, altitude: 60, latitude: 28.6170, longitude: 77.2200, mission: 'Surveillance', lastUpdated: new Date().toISOString() },
  { id: 6, name: 'Drone-06', status: 'Flying', battery: 74, speed: 10.5, altitude: 95, latitude: 28.6220, longitude: 77.2080, mission: 'Delivery', lastUpdated: new Date().toISOString() },
];

const MISSION_TYPES = ['Mapping', 'Crop Monitoring', 'Surveillance', 'Delivery', 'Inspection', 'Search & Rescue'];
const AI_ACTIONS = ['TAKEOFF', 'FLY', 'AVOID', 'CAPTURE', 'RETURN', 'LAND', 'HOVER'];
const AI_REASONS = [
  'Route clear, proceeding to waypoint',
  'Obstacle detected at bearing 045°, adjusting altitude',
  'Low battery threshold reached, initiating RTH',
  'Reached destination coordinates, capturing imagery',
  'Wind speed nominal, continuing mission',
  'No-fly zone boundary detected, rerouting',
  'Image capture complete, 12 objects detected',
  'Battery optimal for extended mission',
];

const OBJECT_LABELS = ['Person', 'Vehicle', 'Tree', 'Building', 'Fire', 'Animal', 'Crack', 'Water Body', 'Road', 'Power Line'];

// ─── Simulation State ──────────────────────────────────────────
let drones: Drone[] = BASE_DRONES.map(d => ({ ...d }));
let missions: Mission[] = [
  { id: 1, droneId: 1, droneName: 'Drone-01', missionType: 'Mapping', startLocation: 'Base Alpha', destination: 'Sector 7-G', status: 'Active', startTime: new Date(Date.now() - 18 * 60000).toISOString(), endTime: null, distance: 4.2, duration: null, batteryUsed: null },
  { id: 2, droneId: 2, droneName: 'Drone-02', missionType: 'Crop Monitoring', startLocation: 'Farm HQ', destination: 'Field Block 3', status: 'Active', startTime: new Date(Date.now() - 32 * 60000).toISOString(), endTime: null, distance: 2.8, duration: null, batteryUsed: null },
  { id: 3, droneId: 5, droneName: 'Drone-05', missionType: 'Surveillance', startLocation: 'Command Center', destination: 'Perimeter East', status: 'Completed', startTime: new Date(Date.now() - 90 * 60000).toISOString(), endTime: new Date(Date.now() - 12 * 60000).toISOString(), distance: 8.4, duration: 78, batteryUsed: 56 },
  { id: 4, droneId: 3, droneName: 'Drone-03', missionType: 'Delivery', startLocation: 'Warehouse', destination: 'Customer Site A', status: 'Completed', startTime: new Date(Date.now() - 180 * 60000).toISOString(), endTime: new Date(Date.now() - 140 * 60000).toISOString(), distance: 12.1, duration: 40, batteryUsed: 38 },
];

let flightLogs: FlightLog[] = [
  { id: 1, droneId: 1, action: 'Mission started — Mapping Mission', type: 'info', timestamp: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: 2, droneId: 1, action: 'Takeoff successful — altitude 110m', type: 'success', timestamp: new Date(Date.now() - 17 * 60000).toISOString() },
  { id: 3, droneId: 1, action: 'Obstacle detected at bearing 120° — rerouting', type: 'warning', timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: 4, droneId: 1, action: 'Route clear, resuming mission', type: 'info', timestamp: new Date(Date.now() - 14 * 60000).toISOString() },
  { id: 5, droneId: 2, action: 'Crop scan sector A complete — 847 images', type: 'success', timestamp: new Date(Date.now() - 10 * 60000).toISOString() },
  { id: 6, droneId: 5, action: 'Battery < 20% — Return to Home initiated', type: 'critical', timestamp: new Date(Date.now() - 8 * 60000).toISOString() },
];

let aiDecisions: AIDecision[] = [
  { timestamp: new Date(Date.now() - 5 * 60000).toISOString(), state: 'FLY', action: 'MOVE_FORWARD', reason: 'Route clear, proceeding to waypoint 3/8', droneId: 1 },
  { timestamp: new Date(Date.now() - 4 * 60000).toISOString(), state: 'AVOID', action: 'INCREASE_ALTITUDE', reason: 'Obstacle detected at bearing 045°', droneId: 1 },
  { timestamp: new Date(Date.now() - 3 * 60000).toISOString(), state: 'FLY', action: 'MOVE_FORWARD', reason: 'Obstacle cleared, resuming path', droneId: 1 },
  { timestamp: new Date(Date.now() - 2 * 60000).toISOString(), state: 'CAPTURE', action: 'TAKE_PHOTO', reason: 'Reached photo waypoint, capturing imagery', droneId: 1 },
  { timestamp: new Date(Date.now() - 1 * 60000).toISOString(), state: 'FLY', action: 'MOVE_FORWARD', reason: 'Battery 86% optimal, continuing mission', droneId: 1 },
];

let nextId = 100;

// ─── Subscriber system ────────────────────────────────────────
type Listener = (drones: Drone[]) => void;
const listeners: Listener[] = [];

export function subscribeDrones(cb: Listener) {
  listeners.push(cb);
  cb(drones);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notifyListeners() {
  listeners.forEach(cb => cb([...drones]));
}

// ─── Simulation Loop ──────────────────────────────────────────
function simulateStep() {
  drones = drones.map(drone => {
    if (drone.status === 'Idle' || drone.status === 'Charging') {
      // Charge battery
      const newBattery = drone.status === 'Charging'
        ? Math.min(100, drone.battery + 0.5)
        : drone.battery;
      const newStatus = newBattery >= 100 && drone.status === 'Charging' ? 'Idle' : drone.status;
      return { ...drone, battery: Math.round(newBattery * 10) / 10, status: newStatus, lastUpdated: new Date().toISOString() };
    }

    if (drone.status === 'Returning') {
      // Moving back to base
      const newBattery = Math.max(0, drone.battery - 0.15);
      const latDelta = (28.6100 - drone.latitude) * 0.02;
      const lonDelta = (77.2050 - drone.longitude) * 0.02;
      const newLat = drone.latitude + latDelta + (Math.random() - 0.5) * 0.0002;
      const newLon = drone.longitude + lonDelta + (Math.random() - 0.5) * 0.0002;
      const distToBase = Math.sqrt(Math.pow(newLat - 28.6100, 2) + Math.pow(newLon - 77.2050, 2));
      const landed = distToBase < 0.001 || newBattery <= 0;
      return { ...drone, battery: Math.round(newBattery * 10) / 10, latitude: newLat, longitude: newLon, status: landed ? 'Charging' : 'Returning', altitude: landed ? 0 : drone.altitude, speed: landed ? 0 : drone.speed, lastUpdated: new Date().toISOString() };
    }

    if (drone.status === 'Flying' || drone.status === 'Mission') {
      const newBattery = Math.max(0, drone.battery - 0.08);
      const latDelta = (Math.random() - 0.5) * 0.0015;
      const lonDelta = (Math.random() - 0.5) * 0.0015;
      const newAlt = Math.max(50, Math.min(200, drone.altitude + (Math.random() - 0.5) * 3));
      const newSpeed = Math.max(5, Math.min(20, drone.speed + (Math.random() - 0.5) * 0.5));
      const newStatus: Drone['status'] = newBattery < 20 ? 'Returning' : drone.status;
      if (newBattery < 20) {
        flightLogs.unshift({ id: nextId++, droneId: drone.id, action: `Battery < 20% on ${drone.name} — RTH initiated`, type: 'critical', timestamp: new Date().toISOString() });
        aiDecisions.unshift({ timestamp: new Date().toISOString(), state: 'RETURN', action: 'RETURN_HOME', reason: `Battery critical (${Math.round(newBattery)}%), initiating RTH`, droneId: drone.id });
      }
      return { ...drone, battery: Math.round(newBattery * 10) / 10, latitude: drone.latitude + latDelta, longitude: drone.longitude + lonDelta, altitude: Math.round(newAlt * 10) / 10, speed: Math.round(newSpeed * 10) / 10, status: newStatus, lastUpdated: new Date().toISOString() };
    }

    return drone;
  });

  // Add random AI decision every ~10s
  if (Math.random() < 0.3) {
    const activeDrones = drones.filter(d => d.status === 'Flying' || d.status === 'Mission');
    if (activeDrones.length > 0) {
      const drone = activeDrones[Math.floor(Math.random() * activeDrones.length)];
      const action = AI_ACTIONS[Math.floor(Math.random() * AI_ACTIONS.length)];
      const reason = AI_REASONS[Math.floor(Math.random() * AI_REASONS.length)];
      aiDecisions.unshift({ timestamp: new Date().toISOString(), state: action, action, reason, droneId: drone.id });
      if (aiDecisions.length > 50) aiDecisions.pop();
    }
  }

  notifyListeners();
}

// Start simulation at 2s intervals
setInterval(simulateStep, 2000);

// ─── API Functions ─────────────────────────────────────────────
export const api = {
  // Auth
  login: async (username: string, _password: string): Promise<string> => {
    await delay(600);
    if (username.trim() === '') throw new Error('Invalid credentials');
    return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: username, role: 'ADMIN' }))}.mock_signature`;
  },

  register: async (_username: string, _password: string): Promise<void> => {
    await delay(800);
  },

  // Drones
  getDrones: async (): Promise<Drone[]> => {
    await delay(100);
    return [...drones];
  },

  getDrone: async (id: number): Promise<Drone | undefined> => {
    await delay(50);
    return drones.find(d => d.id === id);
  },

  // Missions
  getMissions: async (): Promise<Mission[]> => {
    await delay(200);
    return [...missions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  },

  createMission: async (data: { droneId: number; missionType: string; startLocation: string; destination: string; altitude: number; speed: number }): Promise<Mission> => {
    await delay(500);
    const drone = drones.find(d => d.id === data.droneId);
    const mission: Mission = {
      id: nextId++,
      droneId: data.droneId,
      droneName: drone?.name ?? `Drone-${data.droneId}`,
      missionType: data.missionType,
      startLocation: data.startLocation,
      destination: data.destination,
      status: 'Active',
      startTime: new Date().toISOString(),
      endTime: null,
      distance: Math.random() * 15 + 2,
      duration: null,
      batteryUsed: null,
    };
    missions.unshift(mission);

    // Update drone status
    drones = drones.map(d => d.id === data.droneId
      ? { ...d, status: 'Mission', mission: data.missionType, speed: data.speed, altitude: data.altitude }
      : d
    );
    flightLogs.unshift({ id: nextId++, droneId: data.droneId, action: `Mission started — ${data.missionType} to ${data.destination}`, type: 'info', timestamp: new Date().toISOString() });
    aiDecisions.unshift({ timestamp: new Date().toISOString(), state: 'TAKEOFF', action: 'TAKEOFF', reason: `Mission initiated: ${data.missionType} — target: ${data.destination}`, droneId: data.droneId });
    notifyListeners();
    return mission;
  },

  // Images
  getImages: async (): Promise<DroneImage[]> => {
    await delay(200);
    return generateMockImages();
  },

  // Flight Logs
  getFlightLogs: async (droneId?: number): Promise<FlightLog[]> => {
    await delay(150);
    const logs = droneId ? flightLogs.filter(l => l.droneId === droneId) : flightLogs;
    return logs.slice(0, 50);
  },

  // AI Decisions
  getAIDecisions: async (): Promise<AIDecision[]> => {
    await delay(100);
    return aiDecisions.slice(0, 30);
  },

  startAutonomousMission: async (droneId: number): Promise<void> => {
    await delay(400);
    const drone = drones.find(d => d.id === droneId);
    if (!drone) throw new Error('Drone not found');

    const states = ['TAKEOFF', 'FLY', 'FLY', 'AVOID', 'FLY', 'CAPTURE', 'FLY', 'RETURN', 'LAND'];
    const reasons = [
      'Autonomous mission initiated', 'Route computed, proceeding',
      'Waypoint reached, continuing', 'Obstacle detected — altitude +20m',
      'Obstacle cleared, resuming', 'Photo waypoint reached, capturing',
      'Returning to base', 'Final approach', 'Mission complete, landing'
    ];
    states.forEach((state, i) => {
      setTimeout(() => {
        aiDecisions.unshift({ timestamp: new Date().toISOString(), state, action: state, reason: reasons[i], droneId });
        if (state === 'LAND') {
          drones = drones.map(d => d.id === droneId ? { ...d, status: 'Charging', altitude: 0, speed: 0 } : d);
          notifyListeners();
        }
      }, i * 3000);
    });

    drones = drones.map(d => d.id === droneId ? { ...d, status: 'Mission', mission: 'Autonomous' } : d);
    notifyListeners();
  },

  // Weather
  getWeather: async (): Promise<WeatherData> => {
    await delay(300);
    const windSpeed = Math.random() * 30;
    const visibility = Math.random() * 10 + 2;
    return {
      temperature: Math.round(22 + Math.random() * 15),
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      humidity: Math.round(40 + Math.random() * 50),
      visibility: Math.round(visibility * 10) / 10,
      condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Thunderstorm'][Math.floor(Math.random() * 5)],
      rainChance: Math.round(Math.random() * 80),
      isSafe: windSpeed < 20 && visibility > 3,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────
function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

function generateMockImages(): DroneImage[] {
  const images = [];
  for (let i = 0; i < 6; i++) {
    const numDetections = Math.floor(Math.random() * 4) + 1;
    const detections: Detection[] = Array.from({ length: numDetections }, () => ({
      label: OBJECT_LABELS[Math.floor(Math.random() * OBJECT_LABELS.length)],
      confidence: Math.round((Math.random() * 0.4 + 0.6) * 100) / 100,
      bbox: [Math.random() * 400, Math.random() * 300, Math.random() * 150 + 50, Math.random() * 150 + 50] as [number, number, number, number],
    }));
    const droneId = i % 2 === 0 ? 1 : 2;
    images.push({
      id: i + 1,
      droneId,
      imageUrl: `https://picsum.photos/seed/${i + 1 + Math.floor(Date.now() / 30000)}/800/600`,
      prediction: detections[0].label,
      confidence: detections[0].confidence,
      timestamp: new Date(Date.now() - i * 15000).toISOString(),
      detections,
    });
  }
  return images;
}

// Export live state getter
export function getLiveDrones(): Drone[] { return drones; }
export function getLiveAIDecisions(): AIDecision[] { return aiDecisions; }

export { MISSION_TYPES };
