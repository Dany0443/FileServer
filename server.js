const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Configure Express to handle large requests
// Increase the limit for JSON payloads
app.use(express.json({ limit: '10gb' }));
// Increase the limit for URL-encoded payloads
app.use(express.urlencoded({ extended: true, limit: '10gb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Define storage location on another drive
const STORAGE_PATH = 'C:\\FSV';

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
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB in bytes
    }
});

// Load users from whitelist file
const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];
function loadUsers() {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (err) {
        console.error('Failed to load users.json:', err.message);
        process.exit(1);
    }
}
loadUsers();

// In-memory token store (for demo; use Redis or DB for production)
const tokens = new Map();

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = crypto.randomBytes(32).toString('hex');
    tokens.set(token, username);

    res.json({ token });
});

// Middleware to protect API endpoints
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (token && tokens.has(token)) {
        req.username = tokens.get(token);
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

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
                    const originalFilename = filename.substring(filename.indexOf('-', filename.indexOf('-') + 1) + 1);
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

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        id: req.file.filename,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        timestamp: new Date()
    });
});

app.get('/api/download/:id', requireAuth, (req, res) => {
    const filename = req.params.id;
    const filePath = path.join(STORAGE_PATH, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        const originalFilename = filename.substring(filename.indexOf('-', filename.indexOf('-') + 1) + 1);
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
        res.sendFile(filePath);
    });
});

app.delete('/api/files/:id', requireAuth, (req, res) => {
    const filename = req.params.id;
    const filePath = path.join(STORAGE_PATH, filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'File deleted successfully' });
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
    console.log(`Maximum file upload size: 10GB`);
});
