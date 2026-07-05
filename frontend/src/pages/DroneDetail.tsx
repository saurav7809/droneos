import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { subscribeDrones, Drone, FlightLog } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';
import { realApi } from '../services/realApi';
import { subscribeApiMode, ApiMode } from '../services/realApi';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLOR: Record<string, string> = {
  Flying: '#00ff88', Mission: '#00d4ff', Idle: '#4a6580',
  Charging: '#ffb800', Returning: '#a78bfa', Error: '#ff3b5c',
};

interface TelemetryPoint {
  time: string;
  battery: number;
  speed: number;
  altitude: number;
}

export default function DroneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const droneId = Number(id);

  const [drone, setDrone] = useState<Drone | undefined>();
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [apiMode, setApiMode] = useState<ApiMode>('checking');
  const [cmdFeedback, setCmdFeedback] = useState('');
  const [cmdLoading, setCmdLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const trailRef = useRef<[number, number][]>([]);

  // Subscribe to drone updates
  useEffect(() => {
    const update = (drones: Drone[]) => {
      const d = drones.find(d => d.id === droneId);
      if (d) {
        setDrone(d);
        // Record trail
        const pos: [number, number] = [d.latitude, d.longitude];
        const last = trailRef.current[trailRef.current.length - 1];
        if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
          trailRef.current = [...trailRef.current.slice(-80), pos];
        }
        // Record telemetry
        setTelemetry(prev => [...prev.slice(-60), {
          time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          battery: d.battery,
          speed: Math.round(d.speed * 10) / 10,
          altitude: Math.round(d.altitude),
        }]);
      }
    };
    const u1 = subscribeDrones(update);
    const u2 = subscribeLiveDrones(update);
    return () => { u1(); u2(); };
  }, [droneId]);

  // Load flight logs
  useEffect(() => {
    realApi.getFlightLogs(droneId).then(setLogs).catch(() => {});
    const id = setInterval(() => realApi.getFlightLogs(droneId).then(setLogs).catch(() => {}), 5000);
    return () => clearInterval(id);
  }, [droneId]);

  useEffect(() => { const unsub = subscribeApiMode(setApiMode); return () => { unsub(); }; }, []);

  const sendCmd = async (cmd: string) => {
    setCmdLoading(true); setCmdFeedback('');
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
        try { data = JSON.parse(text); } catch { data = { message: text }; }
        setCmdFeedback(data.message || data.error || `${cmd} sent`);
      } else {
        setCmdFeedback(`[Simulation] ${cmd} sent to ${drone?.name}`);
      }
    } catch (e: any) {
      setCmdFeedback('Error: ' + e.message);
    }
    setCmdLoading(false);
    setTimeout(() => setCmdFeedback(''), 5000);
  };

  const COMMANDS: { cmd: string; label: string; color: string; status: string[] }[] = [
    { cmd: 'TAKEOFF', label: '🚀 Takeoff',     color: '#a78bfa', status: ['Idle', 'Charging'] },
    { cmd: 'HOVER',   label: '⬡ Hover',         color: '#00d4ff', status: ['Flying', 'Mission'] },
    { cmd: 'RTH',     label: '🏠 Return Home',   color: '#ffb800', status: ['Flying', 'Mission'] },
    { cmd: 'LAND',    label: '🛬 Land Now',      color: '#00ff88', status: ['Flying', 'Mission', 'Returning'] },
    { cmd: 'ABORT',   label: '⚠ Abort Mission', color: '#ff3b5c', status: ['Flying', 'Mission', 'Returning'] },
  ];

  if (!drone) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
      <span style={{ color: 'var(--text-muted)' }}>Loading drone {id}...</span>
    </div>
  );

  const statusColor = STATUS_COLOR[drone.status] ?? '#4a6580';
  const droneIcon = L.divIcon({
    className: '', iconSize: [40, 40], iconAnchor: [20, 20],
    html: `<div style="position:relative;width:40px;height:40px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${statusColor};opacity:0.2;animation:ping 1.5s infinite;"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:rgba(6,13,24,0.95);border:2.5px solid ${statusColor};display:flex;align-items:center;justify-content:center;font-size:16px;">🛸</div>
    </div><style>@keyframes ping{0%,100%{transform:scale(1);opacity:0.2}50%{transform:scale(1.8);opacity:0}}</style>`,
  });

  const logTypeConfig: Record<string, { color: string; icon: string }> = {
    info:     { color: '#00d4ff', icon: 'ℹ' },
    warning:  { color: '#ffb800', icon: '⚠' },
    critical: { color: '#ff3b5c', icon: '🔴' },
    success:  { color: '#00ff88', icon: '✅' },
    ai:       { color: '#a78bfa', icon: '🤖' },
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ fontSize: 18 }}>←</button>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              🛸 {drone.name}
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 8px ${statusColor}` }} />
            </h1>
            <p className="page-subtitle">Live telemetry · ID #{droneId} · Updated {new Date(drone.lastUpdated).toLocaleTimeString()}</p>
          </div>
        </div>
        <span style={{ fontSize: 22, fontWeight: 900, color: statusColor, fontFamily: 'JetBrains Mono' }}>{drone.status}</span>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Battery',   val: `${drone.battery}%`,     color: drone.battery > 50 ? '#00ff88' : drone.battery > 20 ? '#ffb800' : '#ff3b5c', icon: '🔋' },
          { label: 'Speed',     val: `${drone.speed.toFixed(1)} m/s`, color: '#00d4ff', icon: '→' },
          { label: 'Altitude',  val: `${drone.altitude.toFixed(0)} m`, color: '#a78bfa', icon: '↑' },
          { label: 'Latitude',  val: `${drone.latitude.toFixed(5)}°`, color: 'var(--text-primary)', icon: '📍' },
          { label: 'Longitude', val: `${drone.longitude.toFixed(5)}°`, color: 'var(--text-primary)', icon: '📍' },
          { label: 'Mission',   val: drone.mission ?? 'None', color: drone.mission ? '#00d4ff' : '#4a6580', icon: '📡' },
        ].map(({ label, val, color, icon }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 800, color, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Battery bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Battery Level</span><span style={{ color: drone.battery > 50 ? '#00ff88' : drone.battery > 20 ? '#ffb800' : '#ff3b5c', fontWeight: 700 }}>{drone.battery}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 1s ease',
            width: `${drone.battery}%`,
            background: drone.battery > 50 ? 'linear-gradient(90deg,#00d4ff,#00ff88)' : drone.battery > 20 ? '#ffb800' : 'linear-gradient(90deg,#ff3b5c,#ff6b00)',
            boxShadow: drone.battery <= 20 ? '0 0 8px #ff3b5c' : undefined,
          }} />
        </div>
        {drone.battery <= 20 && <div style={{ fontSize: 11, color: '#ff3b5c', marginTop: 4 }}>⚠ Low battery — Return to Home recommended</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Live Map mini */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 280 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 700 }}>📍 Live Position</div>
          <MapContainer center={[drone.latitude, drone.longitude]} zoom={14} style={{ height: 250 }} key={`${drone.latitude.toFixed(3)}_${drone.longitude.toFixed(3)}`}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
            {trailRef.current.length > 1 && (
              <Polyline positions={trailRef.current} color={statusColor} weight={2} opacity={0.6} dashArray="4 4" />
            )}
            <Circle center={[28.6100, 77.2050]} radius={30} color="#7c3aed" fillColor="#7c3aed" fillOpacity={0.2} />
            <Marker position={[drone.latitude, drone.longitude]} icon={droneIcon} />
          </MapContainer>
        </div>

        {/* Command Center */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>🎮 Command Center</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COMMANDS.map(({ cmd, label, color, status }) => {
              const available = status.includes(drone.status);
              return (
                <button key={cmd} id={`detail-cmd-${cmd.toLowerCase()}`}
                  disabled={!available || cmdLoading}
                  onClick={() => sendCmd(cmd)}
                  style={{
                    padding: '12px 8px', borderRadius: 10, border: `1px solid ${color}${available ? '88' : '22'}`,
                    background: available ? `${color}15` : 'transparent',
                    color: available ? color : '#4a6580',
                    fontWeight: 700, fontSize: 13, cursor: available ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}>
                  {cmdLoading ? '…' : label}
                </button>
              );
            })}
          </div>
          {cmdFeedback && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: cmdFeedback.toLowerCase().includes('error') ? 'rgba(255,59,92,0.1)' : 'rgba(0,255,136,0.1)',
              border: `1px solid ${cmdFeedback.toLowerCase().includes('error') ? '#ff3b5c33' : '#00ff8833'}`,
              color: cmdFeedback.toLowerCase().includes('error') ? '#ff3b5c' : '#00ff88',
            }}>{cmdFeedback}</div>
          )}

          {/* Status info */}
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>AVAILABLE IN THIS STATE</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {COMMANDS.filter(c => c.status.includes(drone.status)).map(c => c.label).join(' · ') || 'No commands available'}
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { key: 'battery',  label: '🔋 Battery %',    color: '#00ff88', domain: [0, 100] as [number, number], ref: 20 },
          { key: 'speed',    label: '→ Speed (m/s)',    color: '#00d4ff', domain: [0, 25] as [number, number] },
          { key: 'altitude', label: '↑ Altitude (m)',  color: '#a78bfa', domain: [0, 250] as [number, number] },
        ].map(({ key, label, color, domain, ref }) => (
          <div key={key} className="card">
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>{label}</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={telemetry} margin={{ top: 4, right: 4, bottom: 0, left: -32 }}>
                <XAxis dataKey="time" hide />
                <YAxis domain={domain} tick={{ fontSize: 9, fill: '#4a6580' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 6, fontSize: 11 }} />
                {ref && <ReferenceLine y={ref} stroke="#ff3b5c" strokeDasharray="3 3" />}
                <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Flight Log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>📋 Flight Log</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{logs.length} entries · Live</span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No log entries yet</div>}
          {logs.map((log, i) => {
            const cfg = logTypeConfig[log.type] ?? logTypeConfig.info;
            return (
              <div key={log.id ?? i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px',
                borderRadius: 6, background: i % 2 === 0 ? 'var(--bg-elevated)' : 'transparent',
                borderLeft: `2px solid ${cfg.color}`,
              }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{cfg.icon}</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{log.action}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
