// 設定ページ

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadChannelSettings();
  await loadUserInfo();
  setupEventListeners();
});

function setupEventListeners() {
  const channelForm = document.getElementById('channelForm');
  const usernameForm = document.getElementById('usernameForm');
  const passwordForm = document.getElementById('passwordForm');
  const selectImageBtn = document.getElementById('selectImageBtn');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const channelImageFile = document.getElementById('channelImageFile');
  const channelImageUrlInput = document.getElementById('channelImageUrlInput');

  channelForm.addEventListener('submit', handleChannelSubmit);
  usernameForm.addEventListener('submit', handleUsernameSubmit);
  passwordForm.addEventListener('submit', handlePasswordSubmit);
  
  selectImageBtn.addEventListener('click', () => {
    channelImageFile.click();
  });

  channelImageFile.addEventListener('change', handleImageFileSelect);
  removeImageBtn.addEventListener('click', handleRemoveImage);
  
  channelImageUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      document.getElementById('channelImageUrl').value = url;
      updateImagePreview(url);
    }
  });
  
  channelImageUrlInput.addEventListener('blur', (e) => {
    const url = e.target.value.trim();
    if (!url) {
      // URL入力が空の場合は、隠しフィールドの値を確認
      const hiddenUrl = document.getElementById('channelImageUrl').value;
      if (!hiddenUrl) {
        clearImagePreview();
      }
    }
  });
}

async function loadChannelSettings() {
  try {
    const response = await apiRequest('/api/channel');
    const channel = await response.json();

    if (channel) {
      document.getElementById('channelName').value = channel.channel_name || '';
      document.getElementById('channelUrl').value = channel.channel_url || '';
      
      if (channel.channel_image_url) {
        document.getElementById('channelImageUrl').value = channel.channel_image_url;
        document.getElementById('channelImageUrlInput').value = channel.channel_image_url;
        updateImagePreview(channel.channel_image_url);
      }
    }
  } catch (error) {
    console.error('チャンネル設定の読み込みエラー:', error);
  }
}

async function loadUserInfo() {
  try {
    const response = await apiRequest('/api/user-info');
    const userInfo = await response.json();

    if (userInfo && userInfo.username) {
      document.getElementById('newUsername').value = userInfo.username;
    }
  } catch (error) {
    console.error('ユーザー情報の読み込みエラー:', error);
  }
}

async function handleUsernameSubmit(e) {
  e.preventDefault();

  const newUsername = document.getElementById('newUsername').value.trim();
  const messageEl = document.getElementById('usernameMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!newUsername) {
    showMessage(messageEl, 'ユーザー名を入力してください', 'error');
    return;
  }

  if (newUsername.length < 3) {
    showMessage(messageEl, 'ユーザー名は3文字以上にしてください', 'error');
    return;
  }

  showLoading(submitBtn, '変更中...');

  try {
    const response = await apiRequest('/api/change-username', {
      method: 'POST',
      body: JSON.stringify({ newUsername })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage(messageEl, 'ユーザー名を変更しました', 'success');
      // セッションを更新
      if (data.username) {
        // ページをリロードして反映
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } else {
      showMessage(messageEl, data.error || 'ユーザー名変更に失敗しました', 'error');
    }
  } catch (error) {
    console.error('ユーザー名変更エラー:', error);
    let errorMessage = 'ユーザー名変更中にエラーが発生しました';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    showMessage(messageEl, errorMessage, 'error');
  } finally {
    hideLoading(submitBtn);
  }
}

function handleImageFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    showErrorMessage('ファイルサイズは5MB以下にしてください');
    return;
  }

  // 画像タイプチェック
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showErrorMessage('画像ファイルのみアップロード可能です（jpeg, jpg, png, gif, webp）');
    return;
  }

  uploadImage(file);
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      document.getElementById('channelImageUrl').value = data.imageUrl;
      document.getElementById('channelImageUrlInput').value = data.imageUrl;
      updateImagePreview(data.imageUrl);
      document.getElementById('removeImageBtn').style.display = 'inline-block';
      showSuccessMessage('画像をアップロードしました');
    } else {
      showErrorMessage(data.error || '画像のアップロードに失敗しました');
    }
  } catch (error) {
    console.error('画像アップロードエラー:', error);
    showErrorMessage('画像のアップロード中にエラーが発生しました');
  }
}

function updateImagePreview(imageUrl) {
  const preview = document.getElementById('channelImagePreview');
  if (imageUrl) {
    preview.src = imageUrl;
    preview.style.display = 'block';
    document.getElementById('removeImageBtn').style.display = 'inline-block';
  } else {
    clearImagePreview();
  }
}

function clearImagePreview() {
  const preview = document.getElementById('channelImagePreview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('removeImageBtn').style.display = 'none';
  document.getElementById('channelImageFile').value = '';
}

function handleRemoveImage() {
  document.getElementById('channelImageUrl').value = '';
  document.getElementById('channelImageUrlInput').value = '';
  clearImagePreview();
}

async function handleChannelSubmit(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  showLoading(submitBtn, '保存中...');

  // 画像URLは、隠しフィールドまたはURL入力フィールドから取得
  let imageUrl = document.getElementById('channelImageUrl').value;
  const urlInput = document.getElementById('channelImageUrlInput').value.trim();
  
  // URL入力フィールドに値があれば、そちらを優先（ユーザーが手動で入力した場合）
  if (urlInput) {
    imageUrl = urlInput;
  }

  const channelData = {
    channel_name: document.getElementById('channelName').value.trim(),
    channel_url: document.getElementById('channelUrl').value.trim(),
    channel_image_url: imageUrl
  };

  // バリデーション
  if (!channelData.channel_name) {
    showErrorMessage('チャンネル名を入力してください');
    hideLoading(submitBtn);
    return;
  }
  
  if (!channelData.channel_url) {
    showErrorMessage('チャンネルURLを入力してください');
    hideLoading(submitBtn);
    return;
  }

  try {
    const response = await apiRequest('/api/channel', {
      method: 'POST',
      body: JSON.stringify(channelData)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showSuccessMessage('チャンネル情報を保存しました');
      // 保存後、両方のフィールドを同期
      document.getElementById('channelImageUrl').value = imageUrl;
      document.getElementById('channelImageUrlInput').value = imageUrl;
    } else {
      showErrorMessage(data.error || '保存に失敗しました');
    }
  } catch (error) {
    console.error('保存エラー:', error);
    showErrorMessage('保存中にエラーが発生しました');
  } finally {
    hideLoading(submitBtn);
  }
}

async function handlePasswordSubmit(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const messageEl = document.getElementById('passwordMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (newPassword !== confirmPassword) {
    showMessage(messageEl, '新しいパスワードが一致しません', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showMessage(messageEl, 'パスワードは6文字以上にしてください', 'error');
    return;
  }

  showLoading(submitBtn, '変更中...');

  try {
    const response = await apiRequest('/api/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage(messageEl, 'パスワードを変更しました', 'success');
      document.getElementById('passwordForm').reset();
    } else {
      showMessage(messageEl, data.error || 'パスワード変更に失敗しました', 'error');
    }
  } catch (error) {
    console.error('パスワード変更エラー:', error);
    showMessage(messageEl, 'パスワード変更中にエラーが発生しました', 'error');
  } finally {
    hideLoading(submitBtn);
  }
}

