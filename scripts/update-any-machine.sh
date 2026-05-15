#!/usr/bin/env bash

set -euo pipefail

# Run from anywhere: script resolves repo root relative to its own location.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

MODE="${1:---ui}"
BRANCH="${BRANCH:-main}"

case "$MODE" in
  --ui|--server|--no-restart|--all)
    ;;
  *)
    echo "Usage: bash scripts/update-any-machine.sh [--ui|--server|--no-restart|--all]"
    echo "  --ui         Pull latest + deploy AppEngine UI only"
    echo "  --server     Pull latest + update server only"
    echo "  --no-restart Pull latest + build without restarting server"
    echo "  --all        Pull latest + update server and AppEngine UI"
    exit 1
    ;;
esac

cd "$REPO_DIR"

echo "[1/3] Pulling latest from origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[2/3] Running update"
if [[ "$MODE" == "--all" ]]; then
  bash update.sh
else
  bash update.sh "$MODE"
fi

echo "[3/3] Status"
if [[ -x ./status.sh ]]; then
  ./status.sh
else
  echo "status.sh not executable. Run: bash status.sh"
  bash status.sh
fi
