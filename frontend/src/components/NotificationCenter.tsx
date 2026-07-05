/**
 * NotificationCenter — Real-time alert panel
 * Receives alerts from Spring Boot /topic/alerts WebSocket + mock events
 */
import React, { useEffect, useState, useRef } from 'react';
import { subscribeAlerts, BackendAlert } from '../services/websocket';
import { subscribeApiMode } from '../services/realApi';

interface Toast extends BackendAlert {
  id: string;
  seen: boolean;
}

// ─── Global notification store ─────────────────────────────────
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

export function addToast(alert: Omit<BackendAlert, 'timestamp'> & { timestamp?: string }) {
  const t: Toast = {
    ...alert,
    timestamp: alert.timestamp ?? new Date().toISOString(),
    id: Math.random().toString(36).slice(2),
    seen: false,
  };
  toasts = [t, ...toasts.slice(0, 49)]; // keep last 50
  listeners.forEach(l => l());
  return t.id;
}

export function useNotifications() {
  const [state, setState] = useState<Toast[]>(toasts);
  useEffect(() => {
    const update = () => setState([...toasts]);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return state;
}

export function markAllRead() {
  toasts = toasts.map(t => ({ ...t, seen: true }));
  listeners.forEach(l => l());
}

// ─── Sound alerts ───────────────────────────────────────────────
function playBeep(freq: number, duration: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch { /* audio not available */ }
}

const LEVEL_CONFIG = {
  CRITICAL: { color: '#ff3b5c', bg: 'rgba(255,59,92,0.12)', border: 'rgba(255,59,92,0.4)', icon: '🔴', beep: () => { playBeep(880, 0.3); setTimeout(() => playBeep(880, 0.3), 400); } },
  WARNING:  { color: '#ffb800', bg: 'rgba(255,184,0,0.1)',  border: 'rgba(255,184,0,0.35)', icon: '⚠',  beep: () => playBeep(660, 0.2) },
  SUCCESS:  { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.3)', icon: '✅', beep: () => playBeep(440, 0.15) },
  INFO:     { color: '#00d4ff', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.3)', icon: 'ℹ',  beep: () => {} },
};

// ─── Toast Popup (auto-dismiss) ────────────────────────────────
function ToastPopup({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = LEVEL_CONFIG[toast.level] ?? LEVEL_CONFIG.INFO;
  useEffect(() => {
    const delay = toast.level === 'CRITICAL' ? 8000 : 5000;
    const t = setTimeout(onDismiss, delay);
    return () => clearTimeout(t);
  }, [toast.level, onDismiss]);

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 10, padding: '10px 14px', maxWidth: 340, backdropFilter: 'blur(12px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${cfg.color}22`,
      animation: 'slideInRight 0.3s ease',
      cursor: 'pointer',
    }} onClick={onDismiss}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            {toast.level} · {toast.droneName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.message}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            {new Date(toast.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
      </div>
    </div>
  );
}

// ─── Active toast stack ────────────────────────────────────────
export function ToastStack() {
  const [active, setActive] = useState<Toast[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const unsub = subscribeAlerts((alerts) => {
      alerts.forEach(a => {
        const t = addToast(a);
        const cfg = LEVEL_CONFIG[a.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.INFO;
        cfg.beep?.();
        setActive(prev => [{ ...a, id: t, seen: false }, ...prev.slice(0, 4)]);
      });
    });
    return () => { unsub(); };
  }, []);

  const dismiss = (id: string) => setActive(prev => prev.filter(t => t.id !== id));

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, display: 'flex', flexDirection: 'column-reverse', gap: 8, maxWidth: 340 }}>
        {active.map(t => (
          <ToastPopup key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </>
  );
}

// ─── Notification Center panel ─────────────────────────────────
export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const notifications = useNotifications();
  const unread = notifications.filter(n => !n.seen).length;

  return (
    <div style={{
      position: 'fixed', top: 28, right: 0, width: 360, height: 'calc(100vh - 28px)',
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border-medium)',
      backdropFilter: 'blur(20px)', zIndex: 9998, display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>🔔 Notifications</span>
          {unread > 0 && <span style={{ marginLeft: 8, background: '#ff3b5c', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{unread}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifications.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 13 }}>No notifications yet</div>
        )}
        {notifications.map(n => {
          const cfg = LEVEL_CONFIG[n.level] ?? LEVEL_CONFIG.INFO;
          return (
            <div key={n.id} style={{
              background: n.seen ? 'transparent' : cfg.bg,
              border: `1px solid ${n.seen ? 'var(--border-subtle)' : cfg.border}`,
              borderLeft: `3px solid ${cfg.color}`,
              borderRadius: 8, padding: '10px 12px',
              opacity: n.seen ? 0.6 : 1, transition: 'opacity 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{cfg.icon} {n.level} · {n.droneName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(n.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
