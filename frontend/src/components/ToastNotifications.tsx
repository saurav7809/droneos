import React, { useEffect, useState, useCallback } from 'react';
import { subscribeDrones, Drone } from '../services/mockApi';

// ─── Toast Types ──────────────────────────────────────────────
export type ToastLevel = 'info' | 'success' | 'warning' | 'critical';

export interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  message: string;
  timestamp: number;
}

// ─── Global Toast Store ───────────────────────────────────────
const toasts: Toast[] = [];
const listeners: Set<(toasts: Toast[]) => void> = new Set();

function notify() {
  listeners.forEach(cb => cb([...toasts]));
}

export function addToast(level: ToastLevel, title: string, message: string) {
  const toast: Toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    level,
    title,
    message,
    timestamp: Date.now(),
  };
  toasts.unshift(toast);
  if (toasts.length > 5) toasts.splice(5);
  notify();

  // Auto-dismiss
  const ttl = level === 'critical' ? 8000 : level === 'warning' ? 5000 : 3500;
  setTimeout(() => dismissToast(toast.id), ttl);
}

export function dismissToast(id: string) {
  const idx = toasts.findIndex(t => t.id === id);
  if (idx >= 0) {
    toasts.splice(idx, 1);
    notify();
  }
}

// ─── Battery alert tracker ─────────────────────────────────────
const alerted = new Set<number>();

function checkDroneAlerts(drones: Drone[]) {
  drones.forEach(d => {
    if (d.battery < 20 && d.status === 'Returning' && !alerted.has(d.id)) {
      alerted.add(d.id);
      addToast('critical', '⚠ Low Battery RTH', `${d.name} has ${d.battery}% — returning to base!`);
    }
    if (d.battery >= 20 && alerted.has(d.id)) {
      alerted.delete(d.id); // Reset when recharged
    }
  });
}

// Start monitoring
subscribeDrones(checkDroneAlerts);

// ─── ToastContainer Component ─────────────────────────────────
const LEVEL_STYLES: Record<ToastLevel, { bg: string; border: string; icon: string; color: string }> = {
  info:     { bg: 'rgba(0,212,255,0.12)',  border: 'rgba(0,212,255,0.4)',  icon: 'ℹ', color: '#00d4ff' },
  success:  { bg: 'rgba(0,255,136,0.12)', border: 'rgba(0,255,136,0.4)',  icon: '✓', color: '#00ff88' },
  warning:  { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.4)',  icon: '⚠', color: '#ffb800' },
  critical: { bg: 'rgba(255,59,92,0.18)', border: 'rgba(255,59,92,0.5)',  icon: '🔴', color: '#ff3b5c' },
};

export default function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    setItems([...toasts]);
    return () => { listeners.delete(setItems); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 360,
    }}>
      {items.map(toast => {
        const s = LEVEL_STYLES[toast.level];
        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderLeft: `4px solid ${s.color}`,
              borderRadius: 10,
              padding: '12px 16px',
              backdropFilter: 'blur(12px)',
              boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 12px ${s.border}`,
              animation: 'slideInRight 0.3s ease',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              cursor: 'pointer',
            }}
            onClick={() => dismissToast(toast.id)}
          >
            <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: s.color, marginBottom: 2 }}>
                {toast.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {toast.message}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(toast.timestamp).toLocaleTimeString()} · click to dismiss
              </div>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
