import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications, NotificationCenter, markAllRead } from './NotificationCenter';

const NAV_ITEMS = [
  { path: '/dashboard', icon: '⬡',  label: 'Dashboard' },
  { path: '/map',       icon: '🗺',  label: 'Live Map' },
  { path: '/missions',  icon: '📡',  label: 'Mission Planner' },
  { path: '/analytics', icon: '📊',  label: 'Analytics' },
  { path: '/ai-agent',  icon: '🤖',  label: 'AI Agent' },
  { path: '/camera',    icon: '📷',  label: 'Camera Feed' },
  { path: '/weather',   icon: '🌤',  label: 'Weather' },
  { path: '/history',   icon: '📋',  label: 'Flight History' },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const unread = notifications.filter(n => !n.seen).length;

  const handleLogout = () => { logout(); navigate('/login'); };

  const toggleNotifs = () => {
    if (!showNotifs) markAllRead();
    setShowNotifs(s => !s);
  };

  return (
    <>
      <aside className={`sidebar ${expanded ? 'expanded' : ''}`} style={{ justifyContent: 'flex-start' }}>
        {/* Logo / collapse toggle */}
        <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🛸</span>
          {expanded && (
            <span style={{ background: 'linear-gradient(135deg,#00d4ff,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>
              DroneOS
            </span>
          )}
        </div>

        {/* Live indicator */}
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', marginBottom: 8 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 700, letterSpacing: '0.06em' }}>SYSTEMS LIVE</span>
          </div>
        )}

        {/* Nav Items */}
        <nav style={{ width: '100%', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon" style={{ fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
              {expanded && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>

          {/* Notification Bell */}
          <button
            id="nav-notifications"
            onClick={toggleNotifs}
            className="nav-item"
            style={{
              background: showNotifs ? 'rgba(0,212,255,0.1)' : 'none',
              border: 'none', cursor: 'pointer', width: '100%',
              color: unread > 0 ? '#ffb800' : 'var(--text-secondary)', fontSize: 14,
              position: 'relative',
            }}
          >
            <span className="nav-icon" style={{ fontSize: 18, position: 'relative' }}>
              🔔
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#ff3b5c', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16, fontSize: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, lineHeight: 1,
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            {expanded && <span>Alerts {unread > 0 && `(${unread})`}</span>}
          </button>

          {/* Settings */}
          <NavLink to="/settings" id="nav-settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ color: 'var(--text-secondary)' }}>
            <span className="nav-icon" style={{ fontSize: 18 }}>⚙</span>
            {expanded && <span>Settings</span>}
          </NavLink>

          {/* User info */}
          {expanded && (
            <div style={{ padding: '8px 16px', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logged in as</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-cyan)' }}>@{user?.username}</div>
            </div>
          )}

          {/* Logout */}
          <button id="logout-btn" onClick={handleLogout} className="nav-item"
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--accent-red)', fontSize: 14 }}>
            <span className="nav-icon" style={{ fontSize: 18 }}>⏏</span>
            {expanded && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Notification panel slide-in */}
      {showNotifs && <NotificationCenter onClose={() => setShowNotifs(false)} />}
    </>
  );
}
