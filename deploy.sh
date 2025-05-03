#!/bin/bash

# FileServer Deployment Script for Linux
# This script helps set up the FileServer application on a Linux server

# Exit on any error
set -e

echo "=== FileServer Deployment Script ==="

# Configuration variables
APP_DIR="/opt/fileserver"
STORAGE_DIR="/mnt/hdd/storage"
USER="node"
GROUP="node"

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root" >&2
  exit 1
fi

echo "Creating application directory..."
mkdir -p "$APP_DIR"

echo "Creating storage directory..."
mkdir -p "$STORAGE_DIR"

# Create user if it doesn't exist
if ! id -u $USER &>/dev/null; then
  echo "Creating $USER user..."
  useradd -r -m -s /bin/bash $USER
fi

echo "Copying application files..."
# Assuming you've uploaded the files to the server or cloned from git
# cp -r /path/to/uploaded/files/* "$APP_DIR"

echo "Setting permissions..."
chown -R $USER:$GROUP "$APP_DIR"
chown -R $USER:$GROUP "$STORAGE_DIR"
chmod 755 "$APP_DIR"
chmod 755 "$STORAGE_DIR"

echo "Installing dependencies..."
cd "$APP_DIR"
npm install --production

echo "Creating systemd service..."
cat > /etc/systemd/system/fileserver.service << EOF
[Unit]
Description=FileServer Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/start.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fileserver
Environment=NODE_ENV=production PORT=3445

[Install]
WantedBy=multi-user.target
EOF

echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable fileserver
systemctl start fileserver

echo "Setting up Nginx..."
# Copy the nginx config to the appropriate location
cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/fileserver.conf

# Create symbolic link to enable the site
ln -sf /etc/nginx/sites-available/fileserver.conf /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Reload Nginx to apply changes
systemctl reload nginx

echo "=== Deployment Complete ==="
echo "Your FileServer application should now be running at https://webjuniors.team"
echo "Storage location: $STORAGE_DIR"
echo "Application logs: journalctl -u fileserver"