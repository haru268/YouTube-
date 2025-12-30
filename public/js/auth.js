// 認証関連の共通関数

function checkAuth() {
  return fetch('/api/channel')
    .then(response => {
      if (response.status === 401 || response.redirected) {
        window.location.href = '/login.html';
        return false;
      }
      return true;
    })
    .catch(() => {
      window.location.href = '/login.html';
      return false;
    });
}

function logout() {
  fetch('/api/logout', { method: 'POST' })
    .then(() => {
      window.location.href = '/login.html';
    })
    .catch(() => {
      window.location.href = '/login.html';
    });
}

function apiRequest(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'
  });
}

