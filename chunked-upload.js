/**
 * Chunked File Upload Utility
 * Handles large file uploads by splitting them into manageable chunks
 */

const ChunkedUploader = {
    // Default chunk size: 10MB
    chunkSize: 10 * 1024 * 1024,
    
    /**
     * Upload a file in chunks
     * @param {File} file - The file to upload
     * @param {Object} options - Configuration options
     * @param {Function} options.onProgress - Progress callback (receives percentage)
     * @param {Function} options.onError - Error callback
     * @param {Function} options.onComplete - Complete callback (receives server response)
     */
    upload: function(file, options = {}) {
        const fileId = Date.now().toString();
        const totalChunks = Math.ceil(file.size / this.chunkSize);
        let currentChunk = 0;
        let uploadedBytes = 0;
        // Get current folder from the URL or default to root
        const currentFolder = window.location.hash.substring(1) || '';
        
        const uploadNextChunk = () => {
            if (currentChunk >= totalChunks) {
                // All chunks uploaded, complete the process
                this.completeUpload(fileId, file.name, totalChunks, options);
                return;
            }
            
            // Calculate the chunk boundaries
            const start = currentChunk * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            // Create form data for this chunk
            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('fileId', fileId);
            formData.append('chunkNumber', currentChunk);
            formData.append('totalChunks', totalChunks);
            formData.append('fileName', file.name);
            formData.append('folder', currentFolder);
            
            // Upload the chunk
            fetch('/api/upload-chunk', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to upload chunk');
                }
                return response.json();
            })
            .then(data => {
                // Update progress
                uploadedBytes += chunk.size;
                const percentComplete = Math.round((uploadedBytes / file.size) * 100);
                
                if (options.onProgress) {
                    options.onProgress(percentComplete);
                }
                
                // Upload next chunk
                currentChunk++;
                uploadNextChunk();
            })
            .catch(error => {
                console.error('Chunk upload error:', error);
                if (options.onError) {
                    options.onError(error);
                }
            });
        };
        
        // Start the upload process
        uploadNextChunk();
    },
    
    /**
     * Complete the upload by telling the server to combine all chunks
     */
    completeUpload: function(fileId, fileName, totalChunks, options) {
        // Get current folder from the URL or default to root
        const currentFolder = window.location.hash.substring(1) || '';
        
        fetch('/api/complete-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId,
                fileName,
                totalChunks,
                folder: currentFolder
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to complete upload');
            }
            return response.json();
        })
        .then(data => {
            if (options.onComplete) {
                options.onComplete(data);
            }
        })
        .catch(error => {
            console.error('Complete upload error:', error);
            if (options.onError) {
                options.onError(error);
            }
        });
    }
};

// Add to window object for global access
window.ChunkedUploader = ChunkedUploader;