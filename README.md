# 🛸 DroneOS — Autonomous Fleet Command Platform

> **Production-ready** drone fleet management system with real-time telemetry, AI-powered detection, live mapping, and full command control.

[![CI/CD](https://github.com/YOUR_ORG/droneos/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_ORG/droneos/actions)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2-6DB33F?logo=spring)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────┐
│               Internet / Load Balancer               │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS (443)
┌─────────────────▼───────────────────────────────────┐
│          Nginx (React SPA + Reverse Proxy)           │
│  /        → React Frontend (dist/)                  │
│  /api/*   → Spring Boot :8080                       │
│  /ws/*    → Spring Boot WebSocket                   │
│  /ai/*    → Python AI Service :5000                 │
└────┬──────────────────────────────┬─────────────────┘
     │                              │
┌────▼────────────┐    ┌────────────▼──────────────────┐
│  Spring Boot    │    │    Python AI Service           │
│  :8080          │    │    :5000 (Gunicorn 2w/4t)      │
│  • REST API     │    │    • Weather simulation         │
│  • WebSocket    │    │    • Object detection           │
│  • JWT Auth     │    │    • Physics engine             │
│  • Flight Sim   │    │    • Camera feed                │
└────┬────────────┘    └───────────────────────────────┘
     │
┌────▼───────────────┐
│   PostgreSQL 15    │
│   (StatefulSet)    │
│   Persistent PVC   │
└────────────────────┘
```

## 🚀 Quick Start (Docker Compose)

### Prerequisites
- Docker 24+ and Docker Compose v2
- 2 GB RAM minimum

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_ORG/droneos.git
cd droneos

# Create environment file
cp .env.example .env

# Edit .env — set strong passwords and JWT secret
nano .env
```

**Generate a secure JWT secret:**
```bash
openssl rand -hex 64
```

### 2. Deploy

```bash
# Make deploy script executable (Linux/Mac)
chmod +x deploy.sh

# Start all services
./deploy.sh start

# Or on Windows:
docker compose -f docker-compose.prod.yml up -d
```

### 3. Access

| Service  | URL                          | Credentials      |
|----------|------------------------------|------------------|
| Frontend | http://localhost             | admin / admin123 |
| PgAdmin  | http://localhost:5050        | see .env         |
| API Docs | http://localhost/api/health  | —                |

---

## 🔧 Configuration

### Environment Variables (`.env`)

| Variable        | Required | Description                           |
|-----------------|----------|---------------------------------------|
| `DB_PASSWORD`   | ✅ Yes   | PostgreSQL password                   |
| `JWT_SECRET`    | ✅ Yes   | JWT signing key (min 64 chars)        |
| `POSTGRES_DB`   | No       | Database name (default: `dronedb`)    |
| `DB_USERNAME`   | No       | DB user (default: `droneos`)          |
| `FRONTEND_PORT` | No       | Public port (default: `80`)           |
| `TAG`           | No       | Docker image tag (default: `latest`)  |
| `TZ`            | No       | Timezone (default: `Asia/Kolkata`)    |
| `DATA_DIR`      | No       | Volume mount path (default: `./data`) |

---

## 📦 Deployment Options

### Option A: Single VPS (Docker Compose)

```bash
# On your server
git clone https://github.com/YOUR_ORG/droneos.git /opt/droneos
cd /opt/droneos
cp .env.example .env && nano .env
./deploy.sh start
```

Recommended: **2 vCPU / 4 GB RAM** (DigitalOcean Droplet, Linode, Hetzner)

### Option B: Kubernetes (AWS EKS / GKE / DigitalOcean)

```bash
# 1. Update image names in k8s/droneos.yml
sed -i 's/YOUR_ORG/your-github-org/g' k8s/droneos.yml

# 2. Set your domain
sed -i 's/YOUR_DOMAIN.com/droneos.yourdomain.com/g' k8s/droneos.yml

# 3. Create secrets
kubectl create secret generic droneos-secrets \
  --from-literal=DB_PASSWORD=your-password \
  --from-literal=JWT_SECRET=$(openssl rand -hex 64) \
  -n droneos

# 4. Apply manifests
kubectl apply -f k8s/droneos.yml

# 5. Check status
kubectl get pods -n droneos
```

### Option C: Cloud Platform (Render.com / Railway / Fly.io)

See `deploy/platform-guides/` for platform-specific configs.

---

## 🛠 Operations

```bash
./deploy.sh start     # Start all services
./deploy.sh stop      # Stop all services
./deploy.sh restart   # Restart
./deploy.sh status    # View container status
./deploy.sh logs      # Follow all logs
./deploy.sh logs backend   # Follow backend only
./deploy.sh backup    # Dump DB to .sql file
./deploy.sh update    # Pull latest images, rolling restart
./deploy.sh clean     # Remove containers + images
```

### Database Backup & Restore

```bash
# Backup
./deploy.sh backup
# Output: droneos_backup_20260705_143000.sql

# Restore
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U droneos dronedb < droneos_backup_20260705_143000.sql
```

---

## 🔒 Security Checklist

- [ ] Changed `DB_PASSWORD` from default
- [ ] Generated `JWT_SECRET` with `openssl rand -hex 64`
- [ ] HTTPS configured (Nginx + cert-manager or Cloudflare)
- [ ] Firewall: only port 80/443 exposed externally
- [ ] PgAdmin not exposed in production (use `--profile debug` only)
- [ ] `.env` not committed to git
- [ ] Non-root users in all Docker containers ✅
- [ ] Network isolation: backend/DB on internal Docker network ✅

---

## 🗂 Project Structure

```
drone-platform/
├── frontend/           React 18 + TypeScript + Vite + Leaflet
│   ├── src/
│   │   ├── pages/     Dashboard, LiveMap, Analytics, DroneDetail,
│   │   │              MissionPlanner, FlightHistory, Settings, Weather
│   │   ├── components/ DroneCard, NotificationCenter, Sidebar, etc.
│   │   └── services/  WebSocket, realApi, mockApi
│   ├── Dockerfile      Multi-stage: Node builder + Nginx
│   └── nginx.conf      Reverse proxy + gzip + security headers
│
├── backend/            Spring Boot 3.2 + WebSocket + JWT
│   ├── src/
│   │   ├── config/    Security, WebSocket, DataSeeder
│   │   ├── controller/ DroneController, AuthController, etc.
│   │   ├── entity/    Drone, FlightLog, Mission, User
│   │   ├── websocket/ DroneSimulatorScheduler (physics engine)
│   │   └── resources/ application.yml, application-prod.yml
│   └── Dockerfile      3-stage: deps cache → build → JRE
│
├── ai-service/         Python Flask + Gunicorn
│   ├── app.py         REST endpoints: /health, /ai/weather, /ai/detect
│   ├── weather.py     Physics-based weather simulation
│   ├── requirements.txt Pinned versions
│   └── Dockerfile      Non-root + Gunicorn
│
├── k8s/               Kubernetes manifests (prod-ready)
│   └── droneos.yml    Namespace, Secrets, Deployments, HPA, Ingress
│
├── .github/
│   └── workflows/
│       └── deploy.yml GitHub Actions CI/CD pipeline
│
├── docker-compose.yml       Development (H2, no auth required)
├── docker-compose.prod.yml  Production (PostgreSQL, resource limits)
├── deploy.sh                One-command deploy script
├── .env.example             Environment template
└── init.sql                 PostgreSQL schema + seed data
```

---

## 📊 Features

| Feature | Description |
|---------|-------------|
| 🛸 Fleet Dashboard | Live telemetry for 6 drones with WebSocket streaming |
| 🗺 Live Map | Leaflet with GPS trails, no-fly zones, waypoints |
| 📊 Analytics | Fleet health, radar chart, battery trends |
| 🎮 Drone Control | TAKEOFF/LAND/RTH/HOVER/ABORT per drone |
| 🔔 Notifications | Real-time toast alerts with sound (Web Audio) |
| 📋 Flight History | Event log with CSV export + filters |
| ⚙ Settings | Safety thresholds, notifications, API config |
| 🛸 Drone Detail | Live mini-map, telemetry charts, command center |
| 🤖 AI Service | Weather, object detection, camera simulation |
| 🔒 Auth | JWT login/register, protected routes |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit and push
4. Open a PR to `develop`

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

*Built with ❤️ by the DroneOS team*
