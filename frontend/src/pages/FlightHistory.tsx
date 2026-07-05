import React, { useEffect, useState } from 'react';
import { realApi } from '../services/realApi';
import { subscribeDrones, Drone, FlightLog } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  info:     { color: '#00d4ff', bg: 'rgba(0,212,255,0.08)',   icon: 'ℹ',  label: 'Info' },
  warning:  { color: '#ffb800', bg: 'rgba(255,184,0,0.08)',   icon: '⚠',  label: 'Warning' },
  critical: { color: '#ff3b5c', bg: 'rgba(255,59,92,0.1)',    icon: '🔴', label: 'Critical' },
  success:  { color: '#00ff88', bg: 'rgba(0,255,136,0.08)',   icon: '✅', label: 'Success' },
  ai:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', icon: '🤖', label: 'AI' },
};

export default function FlightHistory() {
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDrone, setFilterDrone] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchLogs = async () => {
    try {
      const data = await realApi.getFlightLogs();
      setLogs(data);
    } catch {}
    setLoading(false);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const u1 = subscribeDrones(setDrones);
    const u2 = subscribeLiveDrones(live => { if (live.length > 0) setDrones(live); });
    return () => { u1(); u2(); };
  }, []);

  // Filter logic
  const filtered = logs.filter(log => {
    const matchDrone = filterDrone === 'all' || String(log.droneId) === filterDrone;
    const matchType  = filterType === 'all' || log.type === filterType;
    const matchQ     = !searchQ || log.action.toLowerCase().includes(searchQ.toLowerCase());
    return matchDrone && matchType && matchQ;
  });

  // CSV Export
  const exportCSV = () => {
    const header = 'ID,Drone,Type,Action,Timestamp';
    const rows = filtered.map(l =>
      `${l.id},${drones.find(d => d.id === l.droneId)?.name ?? l.droneId},${l.type},"${l.action}",${l.timestamp}`
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `droneos_flight_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Stats
  const counts = Object.fromEntries(
    Object.keys(TYPE_CONFIG).map(k => [k, logs.filter(l => l.type === k).length])
  );

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
    borderRadius: 8, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12,
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
      <span style={{ color: 'var(--text-muted)' }}>Loading flight history...</span>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Flight History</h1>
          <p className="page-subtitle">Complete event log · Updated {lastUpdate.toLocaleTimeString()} · {logs.length} entries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={fetchLogs}>↻ Refresh</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <div key={type}
            onClick={() => setFilterType(filterType === type ? 'all' : type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              background: filterType === type ? cfg.bg : 'var(--bg-card)',
              border: `1px solid ${filterType === type ? cfg.color : 'var(--border-subtle)'}`,
              color: filterType === type ? cfg.color : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
            }}>
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 900, color: cfg.color }}>{counts[type] ?? 0}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {filtered.length} / {logs.length} events shown
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="🔍 Search events..." value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{ ...selectStyle, flex: 1, minWidth: 200 }}
        />
        <select value={filterDrone} onChange={e => setFilterDrone(e.target.value)} style={selectStyle}>
          <option value="all">All Drones</option>
          {drones.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        {(filterDrone !== 'all' || filterType !== 'all' || searchQ) && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setFilterDrone('all'); setFilterType('all'); setSearchQ(''); }}>✕ Clear</button>
        )}
      </div>

      {/* Log table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Type</th>
              <th>Event</th>
              <th style={{ width: 120 }}>Drone</th>
              <th style={{ width: 140 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No events match your filters</td></tr>
            )}
            {filtered.map((log, i) => {
              const cfg = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.info;
              const drone = drones.find(d => d.id === log.droneId);
              return (
                <tr key={log.id ?? i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: cfg.color,
                      background: cfg.bg, borderRadius: 6, padding: '2px 7px',
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{log.action}</td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono' }}>
                      {drone?.name ?? `Drone #${log.droneId}`}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
