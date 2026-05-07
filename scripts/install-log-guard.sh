#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

if [[ "$EUID" -ne 0 ]]; then
  export APP_DIR
  exec sudo -E bash "$0" "$@"
fi

install -d -m 755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/99-bizobs-log-limits.conf <<'EOF'
[Journal]
SystemMaxUse=200M
SystemKeepFree=1G
RuntimeMaxUse=100M
MaxRetentionSec=2week
EOF

cat > /etc/logrotate.d/bizobs-app <<EOF
${APP_DIR}/logs/*.log {
    daily
    rotate 14
    size 20M
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}
EOF

cat > /etc/logrotate.d/bizobs-dynatrace <<'EOF'
/var/log/dynatrace/*.log
/var/log/dynatrace/oneagent/*.log
/var/log/dynatrace/oneagent/*/*.log
/var/log/dynatrace/oneagent/*/*/*.log
{
    daily
    rotate 7
    size 20M
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}
EOF

if [[ -f /etc/logrotate.d/rsyslog ]]; then
  sed -i 's/^\s*rotate\s\+[0-9]\+/        rotate 7/' /etc/logrotate.d/rsyslog || true
  sed -i 's/^\s*size\s\+[0-9]\+M/        size 20M/' /etc/logrotate.d/rsyslog || true
fi

install -m 755 "$SCRIPT_DIR/log-pressure-relief.sh" /usr/local/sbin/bizobs-log-pressure-relief.sh

cat > /etc/systemd/system/bizobs-log-guard.service <<EOF
[Unit]
Description=BizObs Log Pressure Relief
After=network.target

[Service]
Type=oneshot
Environment=APP_DIR=${APP_DIR}
ExecStart=/usr/local/sbin/bizobs-log-pressure-relief.sh
EOF

cat > /etc/systemd/system/bizobs-log-guard.timer <<'EOF'
[Unit]
Description=Run BizObs Log Guard Hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl restart systemd-journald || true
systemctl enable --now bizobs-log-guard.timer
systemctl start bizobs-log-guard.service

echo "Installed log guard: journald caps + logrotate + hourly pressure relief"
