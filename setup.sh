#!/bin/bash
# ============================================================
#  Business Observability Forge — One-Click Setup
# ============================================================
#  Prerequisites: Node.js v22+, Docker
#  Usage:
#    1. Edit setup.conf with your 4 values
#    2. Run: ./setup.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONF_FILE="$SCRIPT_DIR/setup.conf"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Business Observability Forge — Setup               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Read config ──────────────────────────────────────────
step "Step 1/6: Reading setup.conf"

if [ ! -f "$CONF_FILE" ]; then
  if [ -f "$SCRIPT_DIR/setup.conf.example" ]; then
    cp "$SCRIPT_DIR/setup.conf.example" "$CONF_FILE"
    fail "Created setup.conf from template. Edit it with your 4 values, then re-run ./setup.sh"
  else
    fail "setup.conf not found. Create it with your TENANT_ID, API_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET."
  fi
fi

source "$CONF_FILE"

# Validate all 4 values
ERRORS=0
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "YOUR_TENANT_ID" ]; then
  echo -e "  ${RED}✗ TENANT_ID not set${NC}"
  ERRORS=$((ERRORS + 1))
fi
if [ -z "$API_TOKEN" ] || [[ "$API_TOKEN" == *"XXXX"* ]]; then
  echo -e "  ${RED}✗ API_TOKEN not set${NC}"
  ERRORS=$((ERRORS + 1))
fi
if [ -z "$OAUTH_CLIENT_ID" ] || [[ "$OAUTH_CLIENT_ID" == *"XXXX"* ]]; then
  echo -e "  ${RED}✗ OAUTH_CLIENT_ID not set${NC}"
  ERRORS=$((ERRORS + 1))
fi
if [ -z "$OAUTH_CLIENT_SECRET" ] || [[ "$OAUTH_CLIENT_SECRET" == *"YYYY"* ]]; then
  echo -e "  ${RED}✗ OAUTH_CLIENT_SECRET not set${NC}"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  fail "Edit setup.conf and fill in all 4 values, then re-run ./setup.sh"
fi

# Derive URLs from tenant ID
TENANT_URL="https://${TENANT_ID}.sprint.dynatracelabs.com"
APPS_URL="https://${TENANT_ID}.sprint.apps.dynatracelabs.com"
SSO_URL="https://sso-sprint.dynatracelabs.com/sso/oauth2/token"
PRIVATE_IP=$(hostname -I | awk '{print $1}')

ok "Config loaded"
echo "  Tenant:     $TENANT_URL"
echo "  Apps URL:   $APPS_URL"
echo "  Private IP: $PRIVATE_IP"
echo "  API Token:  ${API_TOKEN:0:15}..."
echo "  OAuth ID:   $OAUTH_CLIENT_ID"

# ── 2. Check prerequisites ─────────────────────────────────
step "Step 2/6: Checking prerequisites"

if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install v22+: https://nodejs.org"
fi
NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 22 ]; then
  fail "Node.js v22+ required (found v$(node --version))"
fi
ok "Node.js $(node --version)"

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "  Installing npm packages..."
  npm install --prefix "$SCRIPT_DIR"
fi
ok "npm packages installed"

if ! command -v docker &>/dev/null; then
  echo "  Installing Docker..."
  sudo yum install -y docker 2>/dev/null || sudo apt-get install -y docker.io 2>/dev/null
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker "$(whoami)"
  ok "Docker installed"
else
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
fi

if ! sudo docker info &>/dev/null 2>&1; then
  sudo systemctl start docker
fi

# ── 3. Create credentials file ─────────────────────────────
step "Step 3/6: Creating .dt-credentials.json"

cat > "$SCRIPT_DIR/.dt-credentials.json" << EOF
{
  "environmentUrl": "$TENANT_URL",
  "apiToken": "$API_TOKEN",
  "otelToken": "$API_TOKEN"
}
EOF
ok "Credentials saved to .dt-credentials.json"

# ── 4. Configure & start EdgeConnect ───────────────────────
step "Step 4/6: Starting EdgeConnect"

# Write the edgeConnect.yaml
cat > "$SCRIPT_DIR/edgeconnect/edgeConnect.yaml" << EOF
name: bizobs-generator
api_endpoint_host: ${TENANT_ID}.sprint.apps.dynatracelabs.com
oauth:
  client_id: ${OAUTH_CLIENT_ID}
  client_secret: ${OAUTH_CLIENT_SECRET}
  resource: urn:dtenvironment:${TENANT_ID}
  endpoint: ${SSO_URL}
EOF
ok "EdgeConnect YAML generated"

# Stop existing container if running
CONTAINER_NAME="edgeconnect-bizobs"
if sudo docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  sudo docker stop "$CONTAINER_NAME" 2>/dev/null || true
  sudo docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Pull and run
echo "  Pulling EdgeConnect image..."
sudo docker pull dynatrace/edgeconnect:latest
echo "  Starting container..."
sudo docker run -d --restart always \
  --name "$CONTAINER_NAME" \
  --network host \
  --mount "type=bind,src=$SCRIPT_DIR/edgeconnect/edgeConnect.yaml,dst=/edgeConnect.yaml" \
  dynatrace/edgeconnect:latest

sleep 5
if sudo docker ps --filter "name=$CONTAINER_NAME" --format '{{.Status}}' | grep -q "Up"; then
  ok "EdgeConnect running"
  # Check for connection
  if sudo docker logs "$CONTAINER_NAME" 2>&1 | grep -q "Connection"; then
    ok "EdgeConnect connected to Dynatrace"
  else
    warn "EdgeConnect started but not yet connected — check logs: docker logs $CONTAINER_NAME"
  fi
else
  warn "EdgeConnect container not running — check: docker logs $CONTAINER_NAME"
fi

# ── 5. Deploy AppEngine app ────────────────────────────────
step "Step 5/6: Deploying Forge UI to Dynatrace"

# Update app.config.json with the correct environment URL
cd "$SCRIPT_DIR"

# Set env vars for automated deploy (no browser needed)
export DT_APP_OAUTH_CLIENT_ID="$OAUTH_CLIENT_ID"
export DT_APP_OAUTH_CLIENT_SECRET="$OAUTH_CLIENT_SECRET"

echo "  Building and deploying app..."
npx dt-app deploy --non-interactive 2>&1 | tail -5

if [ $? -eq 0 ]; then
  ok "Forge UI deployed to $APPS_URL"
else
  warn "Deploy may have failed — check output above"
  echo "  You can retry manually: npx dt-app deploy"
fi

# ── 6. Build agents & start server ─────────────────────────
step "Step 6/6: Building agents & starting server"

echo "  Compiling TypeScript agents..."
npm run build:agents

echo "  Starting server in background..."
nohup npm start > "$SCRIPT_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$SCRIPT_DIR/server.pid"

# Wait for server to be ready
echo "  Waiting for server to start..."
for i in {1..15}; do
  if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    ok "Server running on port 8080 (PID: $SERVER_PID)"
    break
  fi
  sleep 1
done

if ! curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
  warn "Server not responding yet — check: tail -f server.log"
fi

# ── Done ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete!                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo "  1. Open Dynatrace → Apps → Business Observability Forge"
echo "  2. Settings → Config tab → set IP to: $PRIVATE_IP"
echo "  3. Settings → Get Started tab → deploy DT configuration"
echo "  4. Home → pick a template → Run!"
echo ""
echo "  Useful commands:"
echo "    tail -f server.log                    # Server logs"
echo "    docker logs -f edgeconnect-bizobs     # EdgeConnect logs"
echo "    curl http://localhost:8080/api/health # Health check"
echo "    kill \$(cat server.pid)                # Stop server"
echo ""
