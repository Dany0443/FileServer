# FileServer

A Google Drive-like file storage application for you and your friends, built with Node.js, Express, and Multer. Easily upload, download, and manage files through a modern web interface.

## Features

- User authentication (simple token-based login)
- Upload and download files (up to 20GB per file)
- File listing in grid or list view
- Delete files
- Responsive web UI
- Simple user management via `users.json`
- Added a progress bar that shows how much the file has uploaded

## Setup (Windows)

1. **Clone the repository**  
   Download or clone this repository to your local machine.

2. **Install dependencies**  
   Open a terminal in the project folder and run:
   ```bash
   npm install
   ```
   
3. **Configure users**
   - Edit users.json to add your users.
   - Passwords must be hashed with bcrypt.

4. **Start the server**
   - Run:
   ```bash
   node start.js
   ```
  
The server will start on http://localhost:3445 by default.

## Linux Deployment

For deploying on a Linux server with Nginx:

1. **Update the storage path**
   - The application is configured to use `/mnt/hdd/storage` on Linux systems
   - Make sure this directory exists and has proper permissions

2. **Use the provided Nginx configuration**
   - A ready-to-use Nginx configuration file is included (`nginx.conf`)
   - This is configured for the domain `webjuniors.team`

3. **Follow the deployment guide**
   - See `LINUX-DEPLOYMENT.md` for detailed instructions
   - You can use the automated deployment script `deploy-linux.sh`

## Notes
- Uploaded files are stored in C:\FSV on Windows or `/mnt/hdd/storage` on Linux by default.
- Maximum upload size is 20GB per file.
- For production, consider using a persistent token store (like Redis) and HTTPS.

## Planned Features
- More advanced user management
- File sharing and permissions
- Search and sorting
- Improved security

  ## License
This project is licensed under the MIT License. See LICENSE for details.
