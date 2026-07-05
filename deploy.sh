#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DroneOS — Production Deploy Script
# Usage: ./deploy.sh [start|stop|restart|logs|status|build|clean]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

banner() {
  echo -e "${CYAN}"
  echo "  ██████╗ ██████╗  ██████╗ ███╗   ██╗███████╗ ██████╗ ███████╗"
  echo "  ██╔══██╗██╔══██╗██╔═══██╗████╗  ██║██╔════╝██╔═══██╗██╔════╝"
  echo "  ██║  ██║██████╔╝██║   ██║██╔██╗ ██║█████╗  ██║   ██║███████╗"
  echo "  ██║  ██║██╔══██╗██║   ██║██║╚██╗██║██╔══╝  ██║   ██║╚════██║"
  echo "  ██████╔╝██║  ██║╚██████╔╝██║ ╚████║███████╗╚██████╔╝███████║"
  echo "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚══════╝"
  echo -e "  ${BOLD}Autonomous Fleet Command Platform${RESET}${CYAN} — Production Deploy${RESET}"
  echo ""
}

# ── Pre-flight checks ─────────────────────────────────────────
preflight() {
  command -v docker &>/dev/null || error "Docker not installed"
  docker info &>/dev/null       || error "Docker daemon not running"
  [[ -f ".env" ]]               || error ".env file missing — copy .env.example and fill in values"
  
  source .env
  [[ "${DB_PASSWORD:-CHANGE_ME}" == "CHANGE_ME"* ]]         && error "Set DB_PASSWORD in .env"
  [[ "${JWT_SECRET:-CHANGE_ME}" == "CHANGE_ME"* ]]          && error "Set JWT_SECRET in .env"
  [[ "${JWT_SECRET:-x}" =~ "CHANGE_ME" ]]                   && error "Set JWT_SECRET in .env"
  
  mkdir -p "$DATA_DIR/postgres"
  success "Pre-flight checks passed"
}

# ── Commands ──────────────────────────────────────────────────
cmd_start() {
  info "Starting DroneOS..."
  preflight
  $COMPOSE pull --quiet
  $COMPOSE up -d --remove-orphans
  echo ""
  info "Waiting for services to become healthy..."
  sleep 5
  cmd_status
  echo ""
  source .env
  success "DroneOS is running → http://localhost:${FRONTEND_PORT:-80}"
}

cmd_stop() {
  info "Stopping DroneOS..."
  $COMPOSE down
  success "All services stopped"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_build() {
  info "Building all images..."
  preflight
  $COMPOSE build --parallel --no-cache
  success "Build complete"
}

cmd_logs() {
  local svc="${2:-}"
  $COMPOSE logs -f --tail=100 $svc
}

cmd_status() {
  echo ""
  echo -e "${BOLD}Service Status:${RESET}"
  $COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
  $COMPOSE ps
}

cmd_clean() {
  warn "This will remove all containers and images (data is preserved)."
  read -rp "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
  $COMPOSE down --rmi all --volumes --remove-orphans
  docker system prune -f
  success "Cleanup complete"
}

cmd_backup() {
  local BACKUP_FILE="droneos_backup_$(date +%Y%m%d_%H%M%S).sql"
  info "Backing up PostgreSQL → $BACKUP_FILE"
  source .env
  $COMPOSE exec -T postgres pg_dump -U "$DB_USERNAME" "$POSTGRES_DB" > "$BACKUP_FILE"
  success "Backup saved: $BACKUP_FILE"
}

cmd_update() {
  info "Pulling latest images and restarting..."
  $COMPOSE pull
  $COMPOSE up -d --no-deps --remove-orphans backend
  sleep 30
  $COMPOSE up -d --no-deps frontend ai-service
  docker image prune -f
  success "Update complete"
}

# ── Help ──────────────────────────────────────────────────────
cmd_help() {
  banner
  echo -e "${BOLD}Usage:${RESET} ./deploy.sh <command>"
  echo ""
  echo -e "${BOLD}Commands:${RESET}"
  printf "  %-12s %s\n" "start"   "Start all services"
  printf "  %-12s %s\n" "stop"    "Stop all services"
  printf "  %-12s %s\n" "restart" "Restart all services"
  printf "  %-12s %s\n" "build"   "Build all Docker images locally"
  printf "  %-12s %s\n" "logs"    "Follow logs (optional: logs backend)"
  printf "  %-12s %s\n" "status"  "Show service status"
  printf "  %-12s %s\n" "backup"  "Dump PostgreSQL to a .sql file"
  printf "  %-12s %s\n" "update"  "Pull latest images, rolling restart"
  printf "  %-12s %s\n" "clean"   "Remove all containers and images"
  echo ""
}

# ── Router ────────────────────────────────────────────────────
banner
case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  build)   cmd_build ;;
  logs)    cmd_logs "$@" ;;
  status)  cmd_status ;;
  backup)  cmd_backup ;;
  update)  cmd_update ;;
  clean)   cmd_clean ;;
  *)       cmd_help ;;
esac
