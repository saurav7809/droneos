import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Drone } from './mockApi';

// ─── Connection State ─────────────────────────────────────────
export type BackendStatus = 'connecting' | 'connected' | 'disconnected' | 'mock';

let stompClient: Client | null = null;
let backendStatus: BackendStatus = 'connecting';
let droneSubscription: StompSubscription | null = null;

const statusListeners: Set<(s: BackendStatus) => void> = new Set();
const droneListeners: Set<(d: Drone[]) => void> = new Set();

export function subscribeBackendStatus(cb: (s: BackendStatus) => void) {
  statusListeners.add(cb);
  cb(backendStatus);
  return () => statusListeners.delete(cb);
}

function notifyStatus(s: BackendStatus) {
  backendStatus = s;
  statusListeners.forEach(cb => cb(s));
}

function notifyDrones(drones: Drone[]) {
  droneListeners.forEach(cb => cb(drones));
}

export function subscribeLiveDrones(cb: (d: Drone[]) => void) {
  droneListeners.add(cb);
  return () => droneListeners.delete(cb);
}

// ─── Alert types ──────────────────────────────────────────────
export interface BackendAlert {
  droneId: number;
  droneName: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  message: string;
  type: string;
  timestamp: string;
}

let alertSubscription: StompSubscription | null = null;
const alertListeners: Set<(a: BackendAlert[]) => void> = new Set();

export function subscribeAlerts(cb: (a: BackendAlert[]) => void) {
  alertListeners.add(cb);
  return () => alertListeners.delete(cb);
}

function notifyAlerts(alerts: BackendAlert[]) {
  alertListeners.forEach(cb => cb(alerts));
}

// ─── STOMP WebSocket Connection ───────────────────────────────
export function connectWebSocket() {
  if (stompClient?.connected) return;

  const isDevMode = import.meta.env.DEV;
  const WS_URL = import.meta.env.VITE_WS_BASE_URL ?? (isDevMode ? 'http://localhost:8080' : '');
  stompClient = new Client({
    webSocketFactory: () => new SockJS(`${WS_URL}/ws`),
    reconnectDelay: 5000,
    onConnect: () => {
      notifyStatus('connected');
      // Subscribe to live drone telemetry
      droneSubscription = stompClient!.subscribe('/topic/drones', (msg: IMessage) => {
        try {
          const drones: Drone[] = JSON.parse(msg.body);
          notifyDrones(drones);
        } catch (e) {
          console.warn('Failed to parse drone message:', e);
        }
      });
      // Subscribe to real-time alerts
      alertSubscription = stompClient!.subscribe('/topic/alerts', (msg: IMessage) => {
        try {
          const alerts: BackendAlert[] = JSON.parse(msg.body);
          notifyAlerts(alerts);
        } catch (e) {
          console.warn('Failed to parse alert message:', e);
        }
      });
    },
    onDisconnect: () => { notifyStatus('disconnected'); },
    onStompError:  () => { notifyStatus('disconnected'); },
    onWebSocketClose: () => { if (backendStatus === 'connected') notifyStatus('disconnected'); },
  });

  try {
    stompClient.activate();
  } catch {
    notifyStatus('disconnected');
  }
}

export function disconnectWebSocket() {
  droneSubscription?.unsubscribe();
  alertSubscription?.unsubscribe();
  stompClient?.deactivate();
  stompClient = null;
}

export function getBackendStatus(): BackendStatus {
  return backendStatus;
}
