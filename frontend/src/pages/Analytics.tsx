import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { subscribeApiMode } from '../services/realApi';
import { subscribeDrones, Drone } from '../services/mockApi';
import { subscribeLiveDrones } from '../services/websocket';

// ─── Types ────────────────────────────────────────────────────
interface FleetAnalytics {
  totalDrones: number;
  activeDrones: number;
  avgBatteryPct: number;
  lowBatteryCount: number;
  statusBreakdown: Record<string, number>;
  totalMissions: number;
  missionStatusBreakdown: Record<string, number>;
  missionTypeBreakdown: Record<string, number>;
  totalDistanceKm: number;
  avgMissionDistanceKm: number;
  fleetHealthScore: number;
  logCount: number;
}

// ─── Colors ───────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Flying: '#00ff88', Mission: '#00d4ff', Idle: '#4a6580',
  Charging: '#ffb800', Returning: '#a78bfa', Error: '#ff3b5c',
};
const PIE_COLORS = ['#00d4ff', '#00ff88', '#ffb800', '#a78bfa', '#f472b6', '#fb923c'];

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      {icon && <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono', color: color ?? 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Health Ring ──────────────────────────────────────────────
function HealthRing({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score > 75 ? '#00ff88' : score > 50 ? '#ffb800' : '#ff3b5c';
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fleet Health Score</div>
      <svg viewBox="0 0 130 130" width={130} height={130} style={{ display: 'block', margin: '0 auto' }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={12} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={65} y={70} textAnchor="middle" fill={color} fontSize={26} fontWeight={900} fontFamily="JetBrains Mono">{score}</text>
        <text x={65} y={86} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>/ 100</text>
      </svg>
      <div style={{ fontSize: 12, color, marginTop: 8, fontWeight: 700 }}>
        {score > 75 ? '✓ Excellent' : score > 50 ? '⚠ Good' : '⚠ Needs Attention'}
      </div>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────
export default function Analytics() {
  const [analytics, setAnalytics] = useState<FleetAnalytics | null>(null);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Drone data (mock or WebSocket)
  useEffect(() => {
    const u1 = subscribeDrones(setDrones);
    const u2 = subscribeLiveDrones(live => { if (live.length > 0) setDrones(live); });
    return () => { u1(); u2(); };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('drone_user')
        ? JSON.parse(localStorage.getItem('drone_user')!).token : '';
      const res = await axios.get('http://localhost:8080/api/analytics/fleet', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000,
      });
      setAnalytics(res.data);
      setError(null);
    } catch {
      // Build mock analytics from live drone data
      setError('Using simulation data (start backend for live analytics)');
    }
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(id);
  }, []);

  // Build analytics from drone data if backend unavailable
  const effectiveAnalytics: FleetAnalytics = analytics ?? (() => {
    const statusBreakdown: Record<string, number> = {};
    drones.forEach(d => { statusBreakdown[d.status] = (statusBreakdown[d.status] ?? 0) + 1; });
    const avgBatt = drones.length ? Math.round(drones.reduce((s, d) => s + d.battery, 0) / drones.length) : 0;
    return {
      totalDrones: drones.length,
      activeDrones: drones.filter(d => d.status === 'Flying' || d.status === 'Mission').length,
      avgBatteryPct: avgBatt,
      lowBatteryCount: drones.filter(d => d.battery < 20).length,
      statusBreakdown,
      totalMissions: 4,
      missionStatusBreakdown: { Active: 2, Completed: 2 },
      missionTypeBreakdown: { Mapping: 1, 'Crop Monitoring': 1, Surveillance: 1, Delivery: 1 },
      totalDistanceKm: 18.5,
      avgMissionDistanceKm: 9.2,
      fleetHealthScore: Math.round(avgBatt * 0.4 + 60),
      logCount: 6,
    };
  })();

  const a = effectiveAnalytics;

  const statusPieData = Object.entries(a.statusBreakdown).map(([name, value]) => ({ name, value }));
  const missionPieData = Object.entries(a.missionStatusBreakdown).map(([name, value]) => ({ name, value }));
  const missionTypeData = Object.entries(a.missionTypeBreakdown).map(([name, value]) => ({ name, value }));

  const batteryData = drones.map(d => ({
    name: d.name.replace('Drone-', 'D-'),
    battery: d.battery,
    fill: d.battery > 60 ? '#00ff88' : d.battery > 20 ? '#ffb800' : '#ff3b5c',
  }));

  const radarData = [
    { metric: 'Battery',     value: a.avgBatteryPct },
    { metric: 'Active Rate', value: a.totalDrones ? Math.round(a.activeDrones / a.totalDrones * 100) : 0 },
    { metric: 'Health',      value: a.fleetHealthScore },
    { metric: 'Missions',    value: Math.min(100, a.totalMissions * 10) },
    { metric: 'Distance',    value: Math.min(100, a.totalDistanceKm * 3) },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner" style={{ width: 40, height: 40 }} />
      <span style={{ color: 'var(--text-muted)' }}>Loading analytics...</span>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Analytics</h1>
          <p className="page-subtitle">
            Fleet intelligence · Updated {lastUpdate.toLocaleTimeString()}
            {error && <span style={{ color: '#00d4ff', marginLeft: 8, fontSize: 11 }}>· 🔵 {error}</span>}
          </p>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={fetchAnalytics}>↻ Refresh</button>
      </div>

      {/* KPI Row */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total Drones"      value={a.totalDrones}              icon="⬡"  color="var(--accent-cyan)" />
        <StatCard label="Active Now"        value={a.activeDrones}             icon="✈"  color="#00ff88" sub={`${a.totalDrones ? Math.round(a.activeDrones / a.totalDrones * 100) : 0}% utilization`} />
        <StatCard label="Avg Battery"       value={`${a.avgBatteryPct}%`}      icon="🔋" color={a.avgBatteryPct > 50 ? '#00ff88' : '#ffb800'} sub={`${a.lowBatteryCount} drones critical`} />
        <StatCard label="Total Missions"    value={a.totalMissions}            icon="📡" color="var(--accent-purple)" sub={`${a.totalDistanceKm} km flown`} />
      </div>

      {/* Health + Radar + Status Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <HealthRing score={a.fleetHealthScore} />

        {/* Radar Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>Fleet Performance Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Radar name="Score" dataKey="value" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>Fleet Status</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusPieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                {statusPieData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Battery Bar Chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>🔋 Battery Levels (Live)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={batteryData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${v}%`, 'Battery']}
            />
            {/* Danger threshold line */}
            <Bar dataKey="battery" radius={[4, 4, 0, 0]}>
              {batteryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mission Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>Mission Status</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={missionPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                {missionPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>Mission Types</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={missionTypeData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={90} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#00d4ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Table */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>📋 Fleet Summary</div>
        <table className="data-table">
          <tbody>
            {[
              ['Total Drones',           a.totalDrones],
              ['Active / Airborne',      `${a.activeDrones} / ${a.totalDrones}`],
              ['Average Battery',        `${a.avgBatteryPct}%`],
              ['Low Battery Drones',     a.lowBatteryCount],
              ['Fleet Health Score',     `${a.fleetHealthScore} / 100`],
              ['Total Missions',         a.totalMissions],
              ['Total Distance Flown',   `${a.totalDistanceKm} km`],
              ['Avg Mission Distance',   `${a.avgMissionDistanceKm} km`],
              ['Flight Log Entries',     a.logCount],
            ].map(([k, v]) => (
              <tr key={String(k)}>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{k}</td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
