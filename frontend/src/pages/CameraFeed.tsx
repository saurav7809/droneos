import React, { useEffect, useState, useRef } from 'react';
import { realApi as api } from '../services/realApi';
import { DroneImage, Detection } from '../services/mockApi';

const LABEL_COLORS: Record<string, string> = {
  Person: '#ff3b5c', Vehicle: '#ffb800', Tree: '#00ff88', Building: '#3b82f6',
  Fire: '#ff6b00', Animal: '#a78bfa', Crack: '#ff3b5c', 'Water Body': '#00d4ff',
  Road: '#8da8c4', 'Power Line': '#ffb800',
};

function BoundingBox({ detection, imgWidth, imgHeight }: { detection: Detection; imgWidth: number; imgHeight: number }) {
  const [x, y, w, h] = detection.bbox;
  const color = LABEL_COLORS[detection.label] ?? '#00d4ff';
  const scaleX = imgWidth / 800;
  const scaleY = imgHeight / 600;
  return (
    <div style={{
      position: 'absolute',
      left: x * scaleX, top: y * scaleY,
      width: w * scaleX, height: h * scaleY,
      border: `2px solid ${color}`,
      borderRadius: 3,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: -20, left: 0,
        background: color, color: '#000', fontSize: 10, fontWeight: 700,
        padding: '1px 5px', borderRadius: '3px 3px 0 0', whiteSpace: 'nowrap',
      }}>
        {detection.label} {(detection.confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

export default function CameraFeed() {
  const [images, setImages] = useState<DroneImage[]>([]);
  const [selected, setSelected] = useState<DroneImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [imgSize, setImgSize] = useState({ w: 640, h: 480 });
  const imgRef = useRef<HTMLDivElement>(null);

  const fetchImages = async () => {
    const imgs = await api.getImages();
    setImages(imgs);
    if (!selected) setSelected(imgs[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchImages();
    const id = setInterval(fetchImages, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setImgSize({ w: rect.width || 640, h: rect.height || 480 });
    }
  }, [selected]);

  const allDetections = images.flatMap(img => img.detections);
  const labelCounts: Record<string, number> = {};
  allDetections.forEach(d => { labelCounts[d.label] = (labelCounts[d.label] ?? 0) + 1; });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📷 Camera Feed</h1>
          <p className="page-subtitle">AI-powered computer vision · YOLO detection</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 700 }}>LIVE — Refreshing every 5s</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Main viewer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Camera view */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8 }}>
              <div style={{ background: 'rgba(255,59,92,0.9)', color: 'white', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="live-dot" style={{ width: 6, height: 6 }} />REC
              </div>
              {selected && <div style={{ background: 'rgba(6,13,24,0.8)', color: 'var(--accent-cyan)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono' }}>
                🛸 Drone-0{selected.droneId}
              </div>}
            </div>

            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
              <button
                id="camera-toggle-boxes"
                className={`btn ${showBoxes ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setShowBoxes(b => !b)}
              >⬡ Detections</button>
            </div>

            <div ref={imgRef} style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-secondary)' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <span style={{ color: 'var(--text-muted)' }}>Loading camera feed...</span>
                </div>
              ) : selected ? (
                <>
                  <img src={selected.imageUrl} alt="Drone camera" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onLoad={e => { const r = (e.target as HTMLImageElement).getBoundingClientRect(); setImgSize({ w: r.width, h: r.height }); }} />
                  {showBoxes && selected.detections.map((det, i) => (
                    <BoundingBox key={i} detection={det} imgWidth={imgSize.w} imgHeight={imgSize.h} />
                  ))}
                  {/* HUD overlay */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(6,13,24,0.9))', padding: '24px 16px 12px', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 24 }}>
                    <span>📅 {new Date(selected.timestamp).toLocaleString()}</span>
                    <span>🔍 {selected.detections.length} objects</span>
                    <span>📡 {(selected.confidence * 100).toFixed(1)}% conf</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <span style={{ color: 'var(--text-muted)' }}>No camera feed available</span>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {images.map((img, i) => (
              <div
                key={img.id}
                id={`camera-thumb-${img.id}`}
                style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${selected?.id === img.id ? 'var(--accent-cyan)' : 'transparent'}`, position: 'relative' }}
                onClick={() => setSelected(img)}
              >
                <img src={img.imageUrl} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono' }}>
                  {img.detections.length} obj
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detections panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Current frame detections */}
          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>🔍 Detected Objects</div>
            {selected?.detections.map((det, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: LABEL_COLORS[det.label] ?? '#00d4ff', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{det.label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono', color: det.confidence > 0.85 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                    {(det.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="progress-bar" style={{ width: 60, marginTop: 2 }}>
                    <div className="progress-fill" style={{ width: `${det.confidence * 100}%`, background: det.confidence > 0.85 ? 'var(--accent-green)' : 'var(--accent-amber)' }} />
                  </div>
                </div>
              </div>
            ))}
            {(!selected || selected.detections.length === 0) && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No objects detected.</p>}
          </div>

          {/* Aggregate stats */}
          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>📊 Session Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Total Images', val: images.length },
                { label: 'Total Objects', val: allDetections.length },
                { label: 'Unique Labels', val: Object.keys(labelCounts).length },
                { label: 'Avg Confidence', val: `${allDetections.length ? (allDetections.reduce((a, d) => a + d.confidence, 0) / allDetections.length * 100).toFixed(1) : 0}%` },
              ].map(item => (
                <div key={item.label} className="metric-card">
                  <span className="stat-label">{item.label}</span>
                  <span className="stat-value" style={{ fontSize: 18 }}>{item.val}</span>
                </div>
              ))}
            </div>
            {Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: LABEL_COLORS[label] ?? '#00d4ff' }} />
                  <span style={{ fontSize: 12 }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
