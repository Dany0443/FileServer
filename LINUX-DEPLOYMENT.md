# FileServer Linux Deployment Guide

This guide will help you deploy the FileServer application on your Linux server with Nginx as a reverse proxy.

## Prerequisites

- A Linux server with Node.js (v14 or higher) installed
- Nginx installed
- Access to create directories in `/mnt/hdd/storage`
- Domain name pointing to your server (webjuniors.team)
- SSL certificate (Let's Encrypt recommended)

## Deployment Steps

### 1. Prepare the Server

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install required packages if not already installed
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
```

### 2. Set Up SSL Certificate

```bash
# Obtain SSL certificate using Let's Encrypt
sudo certbot --nginx -d webjuniors.team
```

### 3. Create Storage Directory

```bash
# Create the storage directory with proper permissions
sudo mkdir -p /mnt/hdd/storage
sudo chown -R www-data:www-data /mnt/hdd/storage
sudo chmod 755 /mnt/hdd/storage
```

### 4. Deploy the Application

You can either use the provided deployment script or follow these manual steps:

#### Option 1: Using the Deployment Script

```bash
# Make the script executable
chmod +x deploy-linux.sh

# Run the deployment script as root
sudo ./deploy-linux.sh
```

#### Option 2: Manual Deployment

```bash
# Create application directory
sudo mkdir -p /opt/fileserver

# Copy application files to the server
# (Assuming you've uploaded the files to the server)
sudo cp -r /path/to/uploaded/files/* /opt/fileserver/

# Set proper permissions
sudo chown -R www-data:www-data /opt/fileserver

# Install dependencies
cd /opt/fileserver
sudo npm install --production

# Copy Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/fileserver.conf
sudo ln -sf /etc/nginx/sites-available/fileserver.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Create systemd service
sudo bash -c 'cat > /etc/systemd/system/fileserver.service << EOF
[Unit]
Description=FileServer Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fileserver
ExecStart=/usr/bin/node /opt/fileserver/start.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fileserver
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
EOF'

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable fileserver
sudo systemctl start fileserver
```

### 5. Verify Deployment

- Check if the application is running: `sudo systemctl status fileserver`
- Check application logs: `sudo journalctl -u fileserver`
- Visit your domain in a browser: `https://webjuniors.team`

## Troubleshooting

### Service Won't Start

Check the logs for errors:
```bash
sudo journalctl -u fileserver -n 50 --no-pager
```

### Nginx Configuration Issues

Test the Nginx configuration:
```bash
sudo nginx -t
```

### Permission Issues

Ensure proper permissions are set:
```bash
sudo chown -R www-data:www-data /opt/fileserver
sudo chown -R www-data:www-data /mnt/hdd/storage
```

### Firewall Issues

Make sure ports 80 and 443 are open:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Maintenance

### Updating the Application

```bash
cd /opt/fileserver
sudo git pull  # If using git
sudo npm install --production
sudo systemctl restart fileserver
```

### Monitoring

Monitor the application logs:
```bash
sudo journalctl -f -u fileserver
```

### Backup

Regularly backup your data:
```bash
sudo rsync -av /mnt/hdd/storage /path/to/backup/location
```