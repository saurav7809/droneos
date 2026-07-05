import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ConnectionBar from './components/ConnectionBar';
import { ToastStack } from './components/NotificationCenter';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import MissionPlanner from './pages/MissionPlanner';
import AIAgent from './pages/AIAgent';
import CameraFeed from './pages/CameraFeed';
import Weather from './pages/Weather';
import FlightHistory from './pages/FlightHistory';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import DroneDetail from './pages/DroneDetail';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout" style={{ paddingTop: 28 }}>
      <ConnectionBar />
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/map"        element={<LiveMap />} />
          <Route path="/missions"   element={<MissionPlanner />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="/ai-agent"   element={<AIAgent />} />
          <Route path="/camera"     element={<CameraFeed />} />
          <Route path="/weather"    element={<Weather />} />
          <Route path="/history"    element={<FlightHistory />} />
          <Route path="/settings"   element={<Settings />} />
          <Route path="/drone/:id"  element={<DroneDetail />} />
          <Route path="*"           element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*"        element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
