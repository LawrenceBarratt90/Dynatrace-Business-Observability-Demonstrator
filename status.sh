#!/bin/bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="bizobs-server.service"
PORT="${PORT:-8080}"

echo "BizObs status"
echo "App dir: $APP_DIR"
echo ""

if command -v systemctl >/dev/null 2>&1; then
  echo "systemd"
  systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || true
  systemctl is-active "$SERVICE_NAME" 2>/dev/null || true
  systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null | sed -n '1,18p' || true
  echo ""
fi

echo "ports"
ss -ltnp 2>/dev/null | grep -E ":${PORT}\\b" || true
echo ""

echo "ready"
curl -s --max-time 5 "http://127.0.0.1:${PORT}/api/ready" || echo "ready endpoint unavailable"
echo ""

echo "health"
curl -s --max-time 5 "http://127.0.0.1:${PORT}/api/health" || echo "health endpoint unavailable"
echo ""

if command -v journalctl >/dev/null 2>&1; then
  echo "recent journal"
  journalctl -u "$SERVICE_NAME" -n 10 --no-pager 2>/dev/null || true
fi