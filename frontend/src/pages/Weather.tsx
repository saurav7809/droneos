import React, { useEffect, useState } from 'react';
import { realApi as api } from '../services/realApi';
import { WeatherData } from '../services/mockApi';

const WIND_DIR_ICON: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖'
};

function WeatherGauge({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 120 80" style={{ width: '100%', maxWidth: 160, margin: '0 auto', display: 'block' }}>
        <path d="M 20 70 A 50 50 0 1 1 100 70" fill="none" stroke="var(--bg-elevated)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 20 70 A 50 50 0 1 1 100 70" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${pct * 1.885} 188.5`} opacity={0.8} />
        <text x="60" y="62" textAnchor="middle" fill={color} fontSize="18" fontWeight="800" fontFamily="JetBrains Mono">{value}</text>
        <text x="60" y="76" textAnchor="middle" fill="var(--text-muted)" fontSize="9">{unit}</text>
      </svg>
      <div className="stat-label" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Weather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [source, setSource] = useState<'ai' | 'mock'>('mock');

  const fetchWeather = async () => {
    try {
      const w = await api.getWeather();
      setWeather(w);
      setSource(w.flightSafe !== undefined ? 'ai' : 'mock');
    } catch {
      // keep old data
    }
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchWeather();
    const id = setInterval(fetchWeather, 15000); // refresh every 15s
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner" style={{ width: 40, height: 40 }} />
      <span style={{ color: 'var(--text-muted)' }}>Fetching weather data...</span>
    </div>
  );

  const w = weather!;
  const isSafe = w.flightSafe ?? w.isSafe ?? true;
  const rain = w.rain ?? w.rainChance ?? 0;
  const pressure = w.pressure ?? 1013;
  const uvIndex = w.uvIndex ?? 0;
  const cloudCover = w.cloudCover ?? 0;
  const warnings = w.warnings ?? [];

  const conditionIcon: Record<string, string> = {
    'Clear': '☀', 'Partly Cloudy': '⛅', 'Overcast': '☁', 'Light Rain': '🌦',
    'Heavy Rain': '🌧', 'High Winds': '💨', 'Cloudy': '☁',
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🌤 Weather Station</h1>
          <p className="page-subtitle">
            Updated {lastUpdate.toLocaleTimeString()} · Auto-refresh every 15s
            <span style={{ marginLeft: 8, fontSize: 11, color: source === 'ai' ? '#00ff88' : '#00d4ff' }}>
              [{source === 'ai' ? '🟢 AI Service' : '🔵 Simulation'}]
            </span>
          </p>
        </div>
        <button id="weather-refresh" className="btn btn-ghost" onClick={fetchWeather}>↻ Refresh</button>
      </div>

      {/* Safety Banner */}
      <div
        className={`alert ${isSafe ? 'alert-success' : 'alert-danger'}`}
        style={{ marginBottom: 20, fontSize: 15, fontWeight: 700 }}
      >
        {isSafe
          ? '✓ FLIGHT CONDITIONS SAFE — All systems go for mission launch'
          : `⚠ UNSAFE CONDITIONS — Missions Suspended · ${warnings[0] ?? 'Check parameters'}`}
      </div>

      {/* Warnings list */}
      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.3)' }}>
          <div className="section-title" style={{ marginBottom: 10, color: 'var(--accent-red)' }}>⚠ Active Warnings</div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 13, color: '#ffb800', padding: '4px 0', borderBottom: '1px solid rgba(255,59,92,0.1)' }}>
              · {w}
            </div>
          ))}
        </div>
      )}

      {/* Main Condition Card */}
      <div className="card" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))',
        textAlign: 'center', padding: '32px'
      }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>{conditionIcon[w.condition] ?? '🌤'}</div>
        <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
          {w.temperature}°C
        </div>
        <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 4 }}>{w.condition}</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Humidity',   val: `${w.humidity}%`,                                                            icon: '💧' },
            { label: 'Rain',       val: `${rain} mm/h`,                                                              icon: '🌧' },
            { label: 'Wind',       val: `${w.windSpeed} km/h ${WIND_DIR_ICON[w.windDirection] ?? ''} ${w.windDirection}`, icon: '💨' },
            { label: 'Visibility', val: `${w.visibility} km`,                                                        icon: '👁' },
            { label: 'Pressure',   val: `${pressure} hPa`,                                                           icon: '🔵' },
            { label: 'UV Index',   val: `${uvIndex}`,                                                                icon: '☀' },
            { label: 'Clouds',     val: `${cloudCover}%`,                                                            icon: '☁' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 20 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>{item.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gauges */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <WeatherGauge value={w.temperature}  max={50}  label="Temperature" unit="°C"   color="#ff6b00" />
        <WeatherGauge value={w.windSpeed}    max={60}  label="Wind Speed"  unit="km/h" color={w.windSpeed > 40 ? 'var(--accent-red)' : 'var(--accent-cyan)'} />
        <WeatherGauge value={w.visibility}   max={20}  label="Visibility"  unit="km"   color={w.visibility < 1 ? 'var(--accent-red)' : 'var(--accent-green)'} />
        <WeatherGauge value={w.humidity}     max={100} label="Humidity"    unit="%"    color="#3b82f6" />
      </div>

      {/* Flight Assessment Table */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>🛸 Flight Condition Assessment</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Current</th>
              <th>Safe Limit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { param: '💨 Wind Speed',   current: `${w.windSpeed} km/h`, limit: '< 40 km/h',  safe: w.windSpeed < 40 },
              { param: '👁 Visibility',   current: `${w.visibility} km`,  limit: '> 1 km',      safe: w.visibility > 1 },
              { param: '🌧 Rainfall',     current: `${rain} mm/h`,        limit: '< 5 mm/h',    safe: rain < 5 },
              { param: '🌡 Temperature',  current: `${w.temperature}°C`,  limit: '-5° to 45°',  safe: w.temperature > -5 && w.temperature < 45 },
              { param: '☁ Cloud Cover',   current: `${cloudCover}%`,      limit: '< 90%',       safe: cloudCover < 90 },
              { param: '☀ UV Index',      current: `${uvIndex}`,           limit: '< 9',         safe: uvIndex < 9 },
            ].map(row => (
              <tr key={row.param}>
                <td style={{ fontWeight: 600 }}>{row.param}</td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{row.current}</td>
                <td style={{ color: 'var(--text-muted)' }}>{row.limit}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.safe ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {row.safe ? '✓ Safe' : '⚠ Unsafe'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
