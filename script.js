// Check authentication
function checkAuth() {
    if (localStorage.getItem('authenticated') !== 'true') {
        window.location.href = 'login.html';
    }
}

// Run auth check when page loads
checkAuth();

// Global variables
let currentView = 'list';
let files = [];

// DOM Elements
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const logoutBtn = document.getElementById('logoutBtn');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const mainContent = document.getElementById('mainContent');
const fileCount = document.getElementById('fileCount');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const uploadStatus = document.getElementById('uploadStatus');

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', uploadFile);
logoutBtn.addEventListener('click', logout);
listViewBtn.addEventListener('click', () => switchView('list'));
gridViewBtn.addEventListener('click', () => switchView('grid'));

// Fetch and display files
function loadFiles() {
    showLoading();

    fetch('/api/files', {
        headers: {
            'x-auth-token': localStorage.getItem('token') || ''
        }
    })
    .then(response => {
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return [];
        }
        return response.json();
    })
    .then(data => {
        files = data;
        hideLoading();
        updateFileCount();
        renderFiles();
    })
    .catch(error => {
        console.error('Error loading files:', error);
        hideLoading();
        showToast('Error loading files', 'error');
    });
}

// Upload file with progress tracking
function uploadFile() {
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('x-auth-token', localStorage.getItem('token') || '');

    // Show overlay and reset progress bar
    const progressOverlay = document.getElementById('progressOverlay');
    const progressBar = document.getElementById('progressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    progressOverlay.classList.remove('d-none');
    progressBar.style.width = '0%';
    uploadStatus.textContent = '';

    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = percentComplete + '%';
            uploadStatus.textContent = `Uploading: ${percentComplete}%`;
        }
    });

    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            uploadStatus.textContent = 'Upload complete!';
            setTimeout(() => {
                fileInput.value = '';
                progressOverlay.classList.add('d-none');
                loadFiles();
                showToast('File uploaded successfully', 'success');
            }, 1000);
        } else {
            uploadStatus.textContent = 'Upload failed!';
            setTimeout(() => {
                progressOverlay.classList.add('d-none');
            }, 2000);
        }
    });

    xhr.addEventListener('error', () => {
        uploadStatus.textContent = 'Upload error!';
        setTimeout(() => {
            progressOverlay.classList.add('d-none');
        }, 2000);
    });

    xhr.send(formData);
}

// Handle upload errors
function handleUploadError(message) {
    uploadStatus.textContent = message;
    showToast(message, 'error');
    
    // Hide progress after 3 seconds
    setTimeout(() => {
        progressContainer.style.display = 'none';
        fileInput.value = '';
    }, 3000);
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Switch between list and grid views
function switchView(view) {
    currentView = view;
    
    if (view === 'list') {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    } else {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    }
    
    renderFiles();
}

// Render files based on current view
function renderFiles() {
    // Remove loading spinner and any existing file views
    const existingContent = mainContent.querySelector('.files-list, .files-grid, .empty-state');
    if (existingContent) {
        mainContent.removeChild(existingContent);
    }
    
    // Show empty state if no files
    if (files.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-folder-open"></i>
            <h3>No files yet</h3>
            <p>Upload files to see them here</p>
        `;
        mainContent.appendChild(emptyState);
        return;
    }
    
    // Render based on current view
    if (currentView === 'list') {
        renderListView();
    } else {
        renderGridView();
    }
}

// Render list view
function renderListView() {
    const table = document.createElement('table');
    table.className = 'files-list';
    
    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Date</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    files.forEach(file => {
        const tr = document.createElement('tr');
        
        // Get file icon based on type
        const fileIcon = getFileIcon(file.type);
        
        // Format date
        const date = new Date(file.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        tr.innerHTML = `
            <td>
                <div class="file-item">
                    <div class="file-icon"><i class="${fileIcon}"></i></div>
                    <div class="file-name">${file.name}</div>
                </div>
            </td>
            <td>${formatFileSize(file.size)}</td>
            <td>${file.type || 'Unknown'}</td>
            <td>${formattedDate}</td>
            <td>
                <div class="file-actions">
                    <button class="file-action-btn download" data-id="${file.id}" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="file-action-btn delete" data-id="${file.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    mainContent.appendChild(table);
    
    // Add event listeners to action buttons
    addActionListeners();
}

// Render grid view
function renderGridView() {
    const grid = document.createElement('div');
    grid.className = 'files-grid';
    
    files.forEach(file => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        
        // Get file icon based on type
        const fileIcon = getFileIcon(file.type);
        
        // Format date
        const date = new Date(file.timestamp);
        const formattedDate = date.toLocaleDateString();
        
        gridItem.innerHTML = `
            <div class="file-preview">
                <div class="file-icon"><i class="${fileIcon}"></i></div>
            </div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-info">${formatFileSize(file.size)} · ${formattedDate}</div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn download" data-id="${file.id}" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                <button class="file-action-btn delete" data-id="${file.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        grid.appendChild(gridItem);
    });
    
    mainContent.appendChild(grid);
    
    // Add event listeners to action buttons
    addActionListeners();
}

// Add event listeners to file action buttons
function addActionListeners() {
    // Download buttons
    document.querySelectorAll('.file-action-btn.download').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadFile(button.getAttribute('data-id'));
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.file-action-btn.delete').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(button.getAttribute('data-id'));
        });
    });
    
    // Make grid items clickable for download
    if (currentView === 'grid') {
        document.querySelectorAll('.grid-item').forEach(item => {
            item.addEventListener('click', () => {
                const downloadBtn = item.querySelector('.file-action-btn.download');
                if (downloadBtn) {
                    downloadFile(downloadBtn.getAttribute('data-id'));
                }
            });
        });
    }
}

// Download a file
function downloadFile(id) {
    const token = localStorage.getItem('token') || '';
    fetch(`/api/download/${id}`, {
        headers: {
            'x-auth-token': token
        }
    })
    .then(response => {
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }
        if (!response.ok) {
            showToast('Download failed', 'error');
            return;
        }
        return response.blob();
    })
    .then(blob => {
        if (!blob) return;
        // Get the file name from the files array
        const file = files.find(f => f.id === id);
        const filename = file ? file.name : 'downloaded_file';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        showToast('Download error', 'error');
    });
}

// Delete a file
function deleteFile(id) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: {
            'x-auth-token': localStorage.getItem('token') || ''
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('File deleted successfully', 'success');
            loadFiles(); // Refresh file list
        } else {
            showToast('Error deleting file', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showToast('Error deleting file', 'error');
    });
}

// Get appropriate icon for file type
function getFileIcon(type) {
    if (!type) return 'fas fa-file';
    
    type = type.toLowerCase();
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(type)) {
        return 'fas fa-file-image';
    }
    
    // Documents
    if (['pdf'].includes(type)) {
        return 'fas fa-file-pdf';
    }
    
    if (['doc', 'docx', 'odt', 'rtf'].includes(type)) {
        return 'fas fa-file-word';
    }
    
    if (['xls', 'xlsx', 'ods', 'csv'].includes(type)) {
        return 'fas fa-file-excel';
    }
    
    if (['ppt', 'pptx', 'odp'].includes(type)) {
        return 'fas fa-file-powerpoint';
    }
    
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) {
        return 'fas fa-file-archive';
    }
    
    // Audio
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(type)) {
        return 'fas fa-file-audio';
    }
    
    // Video
    if (['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm'].includes(type)) {
        return 'fas fa-file-video';
    }
    
    // Code
    if (['html', 'css', 'js', 'php', 'py', 'java', 'c', 'cpp', 'cs', 'rb', 'go', 'ts', 'json', 'xml'].includes(type)) {
        return 'fas fa-file-code';
    }
    
    // Text
    if (['txt', 'md', 'log'].includes(type)) {
        return 'fas fa-file-alt';
    }
    
    // Default
    return 'fas fa-file';
}

// Show loading spinner
function showLoading() {
    const loading = mainContent.querySelector('.loading');
    if (loading) {
        loading.style.display = 'flex';
    }
}

// Hide loading spinner
function hideLoading() {
    const loading = mainContent.querySelector('.loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Update file count display
function updateFileCount() {
    fileCount.textContent = files.length === 1 ? '1 file' : `${files.length} files`;
}

// Show toast notification
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    
    if (type) {
        toast.classList.add(type);
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
});