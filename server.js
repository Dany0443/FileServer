const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fsPromises = fs.promises;

const app = express();
const PORT = process.env.PORT || 3444;

// Define storage location on another drive
// Using G: drive for file storage
const STORAGE_PATH = '/mnt/hdd0/FSV';

// Increase server timeout for large file operations
app.timeout = 3600000; // 1 hour timeout

// Enable CORS
app.use(cors());

// Increase JSON limit for large file metadata
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));



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

// Configure multer with increased file size limits
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
        fieldSize: 10 * 1024 * 1024 * 1024 // 10GB field size limit
    }
});

// Get list of all files and folders
app.get('/api/files', async (req, res) => {
    try {
        const currentFolder = req.query.folder || '';
        const folderPath = path.join(STORAGE_PATH, currentFolder);
        
        // Create folder if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            await fsPromises.mkdir(folderPath, { recursive: true });
        }
        
        const items = await fsPromises.readdir(folderPath, { withFileTypes: true });
        
        const fileList = [];
        const folderList = [];
        
        // Process each item to get metadata
        const promises = items.map(async (item) => {
            const itemPath = path.join(folderPath, item.name);
            const stats = await fsPromises.stat(itemPath);
            
            if (item.isDirectory()) {
                // This is a folder
                folderList.push({
                    id: path.join(currentFolder, item.name),
                    name: item.name,
                    isFolder: true,
                    timestamp: stats.mtime,
                    path: itemPath
                });
            } else {
                // This is a file - extract original filename if it follows our naming pattern
                let displayName = item.name;
                if (item.name.includes('-')) {
                    try {
                        displayName = item.name.substring(item.name.indexOf('-', item.name.indexOf('-') + 1) + 1);
                    } catch (e) {
                        // If parsing fails, use the original name
                        displayName = item.name;
                    }
                }
                
                fileList.push({
                    id: path.join(currentFolder, item.name),
                    name: displayName,
                    size: stats.size,
                    type: path.extname(item.name).substring(1),
                    timestamp: stats.mtime,
                    path: itemPath,
                    isFolder: false
                });
            }
        });
        
        await Promise.all(promises);
        
        // Sort folders and files by name
        folderList.sort((a, b) => a.name.localeCompare(b.name));
        fileList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Combine folders and files, with folders first
        const result = [...folderList, ...fileList];
        
        // Add parent folder info if we're in a subfolder
        if (currentFolder) {
            const parentFolder = path.dirname(currentFolder);
            result.unshift({
                id: parentFolder,
                name: '..',
                isFolder: true,
                isParent: true,
                timestamp: new Date(),
                path: path.join(STORAGE_PATH, parentFolder)
            });
        }
        
        res.json(result);
    } catch (err) {
        console.error('Error reading directory:', err);
        res.status(500).json({ error: err.message });
    }
});


// Upload a file
app.post('/api/upload', (req, res) => {
    // Get the current folder from the query parameter
    const currentFolder = req.query.folder || '';
    const folderPath = path.join(STORAGE_PATH, currentFolder);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    
    // Configure multer for the current folder
    const folderStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, folderPath);
        },
        filename: function (req, file, cb) {
            // Create a unique filename with original name and timestamp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        }
    });
    
    const folderUpload = multer({
        storage: folderStorage,
        limits: {
            fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
            fieldSize: 10 * 1024 * 1024 * 1024 // 10GB field size limit
        }
    }).single('file');
    
    folderUpload(req, res, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Return file information
        res.json({
            id: path.join(currentFolder, req.file.filename),
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
            timestamp: new Date(),
            isFolder: false
        });
    });
});

// Handle chunked file uploads
app.post('/api/upload-chunk', (req, res) => {
    // Create a temporary upload folder if it doesn't exist
    const tempDir = path.join(STORAGE_PATH, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Store folder information with the chunk
    const folder = req.body.folder || '';
    
    const chunkUpload = multer({
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, tempDir);
            },
            filename: function (req, file, cb) {
                // Use the chunk number as part of the filename
                const chunkNumber = req.body.chunkNumber || '0';
                const fileId = req.body.fileId || Date.now().toString();
                cb(null, `${fileId}-chunk-${chunkNumber}`);
            }
        }),
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB per chunk
        }
    }).single('chunk');
    
    chunkUpload(req, res, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No chunk uploaded' });
        }
        
        // Return success for this chunk
        res.json({
            success: true,
            fileId: req.body.fileId,
            chunkNumber: req.body.chunkNumber,
            totalChunks: req.body.totalChunks
        });
    });
});

// Complete chunked upload by combining all chunks
app.post('/api/complete-upload', (req, res) => {
    const { fileId, fileName, totalChunks, folder } = req.body;
    
    if (!fileId || !fileName || !totalChunks) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const tempDir = path.join(STORAGE_PATH, 'temp');
    const targetFolder = path.join(STORAGE_PATH, folder || '');
    
    // Create target folder if it doesn't exist
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const finalFileName = uniqueSuffix + '-' + fileName;
    const outputPath = path.join(targetFolder, finalFileName);
    const outputStream = fs.createWriteStream(outputPath);
    
    let currentChunk = 0;
    
    // Function to process each chunk in order
    const processChunk = () => {
        if (currentChunk >= parseInt(totalChunks)) {
            // All chunks processed
            outputStream.end();
            
            // Clean up temp chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(tempDir, `${fileId}-chunk-${i}`);
                if (fs.existsSync(chunkPath)) {
                    fs.unlinkSync(chunkPath);
                }
            }
            
            // Get file stats for response
            fs.stat(outputPath, (err, stats) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    success: true,
                    id: finalFileName,
                    name: fileName,
                    size: stats.size,
                    timestamp: new Date()
                });
            });
            
            return;
        }
        
        const chunkPath = path.join(tempDir, `${fileId}-chunk-${currentChunk}`);
        
        // Check if chunk exists
        if (!fs.existsSync(chunkPath)) {
            return res.status(400).json({ 
                error: `Chunk ${currentChunk} is missing` 
            });
        }
        
        // Read chunk and append to output file
        const chunkStream = fs.createReadStream(chunkPath);
        
        chunkStream.on('end', () => {
            currentChunk++;
            processChunk();
        });
        
        chunkStream.on('error', (err) => {
            outputStream.end();
            return res.status(500).json({ error: err.message });
        });
        
        chunkStream.pipe(outputStream, { end: false });
    };
    
    // Start processing chunks
    processChunk();
});

// Download a file
app.get('/api/download/:id(*)', (req, res) => {
    const filePath = path.join(STORAGE_PATH, req.params.id);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Get the filename
        const filename = path.basename(filePath);
        
        // Extract original filename for the download if it follows our naming pattern
        let originalFilename = filename;
        if (filename.includes('-')) {
            try {
                originalFilename = filename.substring(filename.indexOf('-', filename.indexOf('-') + 1) + 1);
            } catch (e) {
                // If parsing fails, use the original name
                originalFilename = filename;
            }
        }
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
        res.sendFile(filePath);
    });
});

// Delete a file or folder
app.delete('/api/files/:id', async (req, res) => {
    try {
        const itemPath = path.join(STORAGE_PATH, req.params.id);
        const stats = await fsPromises.stat(itemPath);
        
        if (stats.isDirectory()) {
            // This is a folder - delete recursively
            await fsPromises.rm(itemPath, { recursive: true, force: true });
            res.json({ success: true, message: 'Folder deleted successfully' });
        } else {
            // This is a file
            await fsPromises.unlink(itemPath);
            res.json({ success: true, message: 'File deleted successfully' });
        }
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create a new folder
app.post('/api/folders', async (req, res) => {
    try {
        const { name, parent } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        // Sanitize folder name to prevent path traversal
        const sanitizedName = name.replace(/[/\\?%*:|"<>]/g, '-');
        const parentPath = parent || '';
        const folderPath = path.join(STORAGE_PATH, parentPath, sanitizedName);
        
        // Check if folder already exists
        if (fs.existsSync(folderPath)) {
            return res.status(400).json({ error: 'Folder already exists' });
        }
        
        // Create the folder
        await fsPromises.mkdir(folderPath, { recursive: true });
        
        // Return folder information
        res.json({
            success: true,
            id: path.join(parentPath, sanitizedName),
            name: sanitizedName,
            isFolder: true,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('Error creating folder:', err);
        res.status(500).json({ error: err.message });
    }
});

// Move a file or folder
app.post('/api/move', async (req, res) => {
    try {
        const { itemId, destination } = req.body;
        
        if (!itemId || destination === undefined) {
            return res.status(400).json({ error: 'Item ID and destination are required' });
        }
        
        const sourcePath = path.join(STORAGE_PATH, itemId);
        const fileName = path.basename(sourcePath);
        const destinationPath = path.join(STORAGE_PATH, destination, fileName);
        
        // Check if source exists
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: 'Source item not found' });
        }
        
        // Check if destination folder exists
        const destinationDir = path.dirname(destinationPath);
        if (!fs.existsSync(destinationDir)) {
            await fsPromises.mkdir(destinationDir, { recursive: true });
        }
        
        // Move the item
        await fsPromises.rename(sourcePath, destinationPath);
        
        res.json({
            success: true,
            message: 'Item moved successfully',
            newPath: path.join(destination, fileName)
        });
    } catch (err) {
        console.error('Error moving item:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Files are being stored at: ${STORAGE_PATH}`);
});
