// Check if user is already logged in
function checkAuth() {
    if (localStorage.getItem('token')) {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 300);
    }
}
checkAuth();

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem('token', data.token);
            window.location.href = 'index.html';
        } else {
            showError(data.error || 'Login failed');
        }
    })
    .catch(() => {
        errorMessage.style.display = 'block';
        document.getElementById('password').value = '';
    });
});

// Logout logic (if present)
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    localStorage.removeItem('token');
    window.location.reload();
});

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    document.getElementById('password').value = '';
}