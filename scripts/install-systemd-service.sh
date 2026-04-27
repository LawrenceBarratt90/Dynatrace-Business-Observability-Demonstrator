#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="bizobs-server.service"
SYSTEMD_FILE="/etc/systemd/system/$SERVICE_NAME"

ENABLE=false
START=false
RESTART=false

for arg in "$@"; do
  case "$arg" in
    --enable) ENABLE=true ;;
    --start) START=true ;;
    --restart) RESTART=true ;;
    -h|--help)
      echo "Usage: bash scripts/install-systemd-service.sh [--enable] [--start|--restart]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

RUN_AS_USER="${SUDO_USER:-$(id -un)}"
RUN_AS_GROUP="$(id -gn "$RUN_AS_USER")"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "$NODE_BIN" ]]; then
  echo "node is not available in PATH" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  export NODE_BIN RUN_AS_USER RUN_AS_GROUP APP_DIR ENABLE START RESTART
  exec sudo -E bash "$0" "$@"
fi

cat > "$SYSTEMD_FILE" <<EOF
[Unit]
Description=Business Observability Forge Server
Documentation=https://github.com/lawrobar90/Dynatrace-Business-Observability-Forge
After=network.target docker.service
Wants=network-online.target docker.service
StartLimitIntervalSec=600
StartLimitBurst=20

[Service]
Type=simple
User=$RUN_AS_USER
Group=$RUN_AS_GROUP
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOME=/home/$RUN_AS_USER
Environment=PATH=$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-$APP_DIR/.env
ExecStartPre=/bin/bash $APP_DIR/scripts/self-heal.sh
ExecStart=$NODE_BIN --require ./otel.cjs server.js
Restart=always
RestartSec=5
SyslogIdentifier=bizobs-server
StandardOutput=journal
StandardError=journal
TimeoutStartSec=60
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$SYSTEMD_FILE"
systemctl daemon-reload

if [[ "$ENABLE" == true ]]; then
  systemctl enable "$SERVICE_NAME" >/dev/null
fi

if [[ "$RESTART" == true ]]; then
  systemctl reset-failed "$SERVICE_NAME" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE_NAME"
elif [[ "$START" == true ]]; then
  systemctl start "$SERVICE_NAME"
fi

echo "Installed $SERVICE_NAME at $SYSTEMD_FILE"