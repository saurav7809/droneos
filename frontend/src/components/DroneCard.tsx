import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeDrones, Drone } from '../services/mockApi';

interface DroneCardProps { drone: Drone; onClick?: () => void; }

function getBatteryColor(pct: number) {
  if (pct > 60) return 'var(--accent-green)';
  if (pct > 30) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Flying: '#00ff88', Mission: '#00d4ff', Idle: '#4a6580',
    Charging: '#ffb800', Error: '#ff3b5c', Returning: '#a78bfa',
  };
  return map[status] ?? '#4a6580';
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    'Flying': 'badge-flying', 'Mission': 'badge-mission', 'Idle': 'badge-idle',
    'Charging': 'badge-charging', 'Error': 'badge-error', 'Returning': 'badge-returning',
  };
  return map[status] ?? 'badge-idle';
}

export default function DroneCard({ drone, onClick }: DroneCardProps) {
  const [prevBattery, setPrevBattery] = useState(drone.battery);
  const [flash, setFlash] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (drone.battery !== prevBattery) {
      setFlash(true);
      setPrevBattery(drone.battery);
      setTimeout(() => setFlash(false), 400);
    }
  }, [drone.battery]);

  const battColor   = getBatteryColor(drone.battery);
  const statusColor = getStatusColor(drone.status);

  return (
    <div
      className="card"
      id={`drone-card-${drone.id}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderColor: flash ? 'rgba(0,212,255,0.4)' : undefined,
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      {/* Accent glow line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${battColor}, transparent)`, opacity: 0.6 }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🛸</span>
            {drone.name}
          </div>
          {drone.mission && (
            <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 2, fontWeight: 600 }}>📡 {drone.mission}</div>
          )}
        </div>
        <span className={`badge ${getStatusClass(drone.status)}`}>{drone.status}</span>
      </div>

      {/* Battery */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span className="stat-label">Battery</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: battColor }}>{drone.battery}%</span>
        </div>
        <div className="battery-bar">
          <div className="battery-fill" style={{ width: `${drone.battery}%`, background: `linear-gradient(90deg, ${battColor}88, ${battColor})` }} />
        </div>
        {drone.battery < 20 && (
          <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, fontWeight: 600 }}>⚠ LOW BATTERY — RTH Initiated</div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="metric-card">
          <span className="stat-label">Speed</span>
          <span className="stat-value" style={{ fontSize: 16 }}>
            {typeof drone.speed === 'number' ? drone.speed.toFixed(1) : drone.speed}
            <span className="stat-unit"> m/s</span>
          </span>
        </div>
        <div className="metric-card">
          <span className="stat-label">Altitude</span>
          <span className="stat-value" style={{ fontSize: 16 }}>
            {typeof drone.altitude === 'number' ? drone.altitude.toFixed(0) : drone.altitude}
            <span className="stat-unit"> m</span>
          </span>
        </div>
        <div className="metric-card" style={{ gridColumn: '1 / -1' }}>
          <span className="stat-label">GPS</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--accent-cyan)' }}>
            {drone.latitude.toFixed(5)}°N, {drone.longitude.toFixed(5)}°E
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Updated {new Date(drone.lastUpdated).toLocaleTimeString()}</span>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/drone/${drone.id}`); }}
          style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)',
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          View Details →
        </button>
      </div>
    </div>
  );
}

// ─── Fleet Summary Bar ────────────────────────────────────────
export function FleetSummary() {
  const [drones, setDrones] = useState<Drone[]>([]);
  useEffect(() => subscribeDrones(setDrones), []);

  const flying    = drones.filter(d => d.status === 'Flying' || d.status === 'Mission').length;
  const charging  = drones.filter(d => d.status === 'Charging').length;
  const returning = drones.filter(d => d.status === 'Returning').length;
  const errors    = drones.filter(d => d.status === 'Error').length;
  const avgBat    = drones.length ? Math.round(drones.reduce((a, d) => a + d.battery, 0) / drones.length) : 0;

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Airborne',    value: flying,    color: '#00ff88', icon: '🛸' },
        { label: 'Charging',    value: charging,  color: '#ffb800', icon: '⚡' },
        { label: 'Returning',   value: returning, color: '#a78bfa', icon: '↩' },
        { label: 'Errors',      value: errors,    color: '#ff3b5c', icon: '⚠' },
        { label: 'Avg Battery', value: `${avgBat}%`, color: '#00d4ff', icon: '🔋' },
      ].map(item => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px',
          background: item.label === 'Errors' && (item.value as number) > 0 ? 'rgba(255,59,92,0.08)' : 'var(--bg-card)',
          border: `1px solid ${item.label === 'Errors' && (item.value as number) > 0 ? '#ff3b5c44' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          <span>{item.icon}</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono', color: item.color }}>{item.value}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
