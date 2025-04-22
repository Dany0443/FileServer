# FileServer

A Google Drive-like file storage application for you and your friends, built with Node.js, Express, and Multer. Easily upload, download, and manage files through a modern web interface.

## Features

- User authentication (simple token-based login)
- Upload and download files (up to 10GB per file)
- File listing in grid or list view
- Delete files
- Responsive web UI
- Simple user management via `users.json`

## Setup

1. **Clone the repository**  
   Download or clone this repository to your local machine.

2. **Install dependencies**  
   Open a terminal in the project folder and run:
   ```bash
   npm install express multer bcrypt compresion cors
   
3. **Configure users**
 - Edit users.
 - json to add your users.
 - Passwords must be hashed with bcrypt.

4. **Start the server**
- Run:
- ```bash
   npm server.js
  
The server will start on http://localhost:3000 by default.

## Notes
- Uploaded files are stored in C:\FSV by default. You can change this path in server.js .
- Maximum upload size is 10GB per file.
- For production, consider using a persistent token store (like Redis) and HTTPS.

## Planned Features
- More advanced user management
- File sharing and permissions
- Search and sorting
- Improved security

  ## License
This project is licensed under the MIT License. See LICENSE for details.
