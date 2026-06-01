#!/usr/bin/env bash
set -e

VM_USER="remote"
VM_HOST="147.93.145.187"
VM_PATH="/home/${VM_USER}/sgs-v2"
SSH_KEY="~/.ssh/n8n"
SSH_OPTS="-i ${SSH_KEY} -o ServerAliveInterval=30 -o ServerAliveCountMax=10"

echo "Syncing files to VM..."
rsync -avz --delete \
  -e "ssh ${SSH_OPTS}" \
  --exclude '.env' \
  --exclude '*.env' \
  --exclude '.env.*' \
  --exclude '.claude/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'dist/' \
  --exclude '.git/' \
  --exclude 'sgs-webapp/' \
  --exclude 'uploader/' \
  --exclude '*.db' \
  --exclude '__pycache__/' \
  --exclude '.venv/' \
  . ${VM_USER}@${VM_HOST}:${VM_PATH}

echo "Building and restarting..."
ssh ${SSH_OPTS} ${VM_USER}@${VM_HOST} VM_PATH="${VM_PATH}" bash << 'ENDSSH'
  set -e
  cd "${VM_PATH}"
  source ~/.nvm/nvm.sh

  # Env check
  if [ ! -f api/.env ]; then
    echo "ERROR: api/.env not found — create it on the VM first"
    exit 1
  fi
  if [ ! -f web/.env ]; then
    echo "ERROR: web/.env not found — create it on the VM first"
    exit 1
  fi

  # Install deps
  npm install
  npm install --prefix web
  npm install --prefix api

  # Build
  npm run build:web
  npm run build:api

  # PM2 — start or restart
  pm2 start ecosystem.config.js --update-env 2>/dev/null || true
  pm2 restart sgs-web sgs-api 2>/dev/null || pm2 start ecosystem.config.js
  pm2 save
ENDSSH

echo "Done."
