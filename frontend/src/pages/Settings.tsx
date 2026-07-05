import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addToast } from '../components/NotificationCenter';

interface ThresholdSetting { label: string; key: string; value: number; unit: string; min: number; max: number; step: number; danger: string }

const DEFAULT_THRESHOLDS: ThresholdSetting[] = [
  { label: 'Low Battery Warning',  key: 'battWarn',    value: 30,  unit: '%',    min: 5,   max: 50, step: 5,  danger: 'Triggers RTH recommendation' },
  { label: 'Critical Battery RTH', key: 'battCrit',    value: 20,  unit: '%',    min: 5,   max: 30, step: 5,  danger: 'Auto-initiates Return to Home' },
  { label: 'Max Wind Speed',       key: 'windLimit',   value: 40,  unit: 'km/h', min: 10,  max: 80, step: 5,  danger: 'Mission suspend threshold' },
  { label: 'Min Visibility',       key: 'visLimit',    value: 1.0, unit: 'km',   min: 0.5, max: 5,  step: 0.5,danger: 'Below this blocks takeoff' },
  { label: 'Max Altitude',         key: 'altLimit',    value: 120, unit: 'm',    min: 50,  max: 400,step: 10, danger: 'Legal ceiling' },
  { label: 'Speed Limit',          key: 'speedLimit',  value: 20,  unit: 'm/s',  min: 5,   max: 40, step: 1,  danger: 'Max mission speed' },
];

const SOUND_OPTIONS = ['Beep', 'Chime', 'Alert', 'Silent'];
const MAP_TILE_OPTIONS = ['Dark (CartoDB)', 'Satellite', 'Light', 'Street'];
const REFRESH_OPTIONS = [2, 5, 10, 30];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.3s',
      background: value ? 'var(--accent-green)' : 'var(--bg-elevated)',
      border: '2px solid ' + (value ? 'var(--accent-green)' : 'var(--border-medium)'),
      position: 'relative',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: value ? 22 : 2,
        transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }} />
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [soundAlert, setSoundAlert] = useState('Beep');
  const [mapTile, setMapTile] = useState('Dark (CartoDB)');
  const [refreshRate, setRefreshRate] = useState(2);
  const [notifications, setNotifications] = useState({ email: false, sound: true, desktop: true, critical: true, warning: true, success: false, info: false });
  const [apiSettings, setApiSettings] = useState({ backendUrl: 'http://localhost:8080', aiUrl: 'http://localhost:5000', wsUrl: 'ws://localhost:8080/ws' });
  const [saved, setSaved] = useState(false);

  const handleThresholdChange = (key: string, val: number) => {
    setThresholds(ts => ts.map(t => t.key === key ? { ...t, value: val } : t));
  };

  const handleSave = () => {
    setSaved(true);
    addToast({ droneId: 0, droneName: 'System', level: 'SUCCESS', message: '✅ Settings saved successfully', type: 'success' });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestAlert = () => {
    addToast({ droneId: 1, droneName: 'Drone-01', level: 'WARNING', message: '⚠ Test alert — notification system working correctly', type: 'warning' });
    addToast({ droneId: 2, droneName: 'Drone-02', level: 'CRITICAL', message: '🔴 Test critical alert — battery simulation event', type: 'critical' });
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', borderRadius: 8,
    color: 'var(--text-primary)', padding: '6px 10px', fontSize: 13, cursor: 'pointer',
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙ Settings</h1>
          <p className="page-subtitle">System configuration · Flight limits · Notifications</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={handleTestAlert}>🔔 Test Alert</button>
          <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={handleSave}>
            {saved ? '✓ Saved!' : '💾 Save Settings'}
          </button>
        </div>
      </div>

      {/* User Profile */}
      <Section title="👤 User Profile">
        <Row label="Username" sub="Your account username">
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--accent-cyan)', fontWeight: 700 }}>@{user?.username}</div>
        </Row>
        <Row label="Role" sub="Access level">
          <span style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent-cyan)', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>OPERATOR</span>
        </Row>
        <Row label="Session Token" sub="JWT authentication">
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)' }}>••••••••••••••••</span>
        </Row>
      </Section>

      {/* Flight Safety Thresholds */}
      <Section title="🛸 Flight Safety Thresholds">
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
          Configure automatic safety responses. Changes take effect on next mission.
        </div>
        {thresholds.map(t => (
          <div key={t.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>⚠ {t.danger}</div>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)', minWidth: 80, textAlign: 'right' }}>
                {t.value} {t.unit}
              </div>
            </div>
            <input
              type="range" min={t.min} max={t.max} step={t.step} value={t.value}
              onChange={e => handleThresholdChange(t.key, Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              <span>{t.min} {t.unit}</span><span>{t.max} {t.unit}</span>
            </div>
          </div>
        ))}
      </Section>

      {/* Notifications */}
      <Section title="🔔 Notification Preferences">
        <Row label="Sound Alerts" sub="Audio beep for events">
          <Toggle value={notifications.sound} onChange={v => setNotifications(n => ({ ...n, sound: v }))} />
        </Row>
        <Row label="Desktop Notifications" sub="Browser push notifications">
          <Toggle value={notifications.desktop} onChange={v => setNotifications(n => ({ ...n, desktop: v }))} />
        </Row>
        <Row label="Critical Alerts" sub="Battery low, obstacle, error">
          <Toggle value={notifications.critical} onChange={v => setNotifications(n => ({ ...n, critical: v }))} />
        </Row>
        <Row label="Warning Alerts" sub="Wind, visibility, limits">
          <Toggle value={notifications.warning} onChange={v => setNotifications(n => ({ ...n, warning: v }))} />
        </Row>
        <Row label="Success Events" sub="Landed, charged, mission complete">
          <Toggle value={notifications.success} onChange={v => setNotifications(n => ({ ...n, success: v }))} />
        </Row>
        <Row label="Info Events" sub="Waypoint reached, status change">
          <Toggle value={notifications.info} onChange={v => setNotifications(n => ({ ...n, info: v }))} />
        </Row>
        <Row label="Sound Style" sub="Alert sound preference">
          <select value={soundAlert} onChange={e => setSoundAlert(e.target.value)} style={selectStyle}>
            {SOUND_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </Row>
      </Section>

      {/* Map & Display */}
      <Section title="🗺 Map & Display">
        <Row label="Map Style" sub="Background tile layer">
          <select value={mapTile} onChange={e => setMapTile(e.target.value)} style={selectStyle}>
            {MAP_TILE_OPTIONS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="Telemetry Refresh Rate" sub="WebSocket update frequency">
          <select value={refreshRate} onChange={e => setRefreshRate(Number(e.target.value))} style={selectStyle}>
            {REFRESH_OPTIONS.map(r => <option key={r} value={r}>{r}s</option>)}
          </select>
        </Row>
        <Row label="Show Flight Trails" sub="GPS path history on map">
          <Toggle value={true} onChange={() => {}} />
        </Row>
        <Row label="Show No-Fly Zones" sub="Restricted airspace overlay">
          <Toggle value={true} onChange={() => {}} />
        </Row>
        <Row label="Show Waypoints" sub="Mission waypoint markers">
          <Toggle value={false} onChange={() => {}} />
        </Row>
      </Section>

      {/* API Configuration */}
      <Section title="🔌 API Configuration">
        {[
          { key: 'backendUrl', label: 'Spring Boot Backend URL', placeholder: 'http://localhost:8080' },
          { key: 'aiUrl',      label: 'Python AI Service URL',    placeholder: 'http://localhost:5000' },
          { key: 'wsUrl',      label: 'WebSocket URL',            placeholder: 'ws://localhost:8080/ws' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
            <input
              value={apiSettings[key as keyof typeof apiSettings]}
              onChange={e => setApiSettings(s => ({ ...s, [key]: e.target.value }))}
              placeholder={placeholder}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13,
                fontFamily: 'JetBrains Mono', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {/* Connection test buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {['Backend', 'AI Service', 'WebSocket'].map(svc => (
            <button key={svc} className="btn btn-ghost" style={{ fontSize: 12, flex: 1 }}
              onClick={() => addToast({ droneId: 0, droneName: 'System', level: 'INFO', message: `Testing ${svc} connection...`, type: 'info' })}>
              🔗 Test {svc}
            </button>
          ))}
        </div>
      </Section>

      {/* System Info */}
      <Section title="ℹ System Information">
        {[
          ['Platform', 'DroneOS Fleet Command v2.0'],
          ['Frontend', 'React 18 + Vite 6 + TypeScript'],
          ['Backend', 'Spring Boot 3.2 + WebSocket + H2/PostgreSQL'],
          ['AI Service', 'Python Flask + OpenCV + Physics Simulator'],
          ['Map Engine', 'Leaflet 1.9 + CartoDB Dark Tiles'],
          ['Charts', 'Recharts 2.x'],
        ].map(([k, v]) => (
          <Row key={k} label={k}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-muted)' }}>{v}</span>
          </Row>
        ))}
      </Section>
    </div>
  );
}
