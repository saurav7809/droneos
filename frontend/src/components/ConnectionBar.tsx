import React, { useEffect, useState } from 'react';
import { subscribeApiMode, ApiMode, initApi } from '../services/realApi';
import { connectWebSocket, subscribeBackendStatus, BackendStatus } from '../services/websocket';

export default function ConnectionBar() {
  const [apiMode, setApiMode]   = useState<ApiMode>('checking');
  const [wsStatus, setWsStatus] = useState<BackendStatus>('connecting');
  const [elapsed, setElapsed]   = useState(0);        // seconds since "checking"
  const [dismissed, setDismissed] = useState(false);  // cold-start banner dismiss

  useEffect(() => {
    initApi().then(mode => { if (mode === 'real') connectWebSocket(); });
    const u1 = subscribeApiMode(setApiMode);
    const u2 = subscribeBackendStatus(setWsStatus);
    return () => { u1(); u2(); };
  }, []);

  // Track how long we've been in "checking" state (cold-start indicator)
  useEffect(() => {
    if (apiMode !== 'checking') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [apiMode]);

  const isWakingUp = apiMode === 'checking' && elapsed > 8;

  const config: Record<ApiMode, { label: string; color: string; icon: string; bg: string }> = {
    checking: { label: isWakingUp ? `Waking up backend… (${elapsed}s)` : 'Connecting to backend…', color: '#ffb800', icon: isWakingUp ? '☕' : '⟳', bg: 'rgba(255,184,0,0.1)' },
    real:     { label: 'Live — Spring Boot Backend', color: '#00ff88',  icon: '🟢', bg: 'rgba(0,255,136,0.06)' },
    mock:     { label: 'Simulation Mode',             color: '#00d4ff',  icon: '🔵', bg: 'rgba(0,212,255,0.06)' },
  };
  const c = config[apiMode];

  const wsLabel: Record<BackendStatus, string> = {
    connecting: 'WS Connecting', connected: 'WS Live', disconnected: 'WS Offline', mock: '',
  };
  const wsColor: Record<BackendStatus, string> = {
    connecting: '#ffb800', connected: '#00ff88', disconnected: '#ff3b5c', mock: '#4a6580',
  };

  return (
    <>
      {/* ── Top status bar ─────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, left: 0, height: 28, zIndex: 9999,
        background: c.bg, borderBottom: `1px solid ${c.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        fontSize: 11, fontWeight: 600, color: c.color, backdropFilter: 'blur(10px)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ animation: apiMode === 'checking' ? 'spin 1s linear infinite' : undefined }}>
            {c.icon}
          </span>
          {c.label}
        </span>

        {apiMode === 'real' && (
          <span style={{ color: wsColor[wsStatus], fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsColor[wsStatus], display: 'inline-block' }} />
            {wsLabel[wsStatus]}
          </span>
        )}
        {apiMode === 'mock' && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            · <code style={{ fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>
              cd backend &amp;&amp; mvnw spring-boot:run
            </code>
          </span>
        )}
      </div>

      {/* ── Cold-start wake-up banner ───────────────────────── */}
      {isWakingUp && !dismissed && (
        <div style={{
          position: 'fixed', top: 36, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, minWidth: 380, maxWidth: 500,
          background: 'linear-gradient(135deg, rgba(20,25,50,0.97), rgba(10,15,35,0.97))',
          border: '1px solid rgba(255,184,0,0.4)',
          borderRadius: 14, padding: '16px 20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,184,0,0.1)',
          animation: 'slideDown 0.3s ease',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 28 }}>☕</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffb800', marginBottom: 4 }}>
                Backend Waking Up…
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Free hosting sleeps after inactivity. Your backend is starting — usually takes <b style={{ color: '#ffb800' }}>15–30 seconds</b>.
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #ffb800, #ff6b35)',
                  width: `${Math.min(elapsed * 3, 95)}%`,
                  transition: 'width 1s linear',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {elapsed}s elapsed · App works in mock mode while waiting
              </div>
            </div>
            <button onClick={() => setDismissed(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
            }}>×</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideDown { from { opacity:0; transform: translateX(-50%) translateY(-10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`}</style>
    </>
  );
}
