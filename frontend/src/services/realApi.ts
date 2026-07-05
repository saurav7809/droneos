/**
 * realApi.ts
 * Real HTTP + WebSocket API client for Spring Boot backend.
 * Automatically falls back to mock simulation if backend is unreachable.
 */
import axios, { AxiosInstance } from 'axios';
import { Drone, Mission, FlightLog, DroneImage, WeatherData, AIDecision } from './mockApi';
import * as mock from './mockApi';

// ─── Environment-aware base URLs ────────────────────────────────
// In dev: falls back to localhost via Vite proxy
// In production: set VITE_API_BASE_URL and VITE_AI_BASE_URL on your host
const BASE_URL  = import.meta.env.VITE_API_BASE_URL  || 'http://localhost:8080';
const AI_URL    = import.meta.env.VITE_AI_BASE_URL   || 'http://localhost:5000';
const HEALTH_TIMEOUT = 3000;

// ─── Backend availability detection ──────────────────────────
let useRealBackend = false;
let backendChecked = false;

export type ApiMode = 'real' | 'mock' | 'checking';
const modeListeners: Set<(m: ApiMode) => void> = new Set();
let currentMode: ApiMode = 'checking';

export function subscribeApiMode(cb: (m: ApiMode) => void) {
  modeListeners.add(cb);
  cb(currentMode);
  return () => modeListeners.delete(cb);
}

function setMode(m: ApiMode) {
  currentMode = m;
  modeListeners.forEach(cb => cb(m));
}

// ─── Axios client with JWT auth ───────────────────────────────
let axiosClient: AxiosInstance = axios.create({ baseURL: BASE_URL, timeout: 5000 });

function updateAxiosAuth(token: string) {
  axiosClient = axios.create({
    baseURL: BASE_URL,
    timeout: 5000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Health check ─────────────────────────────────────────────
async function checkBackend(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/api/auth/health`, { timeout: HEALTH_TIMEOUT });
    return true;
  } catch {
    // Try an unauthenticated endpoint that returns something
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {}, { timeout: HEALTH_TIMEOUT });
      return true; // Got a 400/401 — backend IS running
    } catch (err: any) {
      if (err?.response) return true; // Any HTTP response means backend is up
      return false;
    }
  }
}

// Initialize: detect backend, then wire up appropriately
export async function initApi(): Promise<ApiMode> {
  if (backendChecked) return currentMode;
  backendChecked = true;

  const token = localStorage.getItem('drone_user')
    ? JSON.parse(localStorage.getItem('drone_user')!).token
    : null;

  if (token) updateAxiosAuth(token);

  const alive = await checkBackend();
  useRealBackend = alive;
  setMode(alive ? 'real' : 'mock');
  console.log(`[DroneOS] API mode: ${alive ? '🟢 REAL backend' : '🟡 Mock simulation'}`);
  return currentMode;
}

// ─── Unified API ──────────────────────────────────────────────
export const realApi = {

  // Auth
  login: async (username: string, password: string): Promise<string> => {
    if (!useRealBackend) return mock.api.login(username, password);
    const res = await axiosClient.post('/api/auth/login', { username, password });
    const token = res.data.token;
    updateAxiosAuth(token);
    return token;
  },

  register: async (username: string, password: string): Promise<void> => {
    if (!useRealBackend) return mock.api.register(username, password);
    await axiosClient.post('/api/auth/register', { username, password });
  },

  // Drones
  getDrones: async (): Promise<Drone[]> => {
    if (!useRealBackend) return mock.api.getDrones();
    const res = await axiosClient.get('/api/drones');
    return res.data;
  },

  getDrone: async (id: number): Promise<Drone | undefined> => {
    if (!useRealBackend) return mock.api.getDrone(id);
    try {
      const res = await axiosClient.get(`/api/drones/${id}`);
      return res.data;
    } catch { return undefined; }
  },

  // Missions
  getMissions: async (): Promise<Mission[]> => {
    if (!useRealBackend) return mock.api.getMissions();
    const res = await axiosClient.get('/api/missions');
    // Normalize JPA response (drone is nested object)
    return res.data.map((m: any) => ({
      ...m,
      droneId: m.drone?.id ?? m.droneId,
      droneName: m.drone?.name ?? m.droneName,
    }));
  },

  createMission: async (data: {
    droneId: number; missionType: string; startLocation: string;
    destination: string; altitude: number; speed: number;
  }): Promise<Mission> => {
    if (!useRealBackend) return mock.api.createMission(data);
    const res = await axiosClient.post('/api/missions', data);
    return {
      ...res.data,
      droneId: res.data.drone?.id ?? res.data.droneId,
      droneName: res.data.drone?.name ?? res.data.droneName,
    };
  },

  // Flight logs
  getFlightLogs: async (droneId?: number): Promise<FlightLog[]> => {
    if (!useRealBackend) return mock.api.getFlightLogs(droneId);
    const url = droneId ? `/api/logs/${droneId}` : '/api/logs';
    const res = await axiosClient.get(url);
    return res.data.map((l: any) => ({
      ...l,
      droneId: l.drone?.id ?? l.droneId,
    }));
  },

  // Images (AI service or mock)
  getImages: async (): Promise<DroneImage[]> => {
    return mock.api.getImages(); // AI service optional
  },

  // AI decisions
  getAIDecisions: async (): Promise<AIDecision[]> => {
    return mock.api.getAIDecisions();
  },

  startAutonomousMission: async (droneId: number): Promise<void> => {
    return mock.api.startAutonomousMission(droneId);
  },

  // Drone commands
  sendCommand: async (droneId: number, command: string): Promise<{ success: boolean; message: string; newStatus: string }> => {
    if (!useRealBackend) {
      // Mock implementation: simulate command execution
      await new Promise(r => setTimeout(r, 300));
      return { success: true, message: `${command} command executed (mock)`, newStatus: command === 'RTH' ? 'Returning' : command === 'LAND' ? 'Charging' : 'Flying' };
    }
    const res = await axiosClient.post(`/api/drones/${droneId}/commands`, { command });
    return res.data;
  },

  // Fleet analytics
  getFleetAnalytics: async (): Promise<Record<string, any>> => {
    if (!useRealBackend) {
      // Generate mock analytics from current mock state
      const drones = await mock.api.getDrones();
      const missions = await mock.api.getMissions();
      const statusBreakdown: Record<string, number> = {};
      drones.forEach(d => { statusBreakdown[d.status] = (statusBreakdown[d.status] ?? 0) + 1; });
      const missionTypeBreakdown: Record<string, number> = {};
      missions.forEach(m => { missionTypeBreakdown[m.missionType] = (missionTypeBreakdown[m.missionType] ?? 0) + 1; });
      return {
        totalDrones: drones.length,
        activeDrones: drones.filter(d => d.status === 'Flying' || d.status === 'Mission').length,
        avgBatteryPct: Math.round(drones.reduce((a, d) => a + d.battery, 0) / (drones.length || 1)),
        lowBatteryCount: drones.filter(d => d.battery < 20).length,
        statusBreakdown,
        totalMissions: missions.length,
        missionStatusBreakdown: missions.reduce((acc: Record<string, number>, m) => { acc[m.status] = (acc[m.status] ?? 0) + 1; return acc; }, {}),
        missionTypeBreakdown,
        totalDistanceKm: missions.reduce((a, m) => a + (m.distance ?? 0), 0).toFixed(1),
        avgMissionDistanceKm: (missions.reduce((a, m) => a + (m.distance ?? 0), 0) / (missions.length || 1)).toFixed(1),
        fleetHealthScore: 82,
        logCount: 24,
      };
    }
    const res = await axiosClient.get('/api/analytics/fleet');
    return res.data;
  },

  getDroneAnalytics: async (droneId: number): Promise<Record<string, any>> => {
    if (!useRealBackend) {
      const missions = await mock.api.getMissions();
      const drone = await mock.api.getDrone(droneId);
      const droneMissions = missions.filter(m => m.droneId === droneId);
      return {
        droneId,
        droneName: drone?.name ?? `Drone-${droneId}`,
        totalMissions: droneMissions.length,
        completedMissions: droneMissions.filter(m => m.status === 'Completed').length,
        successRate: droneMissions.length ? Math.round(droneMissions.filter(m => m.status === 'Completed').length / droneMissions.length * 100) : 0,
        totalDistanceKm: droneMissions.reduce((a, m) => a + (m.distance ?? 0), 0).toFixed(1),
        missions: droneMissions,
      };
    }
    const res = await axiosClient.get(`/api/analytics/drone/${droneId}`);
    return res.data;
  },

  // Weather — fetches from Python AI service when available
  getWeather: async (): Promise<WeatherData> => {
    try {
      const res = await axios.get(`${AI_URL}/ai/weather`, { timeout: 2500 });
      if (res.data && res.data.temperature !== undefined) {
        // Map AI service response to our WeatherData shape
        return {
          temperature:   res.data.temperature,
          humidity:      res.data.humidity,
          windSpeed:     res.data.windSpeed,
          windDirection: res.data.windDirection,
          visibility:    res.data.visibility,
          rain:          res.data.rain ?? 0,
          rainChance:    res.data.rain ?? 0,
          condition:     res.data.condition ?? 'Clear',
          pressure:      res.data.pressure ?? 1013,
          uvIndex:       res.data.uvIndex ?? 0,
          cloudCover:    res.data.cloudCover ?? 0,
          flightSafe:    res.data.flightSafe ?? true,
          isSafe:        res.data.flightSafe ?? true,
          warnings:      res.data.warnings ?? [],
        };
      }
    } catch { /* fall through to mock */ }
    return mock.api.getWeather();
  },
};

// Re-export MISSION_TYPES
export { MISSION_TYPES } from './mockApi';
