const { spawn } = require('child_process');
const path = require('path');

// Set Node.js options for large file operations
process.env.NODE_OPTIONS = "--max-old-space-size=4096 --max-http-header-size=16384 --no-warnings";

// Start the server with optimized garbage collection
const serverProcess = spawn('node', [
  '--optimize-for-size',
  '--gc-interval=100',
  path.join(__dirname, 'server.js')
], {
  stdio: 'inherit'
});

serverProcess.on('error', (err) => {
  console.error('Failed to start server:', err);
});

serverProcess.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
});

console.log('Server starting...');