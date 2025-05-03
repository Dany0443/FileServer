// Check authentication
function checkAuth() {
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
    }
}

// Run auth check when page loads
checkAuth();

// Global variables
let files = [];

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const logoutBtn = document.getElementById('logoutBtn');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const mainContent = document.getElementById('mainContent');
const fileCount = document.getElementById('fileCount');
const uploadProgress = document.getElementById('upload-progress');
const uploadStatus = document.getElementById('upload-status');

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', uploadFile);
logoutBtn.addEventListener('click', logout);
listViewBtn.addEventListener('click', () => switchView('list'));
gridViewBtn.addEventListener('click', () => switchView('grid'));

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load files when the page is ready
    loadFiles();
});

// Fetch and display files
function loadFiles() {
    showLoading();
    fetchFiles();
}

// Logout function
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'x-auth-token': localStorage.getItem('token') || ''
        }
    })
    .then(() => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    })
    .catch(error => {
        console.error('Logout error:', error);
        // Still remove token and redirect even if server logout fails
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

// Upload file function
function uploadFile() {
    const file = fileInput.files[0];
    if (!file) {
        showToast('No file selected', 'error');
        return;
    }

    // Show progress overlay
    let progressOverlay = document.querySelector('.progress-overlay');
    if (!progressOverlay) {
        progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay';
        progressOverlay.innerHTML = `
            <div class="progress-bar-box">
                <div class="progress-label">Uploading...</div>
                <div class="progress-bar-outer">
                    <div class="progress-bar-inner" style="width:0%"></div>
                </div>
                <div class="upload-status"></div>
            </div>
        `;
        document.body.appendChild(progressOverlay);
    }
    progressOverlay.classList.remove('d-none');
    const progressBar = progressOverlay.querySelector('.progress-bar-inner');
    const uploadStatus = progressOverlay.querySelector('.upload-status');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('x-auth-token', localStorage.getItem('token') || '');

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            uploadStatus.textContent = percent + '%';
        }
    };

    xhr.onload = function () {
        progressOverlay.classList.add('d-none');
        if (xhr.status === 200) {
            showToast('File uploaded successfully', 'success');
            fileInput.value = '';
            loadFiles();
        } else if (xhr.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        } else {
            showToast('Error uploading file', 'error');
        }
    };

    xhr.onerror = function () {
        progressOverlay.classList.add('d-none');
        showToast('Error uploading file', 'error');
    };

    xhr.send(formData);
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

// Show loading spinner
function showLoading() {
    mainContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

// Hide loading spinner
function hideLoading() {
    const loading = mainContent.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

// Update file count display
function updateFileCount() {
    fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
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

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Fetch files from server
function fetchFiles() {
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

// Render files based on current view
function renderFiles() {
    // Remove any existing file views
    const existingContent = mainContent.querySelector('.files-list, .files-grid, .empty-state');
    if (existingContent) {
        existingContent.remove();
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
        tr.innerHTML = `
            <td>
                <div class="file-item">
                    <i class="fas fa-file file-icon"></i>
                    <span class="file-name">${file.name}</span>
                </div>
            </td>
            <td>${formatFileSize(file.size)}</td>
            <td>${file.type || 'Unknown'}</td>
            <td>${formatDate(file.timestamp)}</td>
            <td>
                <div class="file-actions">
                    <button class="file-action-btn download" onclick="downloadFile('${file.id}', '${file.name.replace(/'/g, "\\'")}')">                        <i class="fas fa-download"></i>
                    </button>
                    <button class="file-action-btn delete" onclick="deleteFile('${file.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    mainContent.appendChild(table);
}

// Render grid view
function renderGridView() {
    const grid = document.createElement('div');
    grid.className = 'files-grid';
    
    files.forEach(file => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.innerHTML = `
            <div class="file-preview">
                <i class="fas fa-file file-icon"></i>
            </div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-info">${formatFileSize(file.size)} · ${formatDate(file.timestamp)}</div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn download" onclick="downloadFile('${file.id}', '${file.name.replace(/'/g, "\\'")}')">                        <i class="fas fa-download"></i>
                </button>
                <button class="file-action-btn delete" onclick="deleteFile('${file.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        grid.appendChild(gridItem);
    });
    
    mainContent.appendChild(grid);
}

// Download file - simplified for direct downloads without resuming
function downloadFile(fileId, fileName) {
    // Show toast notification that download is starting
    showToast('Starting download...', 'info');
    
    // Create a direct download link
    const token = localStorage.getItem('token') || '';
    const downloadUrl = `/api/download/${fileId}?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(fileName)}`;
    
    // Create a temporary anchor element to trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName; // Set the download attribute
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // Trigger the download
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(downloadLink);
    }, 100);
    
    // Inform user that if download fails, they need to try again
    setTimeout(() => {
        showToast('If download fails, please try again', 'info');
    }, 3000);
}

// Delete file
function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
            'x-auth-token': localStorage.getItem('token') || ''
        }
    })
    .then(response => {
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            throw new Error('Unauthorized');
        }
        return response.json();
    })
    .then(data => {
        showToast('File deleted successfully', 'success');
        loadFiles(); // Refresh file list
    })
    .catch(error => {
        console.error('Delete error:', error);
        showToast('Error deleting file', 'error');
    });
}

// Set default view based on device width
let currentView;
if (window.innerWidth <= 480) {
    currentView = 'grid';
} else {
    currentView = 'list';
}