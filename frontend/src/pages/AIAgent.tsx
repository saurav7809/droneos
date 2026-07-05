import React, { useEffect, useState } from 'react';
import { realApi as api } from '../services/realApi';
import { AIDecision, Drone, subscribeDrones, getLiveAIDecisions } from '../services/mockApi';

const STATE_FLOW = ['IDLE', 'TAKEOFF', 'FLY', 'AVOID', 'CAPTURE', 'RETURN', 'LAND'];

const STATE_META: Record<string, { icon: string; color: string; desc: string }> = {
  IDLE:    { icon: '⬡', color: 'var(--text-muted)', desc: 'Drone standing by' },
  TAKEOFF: { icon: '🚀', color: 'var(--accent-cyan)', desc: 'Ascending to mission altitude' },
  FLY:     { icon: '✈', color: 'var(--accent-green)', desc: 'Navigating to waypoint' },
  AVOID:   { icon: '⚡', color: 'var(--accent-amber)', desc: 'Obstacle detected — rerouting' },
  CAPTURE: { icon: '📸', color: 'var(--accent-blue)', desc: 'Taking imagery at waypoint' },
  RETURN:  { icon: '↩', color: 'var(--accent-purple)', desc: 'Returning to base' },
  LAND:    { icon: '🛬', color: 'var(--accent-green)', desc: 'Final approach and landing' },
  HOVER:   { icon: '⬡', color: 'var(--accent-cyan)', desc: 'Hovering in place' },
  MOVE_FORWARD: { icon: '➡', color: 'var(--accent-green)', desc: 'Moving forward' },
  INCREASE_ALTITUDE: { icon: '⬆', color: 'var(--accent-amber)', desc: 'Climbing to clear obstacle' },
  RETURN_HOME: { icon: '🏠', color: 'var(--accent-red)', desc: 'RTH — low battery' },
  TAKE_PHOTO: { icon: '📷', color: '#3b82f6', desc: 'Capturing image' },
};

function StateMachineViz({ currentState }: { currentState: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '16px 0' }}>
      {STATE_FLOW.map((state, i) => {
        const meta = STATE_META[state] ?? { icon: '●', color: 'var(--text-muted)', desc: '' };
        const isActive = state === currentState || (currentState === 'MOVE_FORWARD' && state === 'FLY');
        const isPast = STATE_FLOW.indexOf(state) < STATE_FLOW.indexOf(currentState);
        return (
          <React.Fragment key={state}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: isActive ? `${meta.color}22` : isPast ? 'rgba(0,255,136,0.08)' : 'var(--bg-elevated)',
                border: `2px solid ${isActive ? meta.color : isPast ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                boxShadow: isActive ? `0 0 16px ${meta.color}60` : 'none',
                transition: 'all 0.3s ease',
              }}>{meta.icon}</div>
              <span style={{ fontSize: 10, color: isActive ? meta.color : 'var(--text-muted)', fontWeight: isActive ? 700 : 400, textAlign: 'center', maxWidth: 60 }}>{state}</span>
            </div>
            {i < STATE_FLOW.length - 1 && (
              <div style={{ width: 32, height: 2, background: isPast ? 'var(--accent-green)' : 'var(--border-subtle)', flexShrink: 0, margin: '0 4px', marginBottom: 20 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function AIAgent() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [selectedDrone, setSelectedDrone] = useState<number>(1);
  const [launching, setLaunching] = useState<number | null>(null);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    subscribeDrones(setDrones);
    const tick = () => setDecisions([...getLiveAIDecisions()]);
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  const currentDecision = decisions.find(d => d.droneId === selectedDrone);
  const currentState = currentDecision?.state ?? 'IDLE';
  const meta = STATE_META[currentState] ?? STATE_META['IDLE'];

  const activeDrones = drones.filter(d => d.status !== 'Error');
  const displayDecisions = filter ? decisions.filter(d => d.droneId === filter) : decisions;

  const handleLaunch = async (droneId: number) => {
    setLaunching(droneId);
    try {
      await api.startAutonomousMission(droneId);
    } finally {
      setTimeout(() => setLaunching(null), 2000);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Flight Agent</h1>
          <p className="page-subtitle">Autonomous decision-making · Real-time state machine</p>
        </div>
        <div style={{ padding: '8px 16px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 700 }}>AI MODEL: Rule-Based FSM + Heuristics</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Drone selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-title">Select Drone</div>
          {activeDrones.map(drone => (
            <div
              key={drone.id}
              id={`ai-drone-${drone.id}`}
              className="card"
              style={{ cursor: 'pointer', borderColor: selectedDrone === drone.id ? 'var(--accent-cyan)' : undefined, padding: '12px 16px' }}
              onClick={() => setSelectedDrone(drone.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>🛸 {drone.name}</span>
                <span className={`badge badge-${drone.status.toLowerCase()}`} style={{ fontSize: 10 }}>{drone.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                <span>🔋 {drone.battery}%</span>
                <span>↑ {drone.altitude}m</span>
              </div>
              <button
                id={`ai-launch-${drone.id}`}
                className="btn btn-success"
                style={{ width: '100%', fontSize: 12, padding: '6px' }}
                disabled={launching === drone.id || drone.status === 'Charging' || drone.battery < 20}
                onClick={e => { e.stopPropagation(); handleLaunch(drone.id); }}
              >
                {launching === drone.id ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Launching...</> : '▶ Start Autonomous Mission'}
              </button>
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* State Machine */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">⬡ State Machine — {drones.find(d => d.id === selectedDrone)?.name ?? 'Select Drone'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, color: meta.color, fontSize: 15 }}>{currentState}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meta.desc}</div>
                </div>
              </div>
            </div>
            <StateMachineViz currentState={currentState} />
          </div>

          {/* Decision Log */}
          <div className="card" style={{ flex: 1 }}>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <span className="section-title">📜 Decision Log</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`btn ${filter === null ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setFilter(null)}>All</button>
                {activeDrones.slice(0, 3).map(d => (
                  <button key={d.id} className={`btn ${filter === d.id ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setFilter(d.id)}>{d.name}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {displayDecisions.map((d, i) => {
                const m = STATE_META[d.state] ?? STATE_META['IDLE'];
                return (
                  <div key={i} className="ai-log-entry">
                    <span className="ai-log-time">{new Date(d.timestamp).toLocaleTimeString()}</span>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: m.color }}>{d.action}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {drones.find(dr => dr.id === d.droneId)?.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{d.reason}</div>
                    </div>
                  </div>
                );
              })}
              {displayDecisions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>No AI decisions recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
