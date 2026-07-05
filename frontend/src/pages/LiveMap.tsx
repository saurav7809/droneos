import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { subscribeDrones, Drone } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';
import { realApi } from '../services/realApi';
import { subscribeApiMode, ApiMode } from '../services/realApi';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLOR: Record<string, string> = {
  Flying: '#00ff88', Mission: '#00d4ff', Idle: '#4a6580',
  Charging: '#ffb800', Returning: '#a78bfa', Error: '#ff3b5c',
};

function makeDroneIcon(status: string, battery: number) {
  const color = STATUS_COLOR[status] ?? '#00d4ff';
  const battColor = battery > 60 ? '#00ff88' : battery > 20 ? '#ffb800' : '#ff3b5c';
  const pulse = status === 'Flying' || status === 'Mission';
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="position:relative;width:40px;height:40px;">
        ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.2;animation:ping 1.5s ease-in-out infinite"></div>` : ''}
        <div style="position:absolute;inset:4px;border-radius:50%;background:rgba(6,13,24,0.95);border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 10px ${color}44;">🛸</div>
        <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);background:${battColor};height:3px;width:${battery}%;max-width:32px;border-radius:2px;"></div>
      </div>
      <style>@keyframes ping{0%,100%{transform:scale(1);opacity:0.2}50%{transform:scale(1.8);opacity:0}}</style>
    `,
  });
}

function makeBaseIcon() {
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:50%;background:rgba(6,13,24,0.95);border:2px solid #7c3aed;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 8px #7c3aed44;">🏠</div>`,
  });
}

const NO_FLY_ZONES = [
  { center: [28.6250, 77.2100] as [number, number], radius: 500, label: 'Airport Exclusion Zone', reason: 'DGCA restricted airspace' },
  { center: [28.6050, 77.2300] as [number, number], radius: 300, label: 'Government Area', reason: 'No drone operations permitted' },
  { center: [28.6180, 77.1980] as [number, number], radius: 200, label: 'Hospital Zone', reason: 'EMI-sensitive area' },
];

const WAYPOINTS = [
  { name: 'Waypoint Alpha', pos: [28.6155, 77.2080] as [number, number] },
  { name: 'Waypoint Bravo', pos: [28.6200, 77.2180] as [number, number] },
  { name: 'Waypoint Charlie', pos: [28.6120, 77.2200] as [number, number] },
];

const BASE = [28.6100, 77.2050] as [number, number];
const TRAIL_COLORS = ['#00d4ff', '#00ff88', '#ffb800', '#a78bfa', '#f472b6', '#fb923c'];

function DroneTrailLayer({ drones }: { drones: Drone[] }) {
  const trailsRef = useRef<Map<number, [number, number][]>>(new Map());
  drones.forEach(d => {
    if (!trailsRef.current.has(d.id)) trailsRef.current.set(d.id, []);
    const trail = trailsRef.current.get(d.id)!;
    const last = trail[trail.length - 1];
    if (!last || last[0] !== d.latitude || last[1] !== d.longitude) {
      trail.push([d.latitude, d.longitude]);
      if (trail.length > 50) trail.shift();
    }
  });
  return (
    <>
      {drones.map((d, i) => {
        const trail = trailsRef.current.get(d.id) ?? [];
        return trail.length > 1 ? (
          <Polyline key={d.id} positions={trail} color={TRAIL_COLORS[i % TRAIL_COLORS.length]} weight={2} opacity={0.6} dashArray="4 4" />
        ) : null;
      })}
    </>
  );
}

function WaypointLayer() {
  const icon = L.divIcon({
    className: '',
    iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:rgba(6,13,24,0.9);border:2px solid #ffb800;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ffb800;font-weight:700;">W</div>`,
  });
  return (
    <>
      {WAYPOINTS.map((wp, i) => (
        <Marker key={i} position={wp.pos} icon={icon}>
          <Popup><strong>📍 {wp.name}</strong><br /><span style={{ color: '#888', fontSize: 12 }}>{wp.pos[0].toFixed(5)}°N, {wp.pos[1].toFixed(5)}°E</span></Popup>
        </Marker>
      ))}
      <Polyline positions={WAYPOINTS.map(w => w.pos)} color="#ffb80055" weight={1.5} dashArray="6 6" />
    </>
  );
}

function MapAutofit({ drones, followId }: { drones: Drone[]; followId: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (followId !== null) {
      const d = drones.find(d => d.id === followId);
      if (d) map.panTo([d.latitude, d.longitude], { animate: true, duration: 0.8 });
    }
  }, [drones, followId, map]);
  return null;
}

export default function LiveMap() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [followId, setFollowId] = useState<number | null>(null);
  const [showTrails, setShowTrails] = useState(true);
  const [showNoFly, setShowNoFly] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [cmdFeedback, setCmdFeedback] = useState<Record<number, string>>({});
  const [apiMode, setApiMode] = useState<ApiMode>('checking');

  // Merge mock + WebSocket data
  useEffect(() => {
    const u1 = subscribeDrones(setDrones);
    const u2 = subscribeLiveDrones(live => { if (live.length > 0) setDrones(live); });
    return () => { u1(); u2(); };
  }, []);
  useEffect(() => { const unsub = subscribeApiMode(setApiMode); return () => { unsub(); }; }, []);

  const sendCmd = async (droneId: number, cmd: string) => {
    setCmdFeedback(f => ({ ...f, [droneId]: '…' }));
    try {
      if (apiMode === 'real') {
        const token = localStorage.getItem('drone_user')
          ? JSON.parse(localStorage.getItem('drone_user')!).token : '';
        const res = await fetch(`http://localhost:8080/api/drones/${droneId}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ command: cmd }),
        });
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { message: text || 'OK' }; }
        setCmdFeedback(f => ({ ...f, [droneId]: data.message || data.error || 'Done' }));
      } else {
        setCmdFeedback(f => ({ ...f, [droneId]: `[Mock] ${cmd} sent` }));
      }
    } catch (e: any) {
      setCmdFeedback(f => ({ ...f, [droneId]: 'Error: ' + e.message }));
    }
    setTimeout(() => setCmdFeedback(f => { const n = { ...f }; delete n[droneId]; return n; }), 4000);
  };

  const center: [number, number] = [28.6150, 77.2100];
  const selected = drones.find(d => d.id === selectedId);

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div>
          <h1 className="page-title">🗺 Live Map</h1>
          <p className="page-subtitle">
            Real-time drone positions · {drones.filter(d => d.status === 'Flying' || d.status === 'Mission').length} airborne
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button id="map-toggle-trails"    className={`btn ${showTrails ? 'btn-primary' : 'btn-ghost'}`}    style={{ fontSize: 12 }} onClick={() => setShowTrails(t => !t)}>✦ Trails</button>
          <button id="map-toggle-nofly"     className={`btn ${showNoFly ? 'btn-danger' : 'btn-ghost'}`}      style={{ fontSize: 12 }} onClick={() => setShowNoFly(n => !n)}>⛔ No-Fly</button>
          <button id="map-toggle-waypoints" className={`btn ${showWaypoints ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }} onClick={() => setShowWaypoints(w => !w)}>📍 Waypoints</button>
          {followId && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFollowId(null)}>✕ Stop Follow</button>}
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, minHeight: 0 }}>
        {/* Map */}
        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative' }}>
          <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            />
            <Marker position={BASE} icon={makeBaseIcon()}>
              <Popup><div style={{ fontFamily: 'Inter', fontSize: 13 }}><strong>🏠 Drone Base Alpha</strong><br /><span style={{ color: '#888' }}>Home · 28.6100°N 77.2050°E</span></div></Popup>
            </Marker>
            {showNoFly && NO_FLY_ZONES.map((z, i) => (
              <Circle key={i} center={z.center} radius={z.radius} color="#ff3b5c" fillColor="#ff3b5c" fillOpacity={0.12} weight={1.5} dashArray="6 4">
                <Popup><strong>⛔ {z.label}</strong><br /><span style={{ color: '#888', fontSize: 12 }}>{z.reason}<br />Radius: {z.radius}m</span></Popup>
              </Circle>
            ))}
            {showWaypoints && <WaypointLayer />}
            {showTrails && <DroneTrailLayer drones={drones} />}
            {drones.map(drone => (
              <Marker
                key={drone.id}
                position={[drone.latitude, drone.longitude]}
                icon={makeDroneIcon(drone.status, drone.battery)}
                eventHandlers={{ click: () => setSelectedId(drone.id === selectedId ? null : drone.id) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, minWidth: 180 }}>
                    <strong style={{ fontSize: 15 }}>🛸 {drone.name}</strong>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
                      <span style={{ color: '#888' }}>Status</span>
                      <span style={{ color: STATUS_COLOR[drone.status] ?? '#fff', fontWeight: 700 }}>{drone.status}</span>
                      <span style={{ color: '#888' }}>Battery</span><span>{drone.battery}%</span>
                      <span style={{ color: '#888' }}>Speed</span><span>{drone.speed} m/s</span>
                      <span style={{ color: '#888' }}>Altitude</span><span>{drone.altitude} m</span>
                      <span style={{ color: '#888' }}>Lat</span><span>{drone.latitude.toFixed(5)}°N</span>
                      <span style={{ color: '#888' }}>Lon</span><span>{drone.longitude.toFixed(5)}°E</span>
                    </div>
                    {drone.mission && <div style={{ marginTop: 8, color: '#00d4ff', fontWeight: 600, fontSize: 12 }}>📡 {drone.mission}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {['RTH', 'LAND'].map(cmd => (
                        <button key={cmd}
                          onClick={() => sendCmd(drone.id, cmd)}
                          style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid #ff3b5c55', background: 'rgba(255,59,92,0.1)', color: '#ff3b5c', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {cmd}
                        </button>
                      ))}
                    </div>
                    {cmdFeedback[drone.id] && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#00ff88', borderTop: '1px solid #ffffff22', paddingTop: 6 }}>{cmdFeedback[drone.id]}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            <MapAutofit drones={drones} followId={followId} />
          </MapContainer>

          {/* Map legend overlay */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
            background: 'rgba(6,13,24,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 11,
          }}>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Fleet Positions ({drones.length})
          </div>
          {drones.map((drone, i) => (
            <div
              key={drone.id}
              id={`map-drone-${drone.id}`}
              className="card"
              style={{
                padding: '10px 12px', cursor: 'pointer',
                borderColor: selectedId === drone.id ? 'var(--accent-cyan)' : undefined,
                borderLeft: `3px solid ${STATUS_COLOR[drone.status] ?? '#4a6580'}`,
              }}
              onClick={() => setSelectedId(selectedId === drone.id ? null : drone.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>🛸 {drone.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[drone.status] }}>{drone.status}</span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-cyan)', marginBottom: 6 }}>
                {drone.latitude.toFixed(5)}°N · {drone.longitude.toFixed(5)}°E
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>🔋 {drone.battery}%</span>
                <span>↑ {drone.altitude}m</span>
                <span>→ {drone.speed}m/s</span>
              </div>
              {/* Battery bar */}
              <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${drone.battery}%`,
                  background: drone.battery > 60 ? '#00ff88' : drone.battery > 20 ? '#ffb800' : '#ff3b5c',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {/* Follow button */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setFollowId(followId === drone.id ? null : drone.id); }}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${TRAIL_COLORS[i % TRAIL_COLORS.length]}55`,
                    background: followId === drone.id ? `${TRAIL_COLORS[i % TRAIL_COLORS.length]}22` : 'transparent',
                    color: TRAIL_COLORS[i % TRAIL_COLORS.length],
                  }}>
                  {followId === drone.id ? '📡 Following' : '👁 Follow'}
                </button>
                {(drone.status === 'Flying' || drone.status === 'Mission') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); sendCmd(drone.id, 'RTH'); }}
                    style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid #ff3b5c55', background: 'rgba(255,59,92,0.1)', color: '#ff3b5c' }}>
                    RTH
                  </button>
                )}
              </div>
              {cmdFeedback[drone.id] && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#00ff88', padding: '3px 6px', background: 'rgba(0,255,136,0.08)', borderRadius: 4 }}>
                  {cmdFeedback[drone.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
