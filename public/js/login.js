// ログインページ

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = '/top.html';
      } else {
        showError(errorMessage, data.error || 'ログインに失敗しました');
      }
    } catch (error) {
      showError(errorMessage, '通信エラーが発生しました');
    }
  });
});

