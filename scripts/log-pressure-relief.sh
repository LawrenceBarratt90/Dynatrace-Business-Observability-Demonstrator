#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/Business-Observability-Demonstrator}"
ROOT_USAGE_PCT=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')

# Keep journal bounded even during noisy periods.
journalctl --vacuum-size=200M --vacuum-time=14d >/dev/null 2>&1 || true

# Run standard rotation rules.
/usr/sbin/logrotate -f /etc/logrotate.conf >/dev/null 2>&1 || true

# If disk pressure is high, do an extra cleanup pass.
if [[ "${ROOT_USAGE_PCT}" -ge 85 ]]; then
  find /var/log -xdev -type f -name '*.gz' -mtime +7 -delete >/dev/null 2>&1 || true

  if [[ -d /var/log/dynatrace ]]; then
    find /var/log/dynatrace -type f -name '*.log' -size +100M -exec truncate -s 20M {} \; >/dev/null 2>&1 || true
  fi

  if [[ -d "${APP_DIR}/logs" ]]; then
    find "${APP_DIR}/logs" -type f -name '*.log' -size +100M -exec truncate -s 20M {} \; >/dev/null 2>&1 || true
  fi
fi
