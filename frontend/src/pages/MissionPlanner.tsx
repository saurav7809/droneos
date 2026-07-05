import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import { realApi as api, MISSION_TYPES } from '../services/realApi';
import { Mission, Drone, subscribeDrones } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Waypoint types ───────────────────────────────────────────
interface Waypoint { id: number; lat: number; lng: number; label: string; altitude: number; speed: number; action: string; }

const WAYPOINT_ACTIONS = ['FLY_THROUGH', 'HOVER_5S', 'HOVER_10S', 'CAPTURE_IMAGE', 'SCAN_360', 'RTH'];

function waypointIcon(n: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid #fff;
           display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;
           color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:grab;">${n}</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

function droneMarkerIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px ${color});">🛸</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

// ─── Map click handler ────────────────────────────────────────
function MapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onAdd(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ─── Status badge color ───────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Pending: '#ffb800', Active: '#00d4ff', Completed: '#00ff88',
  Failed: '#ff3b5c', Aborted: '#ff3b5c',
};

const DRONE_STATUS_COLORS: Record<string, string> = {
  Flying: '#00ff88', Mission: '#00d4ff', Idle: '#6b7280',
  Charging: '#ffb800', Error: '#ff3b5c', Returning: '#a78bfa',
};

export default function MissionPlanner() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'plan' | 'missions'>('plan');
  const [selectedWp, setSelectedWp] = useState<number | null>(null);

  // Waypoints on map
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const wpId = useRef(1);

  const [form, setForm] = useState({
    droneId: '',
    missionType: MISSION_TYPES[0],
    missionName: '',
    defaultAltitude: '100',
    defaultSpeed: '12',
  });

  useEffect(() => {
    const u1 = subscribeDrones(setDrones);
    const u2 = subscribeLiveDrones(live => { if (live.length > 0) setDrones(live); });
    api.getMissions().then(setMissions);
    return () => { u1(); u2(); };
  }, []);

  // Map click → add waypoint
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const id = wpId.current++;
    setWaypoints(prev => [...prev, {
      id, lat, lng,
      label: `WP${id}`,
      altitude: Number(form.defaultAltitude),
      speed: Number(form.defaultSpeed),
      action: 'FLY_THROUGH',
    }]);
  }, [form.defaultAltitude, form.defaultSpeed]);

  const removeWp = (id: number) => { setWaypoints(p => p.filter(w => w.id !== id)); if (selectedWp === id) setSelectedWp(null); };
  const clearWps = () => { setWaypoints([]); wpId.current = 1; setSelectedWp(null); };
  const moveUp    = (i: number) => { if (i === 0) return; setWaypoints(p => { const a = [...p]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; }); };
  const moveDown  = (i: number) => { setWaypoints(p => { if (i >= p.length-1) return p; const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; }); };
  const updateWp  = (id: number, field: keyof Waypoint, value: string | number) =>
    setWaypoints(p => p.map(w => w.id === id ? { ...w, [field]: value } : w));

  // Total distance estimate
  const totalDist = waypoints.reduce((acc, wp, i) => {
    if (i === 0) return acc;
    const prev = waypoints[i-1];
    const dlat = (wp.lat - prev.lat) * 111.32;
    const dlng = (wp.lng - prev.lng) * 111.32 * Math.cos(prev.lat * Math.PI / 180);
    return acc + Math.sqrt(dlat*dlat + dlng*dlng);
  }, 0);

  const estTime = waypoints.length > 1 && Number(form.defaultSpeed) > 0
    ? (totalDist * 1000 / Number(form.defaultSpeed) / 60).toFixed(1)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.droneId) { setError('Select a drone'); return; }
    if (waypoints.length < 2) { setError('Add at least 2 waypoints on the map'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const dest = waypoints.map(w => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join('|');
      const start = `${waypoints[0].lat.toFixed(5)},${waypoints[0].lng.toFixed(5)}`;
      const m = await api.createMission({
        droneId:       Number(form.droneId),
        missionType:   form.missionType,
        startLocation: form.missionName || start,
        destination:   dest,
        altitude:      Number(form.defaultAltitude),
        speed:         Number(form.defaultSpeed),
      });
      setSuccess(`✅ Mission #${m.id} dispatched — ${waypoints.length} waypoints · ${totalDist.toFixed(1)} km`);
      setMissions(await api.getMissions());
      clearWps();
      setForm(f => ({ ...f, droneId: '', missionName: '' }));
    } catch {
      setError('Failed to create mission. Make sure a drone is selected and backend is connected.');
    } finally { setLoading(false); }
  };

  const available = drones.filter(d => d.status === 'Idle' || d.status === 'Charging');
  const flying    = drones.filter(d => d.status === 'Flying' || d.status === 'Mission' || d.status === 'Returning');

  const mapCenter: [number, number] = [28.6139, 77.2090]; // New Delhi default

  const wpColors = ['#00d4ff','#00ff88','#ffb800','#ff3b5c','#a78bfa','#f97316','#ec4899','#14b8a6'];

  const selWp = selectedWp !== null ? waypoints.find(w => w.id === selectedWp) : null;

  const inputSt: React.CSSProperties = {
    width: '100%', background: 'var(--bg-elevated)',
    border: '1px solid var(--border-medium)', borderRadius: 8,
    color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
  };
  const labelSt: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', gap: 0 }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <div>
          <h1 className="page-title">🗺 Mission Planner</h1>
          <p className="page-subtitle">Click the map to drop waypoints · Drag to reorder · Dispatch to drone</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={`btn ${tab === 'plan' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }} onClick={() => setTab('plan')}>📐 Plan</button>
          <button className={`btn ${tab === 'missions' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }} onClick={() => setTab('missions')}>📋 Missions ({missions.length})</button>
        </div>
      </div>

      {tab === 'missions' ? (
        // ── Missions list ──────────────────────────────────────
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {missions.length === 0 && (
              <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No missions yet. Create one in the Plan tab!
              </div>
            )}
            {missions.map(m => (
              <div key={m.id} className="card" style={{ borderLeft: `3px solid ${STATUS_COLORS[m.status] ?? '#4a6580'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Mission #{m.id}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: `${STATUS_COLORS[m.status] ?? '#4a6580'}20`, color: STATUS_COLORS[m.status] ?? '#6b7280' }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent-cyan)', marginBottom: 6 }}>{m.missionType}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['Drone', m.droneName ?? `#${m.droneId}`], ['From', m.startLocation], ['Alt', m.altitude ? `${m.altitude}m` : '—'], ['Speed', m.speed ? `${m.speed} m/s` : '—']].map(([k, v]) => (
                    <div key={k}><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k}</span><br /><span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── Plan view ─────────────────────────────────────────
        <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>

          {/* ── Map (left) ─────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <MapContainer center={mapCenter} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
              />
              <MapClickHandler onAdd={handleMapClick} />

              {/* Live drone markers */}
              {flying.map(d => (
                <Marker key={d.id} position={[d.latitude, d.longitude]}
                  icon={droneMarkerIcon(DRONE_STATUS_COLORS[d.status] ?? '#00d4ff')}>
                  <Popup>
                    <div style={{ background: '#0a0f1e', color: '#e2e8f0', padding: 8, borderRadius: 8, minWidth: 140 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>🛸 {d.name}</div>
                      <div style={{ fontSize: 12 }}>Status: <b style={{ color: DRONE_STATUS_COLORS[d.status] }}>{d.status}</b></div>
                      <div style={{ fontSize: 12 }}>Battery: <b>{d.battery}%</b></div>
                      <div style={{ fontSize: 12 }}>Alt: <b>{typeof d.altitude === 'number' ? d.altitude.toFixed(0) : d.altitude}m</b></div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Waypoint route line */}
              {waypoints.length > 1 && (
                <Polyline
                  positions={waypoints.map(w => [w.lat, w.lng])}
                  pathOptions={{ color: '#00d4ff', weight: 2, dashArray: '6 4', opacity: 0.85 }}
                />
              )}

              {/* Waypoint markers */}
              {waypoints.map((wp, i) => (
                <Marker
                  key={wp.id}
                  position={[wp.lat, wp.lng]}
                  icon={waypointIcon(i + 1, selectedWp === wp.id ? '#ffb800' : wpColors[i % wpColors.length])}
                  eventHandlers={{ click: () => setSelectedWp(wp.id === selectedWp ? null : wp.id) }}
                >
                  <Popup>
                    <div style={{ background: '#0a0f1e', color: '#e2e8f0', padding: 8, borderRadius: 8, minWidth: 160 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>📍 Waypoint {i + 1}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#00d4ff' }}>
                        {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Alt: {wp.altitude}m · Speed: {wp.speed} m/s</div>
                      <div style={{ fontSize: 12 }}>Action: {wp.action}</div>
                      <button onClick={() => removeWp(wp.id)}
                        style={{ marginTop: 8, fontSize: 11, background: '#ff3b5c22', border: '1px solid #ff3b5c', borderRadius: 6, color: '#ff3b5c', padding: '3px 10px', cursor: 'pointer' }}>
                        ✕ Remove
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map overlay hints */}
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, background: 'rgba(10,15,30,0.85)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', backdropFilter: 'blur(8px)' }}>
              🖱 Click map to add waypoints
            </div>
            {waypoints.length > 1 && (
              <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 1000, background: 'rgba(10,15,30,0.9)', borderRadius: 8, padding: '8px 14px', backdropFilter: 'blur(8px)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff' }}>{waypoints.length} waypoints</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 10 }}>{totalDist.toFixed(2)} km total</span>
                {estTime && <span style={{ color: '#00ff88', fontSize: 11, marginLeft: 10 }}>~{estTime} min</span>}
              </div>
            )}
          </div>

          {/* ── Right panel ─────────────────────────────────── */}
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

            {/* Waypoint editor */}
            {selWp && (
              <div className="card" style={{ border: '1px solid #ffb800aa' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffb800', marginBottom: 10 }}>✏️ Edit Waypoint {waypoints.findIndex(w => w.id === selWp.id) + 1}</div>
                <label style={labelSt}>Altitude (m)</label>
                <input type="number" style={{ ...inputSt, marginBottom: 8 }} value={selWp.altitude}
                  onChange={e => updateWp(selWp.id, 'altitude', Number(e.target.value))} min={10} max={400} />
                <label style={labelSt}>Speed (m/s)</label>
                <input type="number" style={{ ...inputSt, marginBottom: 8 }} value={selWp.speed}
                  onChange={e => updateWp(selWp.id, 'speed', Number(e.target.value))} min={1} max={30} />
                <label style={labelSt}>Action</label>
                <select style={{ ...inputSt, marginBottom: 8 }} value={selWp.action}
                  onChange={e => updateWp(selWp.id, 'action', e.target.value)}>
                  {WAYPOINT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>
                  {selWp.lat.toFixed(6)}, {selWp.lng.toFixed(6)}
                </div>
              </div>
            )}

            {/* Waypoint list */}
            <div className="card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>📍 Waypoints ({waypoints.length})</span>
                {waypoints.length > 0 && (
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={clearWps}>✕ Clear all</button>
                )}
              </div>
              {waypoints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Click the map to add waypoints
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {waypoints.map((wp, i) => (
                    <div key={wp.id}
                      onClick={() => setSelectedWp(wp.id === selectedWp ? null : wp.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
                        background: selectedWp === wp.id ? 'rgba(255,184,0,0.1)' : 'var(--bg-elevated)',
                        border: `1px solid ${selectedWp === wp.id ? '#ffb800' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                      }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: wpColors[i % wpColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#000', flexShrink: 0 }}>{i+1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{wp.altitude}m · {wp.speed}m/s · {wp.action}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={e => { e.stopPropagation(); moveUp(i); }} style={{ fontSize: 9, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px 4px' }}>▲</button>
                        <button onClick={e => { e.stopPropagation(); moveDown(i); }} style={{ fontSize: 9, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px 4px' }}>▼</button>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeWp(wp.id); }} style={{ fontSize: 11, background: 'none', border: 'none', color: '#ff3b5c', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mission form */}
            <form className="card" onSubmit={handleSubmit}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🚀 Dispatch Mission</div>

              <label style={labelSt}>Mission Name (optional)</label>
              <input style={{ ...inputSt, marginBottom: 10 }} placeholder="e.g. Survey Grid A" value={form.missionName}
                onChange={e => setForm(f => ({ ...f, missionName: e.target.value }))} />

              <label style={labelSt}>Assign Drone</label>
              <select style={{ ...inputSt, marginBottom: 10 }} value={form.droneId} onChange={e => setForm(f => ({ ...f, droneId: e.target.value }))}>
                <option value="">— Select Drone —</option>
                {available.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.status}) · {d.battery}%</option>
                ))}
              </select>
              {available.length === 0 && (
                <div style={{ fontSize: 11, color: '#ffb800', marginBottom: 8 }}>⚠ No idle drones — wait for one to finish</div>
              )}

              <label style={labelSt}>Mission Type</label>
              <select style={{ ...inputSt, marginBottom: 10 }} value={form.missionType} onChange={e => setForm(f => ({ ...f, missionType: e.target.value }))}>
                {MISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={labelSt}>Default Alt (m)</label>
                  <input type="number" style={inputSt} value={form.defaultAltitude}
                    onChange={e => setForm(f => ({ ...f, defaultAltitude: e.target.value }))} min={10} max={500} />
                </div>
                <div>
                  <label style={labelSt}>Default Speed</label>
                  <input type="number" style={inputSt} value={form.defaultSpeed}
                    onChange={e => setForm(f => ({ ...f, defaultSpeed: e.target.value }))} min={1} max={30} />
                </div>
              </div>

              {/* Route summary */}
              {waypoints.length > 1 && (
                <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
                  <div style={{ color: '#00d4ff', fontWeight: 700, marginBottom: 4 }}>📊 Route Summary</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span>🏁 {waypoints.length} WPs</span>
                    <span>📏 {totalDist.toFixed(2)} km</span>
                    {estTime && <span>⏱ ~{estTime} min</span>}
                  </div>
                </div>
              )}

              {error   && <div style={{ fontSize: 12, color: '#ff3b5c', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>{error}</div>}
              {success && <div style={{ fontSize: 12, color: '#00ff88', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>{success}</div>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || waypoints.length < 2}>
                {loading ? '⏳ Dispatching...' : waypoints.length < 2 ? '📍 Add ≥2 waypoints' : '🚀 Dispatch Mission'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
