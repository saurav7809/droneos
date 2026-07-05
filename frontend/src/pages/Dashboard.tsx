import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeDrones, Drone, AIDecision, getLiveAIDecisions } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';
import { realApi } from '../services/realApi';
import { subscribeApiMode, ApiMode } from '../services/realApi';
import DroneCard, { FleetSummary } from '../components/DroneCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Live drone data (merges mock + WebSocket) ────────────────
function useDrones() {
  const [drones, setDrones] = useState<Drone[]>([]);
  useEffect(() => {
    const unsubMock = subscribeDrones(setDrones);
    const unsubWs = subscribeLiveDrones((liveDrones) => {
      if (liveDrones.length > 0) setDrones(liveDrones);
    });
    return () => { unsubMock(); unsubWs(); };
  }, []);
  return drones;
}

// ─── Battery sparkline chart ─────────────────────────────────
function BatteryChart({ drones }: { drones: Drone[] }) {
  const [history, setHistory] = useState<{ time: string; [k: string]: number | string }[]>([]);
  useEffect(() => {
    if (drones.length === 0) return;
    const point: { time: string; [k: string]: number | string } = {
      time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    drones.slice(0, 3).forEach(d => { point[d.name] = d.battery; });
    setHistory(h => [...h.slice(-20), point]);
  }, [drones]);

  const colors = ['#00d4ff', '#00ff88', '#ffb800'];
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-header">
        <span className="section-title">📊 Battery History (Live)</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 20 readings</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {drones.slice(0, 3).map((d, i) => (
              <linearGradient key={d.id} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors[i]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a6580' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#4a6580' }} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
          {drones.slice(0, 3).map((d, i) => (
            <Area key={d.id} type="monotone" dataKey={d.name} stroke={colors[i]} fill={`url(#grad${i})`} strokeWidth={2} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── AI Decision Feed ─────────────────────────────────────────
function AIDecisionFeed() {
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  useEffect(() => {
    const tick = () => setDecisions([...getLiveAIDecisions()]);
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  const stateIcon: Record<string, string> = {
    TAKEOFF: '🚀', FLY: '✈', AVOID: '⚡', CAPTURE: '📸', RETURN: '↩', LAND: '🛬', HOVER: '⬡',
  };

  return (
    <div className="card" style={{ height: 240, display: 'flex', flexDirection: 'column' }}>
      <div className="section-header">
        <span className="section-title">🤖 AI Decisions</span>
        <span className="live-dot" />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {decisions.slice(0, 8).map((d, i) => (
          <div key={i} className="ai-log-entry">
            <span className="ai-log-time">{new Date(d.timestamp).toLocaleTimeString()}</span>
            <span className="ai-log-action">{stateIcon[d.state] ?? '●'} {d.state}</span>
            <span className="ai-log-desc">{d.reason}</span>
          </div>
        ))}
        {decisions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No AI decisions yet.</p>}
      </div>
    </div>
  );
}

// ─── Drone Command Panel (real backend commands) ───────────────
function DroneCommandPanel({ drones, apiMode }: { drones: Drone[]; apiMode: ApiMode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const activeDrones = drones.filter(d => ['Flying', 'Mission', 'Idle', 'Returning', 'Charging'].includes(d.status));

  const sendCommand = async (cmd: string) => {
    if (!selectedId) return;
    setLoading(true);
    setFeedback('');
    try {
      if (apiMode === 'real') {
        const token = localStorage.getItem('drone_user')
          ? JSON.parse(localStorage.getItem('drone_user')!).token : '';
        const res = await fetch(`http://localhost:8080/api/drones/${selectedId}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ command: cmd }),
        });
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { message: text || 'Command sent' }; }
        setFeedback(data.message || data.error || `${cmd} executed successfully`);
      } else {
        // Mock feedback
        const drone = drones.find(d => d.id === selectedId);
        setFeedback(`[MOCK] ${cmd} sent to ${drone?.name ?? 'Drone'}`);
      }
    } catch (e: any) {
      setFeedback('Error: ' + e.message);
    }
    setLoading(false);
    setTimeout(() => setFeedback(''), 4000);
  };

  const selectedDrone = drones.find(d => d.id === selectedId);
  const cmdColors: Record<string, string> = {
    RTH: '#ffb800', LAND: '#00ff88', HOVER: '#00d4ff', TAKEOFF: '#a78bfa', ABORT: '#ff3b5c',
  };

  const commandsForStatus: Record<string, string[]> = {
    Flying:    ['RTH', 'LAND', 'HOVER', 'ABORT'],
    Mission:   ['RTH', 'LAND', 'HOVER', 'ABORT'],
    Returning: ['LAND', 'ABORT'],
    Idle:      ['TAKEOFF'],
    Charging:  ['TAKEOFF'],
  };
  const availableCommands = selectedDrone ? (commandsForStatus[selectedDrone.status] ?? []) : [];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-header">
        <span className="section-title">🎮 Drone Command Center</span>
        {apiMode === 'real'
          ? <span className="badge badge-success">Live Backend</span>
          : <span className="badge" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Mock Mode</span>}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Drone selector */}
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(Number(e.target.value) || null)}
          style={{
            background: 'var(--bg-card-hover)', border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 8,
            fontSize: 13, minWidth: 150,
          }}
        >
          <option value="">Select Drone</option>
          {activeDrones.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
          ))}
        </select>

        {/* Command buttons */}
        {availableCommands.map(cmd => (
          <button
            key={cmd}
            id={`cmd-${cmd.toLowerCase()}`}
            className="btn"
            disabled={loading || !selectedId}
            onClick={() => sendCommand(cmd)}
            style={{
              background: `${cmdColors[cmd]}22`,
              border: `1px solid ${cmdColors[cmd]}66`,
              color: cmdColors[cmd],
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '…' : cmd}
          </button>
        ))}

        {selectedDrone && availableCommands.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            No commands available for status: {selectedDrone.status}
          </span>
        )}
      </div>

      {feedback && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: feedback.toLowerCase().includes('error') ? 'rgba(255,59,92,0.1)' : 'rgba(0,255,136,0.1)',
          border: `1px solid ${feedback.toLowerCase().includes('error') ? '#ff3b5c33' : '#00ff8833'}`,
          color: feedback.toLowerCase().includes('error') ? '#ff3b5c' : '#00ff88',
          fontSize: 12,
        }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function Dashboard() {
  const drones = useDrones();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('All');
  const [apiMode, setApiMode] = useState<ApiMode>('checking');

  useEffect(() => { const unsub = subscribeApiMode(setApiMode); return () => { unsub(); }; }, []);

  const statusFilters = ['All', 'Flying', 'Mission', 'Idle', 'Charging', 'Returning', 'Error'];
  const filtered = filter === 'All' ? drones : drones.filter(d => d.status === filter);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⬡ Fleet Dashboard</h1>
          <p className="page-subtitle">{drones.length} drones registered · Real-time telemetry</p>
        </div>
        <FleetSummary />
      </div>

      {/* Battery Chart + AI Feed */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <BatteryChart drones={drones} />
        <AIDecisionFeed />
      </div>

      {/* Command Center */}
      <DroneCommandPanel drones={drones} apiMode={apiMode} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {statusFilters.map(f => (
          <button
            key={f}
            id={`filter-${f.toLowerCase()}`}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{filtered.length} drones</span>
      </div>

      {/* Drone Cards Grid */}
      <div className="grid-auto">
        {filtered.map(drone => (
          <DroneCard key={drone.id} drone={drone} onClick={() => navigate(`/drone/${drone.id}`)} />
        ))}
      </div>
    </div>
  );
}
