const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Configure Express to handle large requests
app.use(express.json({ limit: '20gb' }));
app.use(express.urlencoded({ extended: true, limit: '20gb' }));

// Serve static files
app.use(express.static(__dirname));

// Define storage location on another drive
const STORAGE_PATH = path.resolve(process.platform === 'win32' ? 'C:\\FSV' : '/mnt/hdd0/FSV');

// Create storage directory if it doesn't exist
if (!fs.existsSync(STORAGE_PATH)) {
    try {
        fs.mkdirSync(STORAGE_PATH, { recursive: true });
        console.log(`Storage directory created at ${STORAGE_PATH}`);
    } catch (err) {
        console.error(`Failed to create storage directory: ${err.message}`);
    }
}

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, STORAGE_PATH);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 * 1024, // 20GB in bytes
    }
});

// Load users from whitelist file
const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];
function loadUsers() {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        console.log('Users loaded from file');
        // Additional logic to load users from the file can be added here if needed
    } catch (err) {
        console.error('Failed to load users.json:', err.message);
        process.exit(1);
    }
}
loadUsers();

// In-memory token store (for demo; use Redis or DB for production)
// Replace the in-memory token store with file-based storage
// const tokens = new Map(); // Remove this line

// File path for token storage
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Load tokens from file or initialize empty object
let tokens = {};
function loadTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
            console.log('Tokens loaded from file');
        } else {
            tokens = {};
            saveTokens();
            console.log('New tokens file created');
        }
    } catch (err) {
        console.error('Failed to load tokens:', err.message);
        tokens = {};
    }
}

// Save tokens to file
function saveTokens() {
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens), 'utf8');
    } catch (err) {
        console.error('Failed to save tokens:', err.message);
    }
}

// Load tokens on startup
loadTokens();

// Login endpoint - update to use file storage
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token with username and expiration (optional)
    tokens[token] = {
        username: username,
        created: new Date().toISOString()
    };
    
    // Save tokens to file
    saveTokens();

    res.json({ token });
});

// Middleware to protect API endpoints - update to use file storage
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (token && tokens[token]) {
        req.username = tokens[token].username;
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// Add a logout endpoint (optional but recommended)
app.post('/api/logout', requireAuth, (req, res) => {
    const token = req.headers['x-auth-token'];
    if (token && tokens[token]) {
        delete tokens[token];
        saveTokens();
    }
    res.json({ success: true });
});

// Protect all file API endpoints
app.get('/api/files', requireAuth, (req, res) => {
    fs.readdir(STORAGE_PATH, (err, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const fileList = [];
        const promises = files.map(filename => {
            return new Promise((resolve) => {
                const filePath = path.join(STORAGE_PATH, filename);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        resolve(null);
                        return;
                    }
                    // Extract original filename using a more robust method
                    const parts = filename.split('-');
                    // Skip the first two parts (timestamp and random number)
                    const originalFilename = parts.slice(2).join('-');
                    
                    fileList.push({
                        id: filename,
                        name: originalFilename,
                        size: stats.size,
                        type: path.extname(filename).substring(1),
                        timestamp: stats.mtime,
                        path: filePath
                    });
                    resolve();
                });
            });
        });
        Promise.all(promises).then(() => {
            fileList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            res.json(fileList);
        });
    });
});

// Upload endpoint (single, fixed)
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Only compress if not already compressed
    const compressedExtensions = ['.zip', '.rar', '.7z', '.gz', '.jpg', '.jpeg', '.png', '.mp4', '.mp3', '.webm', '.avi', '.mov', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!compressedExtensions.includes(ext)) {
        
        // Compress and save as .gz
        const inp = fs.createReadStream(file.path);
        const out = fs.createWriteStream(file.path + '.gz');
        inp.pipe(zlib.createGzip()).pipe(out).on('finish', () => {
            fs.unlinkSync(file.path); // Remove original
            fs.renameSync(file.path + '.gz', file.path); // Rename compressed to original
            res.json({
                success: true,
                id: file.filename,
                name: file.originalname,
                size: file.size,
                type: file.mimetype,
                timestamp: new Date()
            });
        });
    } else {
        res.json({
            success: true,
            id: file.filename,
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
            timestamp: new Date()
        });
    }
});

app.get('/api/download/:id', (req, res) => {
    // Check for token in headers or query params
    const token = req.headers['x-auth-token'] || req.query.token;
    if (!token || !tokens[token]) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const username = tokens[token].username;
    const fileId = req.params.id;
    const filename = req.params.id;
    const filePath = path.join(STORAGE_PATH, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        const parts = filename.split('-');
        const originalFilename = parts.slice(2).join('-');
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        // If file is larger than 1GB, return direct static URL
        if (fileSize > 1024 * 1024 * 1024) {
            // Log large file download
            const logLine = `[${new Date().toISOString()}] LARGE_DOWNLOAD user=${username} file=${originalFilename} id=${filename} size=${fileSize}\n`;
            fs.appendFile(path.join(__dirname, 'large_downloads.log'), logLine, (err) => {
                if (err) console.error('Failed to log large download:', err.message);
            });
            // Assuming Nginx/Apache is configured to serve STORAGE_PATH at /static/
            const staticUrl = `/static/${encodeURIComponent(filename)}`;
            return res.json({
                direct: true,
                url: staticUrl,
                filename: originalFilename,
                size: fileSize
            });
        }
        // Handle range requests for resumable downloads
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=\"${encodeURIComponent(originalFilename)}\"`
            });
            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=\"${encodeURIComponent(originalFilename)}\"`,
                'Accept-Ranges': 'bytes'
            });
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        }
    });
});

// Add this new endpoint to match the client-side URL
app.delete('/api/files/:id', requireAuth, (req, res) => {
    const fileId = req.params.id;
    const filePath = path.join(STORAGE_PATH, fileId);
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting file' });
        }
        res.json({ success: true });
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Files are being stored at: ${STORAGE_PATH}`);
    console.log(`Maximum file upload size: 20GB`);
});
