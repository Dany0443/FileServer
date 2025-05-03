const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
// Removed zlib as we don't want compression
const fastify = require('fastify')({ 
    logger: true,
    keepAliveTimeout: 600000, // 10 minutes (600,000 ms)
    requestTimeout: 0, // No request timeout
    bodyLimit: 20 * 1024 * 1024 * 1024, // 20GB body size limit
    maxParamLength: 1048576, // Increase max param length for large URLs if needed
    ignoreTrailingSlash: true,
    querystringParser: str => {
        const params = new URLSearchParams(str);
        const result = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    } // Ensure query parameters are properly parsed
});
const fastifyCors = require('@fastify/cors');
const fastifyMultipart = require('@fastify/multipart');


const PORT = process.env.PORT || 3445;

// Define storage location on another drive
const STORAGE_PATH = path.resolve(process.platform === 'win32' ? 'C:\\FSV' : '/mnt/hdd/storage');

// Create storage directory if it doesn't exist
if (!fs.existsSync(STORAGE_PATH)) {
    try {
        fs.mkdirSync(STORAGE_PATH, { recursive: true });
        console.log(`Storage directory created at ${STORAGE_PATH}`);
    } catch (err) {
        console.error(`Failed to create storage directory: ${err.message}`);
    }
}

// Storage path is configured for file uploads
// Maximum file size is set to 20GB in the fastifyMultipart registration

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

// All Express endpoints have been removed
// Using only Fastify endpoints below

fastify.register(fastifyCors);
fastify.register(fastifyMultipart, { limits: { fileSize: 20 * 1024 * 1024 * 1024 } });
fastify.addHook('preHandler', (request, reply, done) => {
    if (request.routerPath && request.routerPath.startsWith('/api') && request.routerPath !== '/api/login') {
        // Check for token in headers first, then in query parameters
        const headerToken = request.headers['x-auth-token'];
        const queryToken = request.query && request.query.token;
        const token = headerToken || queryToken;
        
        if (token && tokens[token]) {
            request.username = tokens[token].username;
            done();
        } else {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    } else {
        done();
    }
});
fastify.get('/api/files', async (request, reply) => {
    try {
        const files = await fs.promises.readdir(STORAGE_PATH);
        const fileList = await Promise.all(files.map(async filename => {
            const filePath = path.join(STORAGE_PATH, filename);
            try {
                const stats = await fs.promises.stat(filePath);
                const parts = filename.split('-');
                const originalFilename = parts.slice(2).join('-');
                return {
                    id: filename,
                    name: originalFilename,
                    size: stats.size,
                    type: path.extname(filename).substring(1),
                    timestamp: stats.mtime,
                    path: filePath
                };
            } catch {
                return null;
            }
        }));
        fileList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        reply.send(fileList.filter(Boolean));
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});
fastify.post('/api/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    
    // Simplified upload without compression
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + '-' + data.filename;
    const filePath = path.join(STORAGE_PATH, filename);
    const writeStream = fs.createWriteStream(filePath);
    
    await data.file.pipe(writeStream);
    await new Promise((resolve, reject) => writeStream.on('finish', resolve).on('error', reject));
    
    // Simple response without compression
    return reply.send({ 
        success: true, 
        id: filename, 
        name: data.filename, 
        size: writeStream.bytesWritten, 
        type: data.mimetype, 
        timestamp: new Date() 
    });
});
fastify.get('/api/download/:id', async (request, reply) => {
    const filename = request.params.id;
    const filePath = path.join(STORAGE_PATH, filename);
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        const parts = filename.split('-');
        const originalFilename = parts.slice(2).join('-');
        const stat = await fs.promises.stat(filePath);
        
        // Set headers for non-resumable download
        reply.raw.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFilename)}"`,
            'Content-Length': stat.size,
            // Removed Accept-Ranges header to disable resumable downloads
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        });
        
        // Simple stream without range support
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => {
            fastify.log.error(`Stream error: ${err.message}`);
            reply.raw.end();
        });
        stream.pipe(reply.raw);
    } catch (err) {
        fastify.log.error(`Download error: ${err.message}`);
        reply.status(404).send({ error: 'File not found or could not be accessed' });
    }
    return reply;
});
fastify.delete('/api/files/:id', async (request, reply) => {
    const fileId = request.params.id;
    const filePath = path.join(STORAGE_PATH, fileId);
    try {
        await fs.promises.unlink(filePath);
        reply.send({ success: true });
    } catch {
        reply.status(500).send({ error: 'Error deleting file' });
    }
});

// Serve the main HTML file
// Register static file serving
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname),
    prefix: '/' // optional: default '/'  
});

// Serve the main HTML file
fastify.get('/', async (request, reply) => {
    return reply.sendFile('index.html');
});

// Start Fastify server
fastify.listen({ port: PORT }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server running on ${address}`);
    console.log(`Files are being stored at: ${STORAGE_PATH}`);
    console.log(`Maximum file upload size: 20GB`);
});

// Add Fastify login endpoint using bcrypt
fastify.post('/api/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
        return reply.status(400).send({ error: 'Username and password required' });
    }
    const user = users.find(u => u.username === username);
    if (!user) {
        return reply.status(401).send({ error: 'Invalid username or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return reply.status(401).send({ error: 'Invalid username or password' });
    }
    // Generate token
    const token = Math.random().toString(36).substr(2) + Date.now().toString(36);
    tokens[token] = { username, created: Date.now() };
    saveTokens();
    reply.send({ token });
});
