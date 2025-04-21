const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
// Using D: drive for file storage
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
        // Create a unique filename with original name and timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

// Configure multer with increased file size limits (10GB)
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB in bytes
    }
});

// Get list of all files
app.get('/api/files', (req, res) => {
    fs.readdir(STORAGE_PATH, (err, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const fileList = [];
        
        // Process each file to get metadata
        const promises = files.map(filename => {
            return new Promise((resolve) => {
                const filePath = path.join(STORAGE_PATH, filename);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        resolve(null);
                        return;
                    }
                    
                    // Extract original filename from the stored filename
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
            // Sort files by modification time (newest first)
            fileList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            res.json(fileList);
        });
    });
});

// Upload a file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return file information
    res.json({
        id: req.file.filename,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        timestamp: new Date()
    });
});


// Download a file
app.get('/api/download/:id', (req, res) => {
    const filename = req.params.id;
    const filePath = path.join(STORAGE_PATH, filename);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Extract original filename for the download
        const originalFilename = filename.substring(filename.indexOf('-', filename.indexOf('-') + 1) + 1);
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
        res.sendFile(filePath);
    });
});

// Delete a file
app.delete('/api/files/:id', (req, res) => {
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
