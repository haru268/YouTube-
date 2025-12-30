// 投稿済み動画管理ページ

let currentVideoType = '';
let editingId = null;
let selectedIds = new Set();
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadVideos();
  setupEventListeners();
});

function setupEventListeners() {
  const addVideoBtn = document.getElementById('addVideoBtn');
  const modal = document.getElementById('videoModal');
  const closeModal = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const videoForm = document.getElementById('videoForm');
  const videoType = document.getElementById('videoType');
  const selectThumbnailBtn = document.getElementById('selectThumbnailBtn');
  const removeThumbnailBtn = document.getElementById('removeThumbnailBtn');
  const thumbnailFile = document.getElementById('thumbnailFile');

  if (addVideoBtn) {
    addVideoBtn.addEventListener('click', () => {
      editingId = null;
      openModal();
    });
  }

  if (closeModal) {
    closeModal.addEventListener('click', closeModalHandler);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModalHandler);
  }

  if (videoForm) {
    videoForm.addEventListener('submit', handleFormSubmit);
  }

  if (videoType) {
    videoType.addEventListener('change', () => {
    const shortOptions = document.getElementById('shortOptions');
    if (videoType.value === 'ショート') {
      shortOptions.style.display = 'block';
    } else {
      shortOptions.style.display = 'none';
      document.getElementById('isConvertedToVideo').checked = false;
    }
  });

  selectThumbnailBtn.addEventListener('click', () => {
    thumbnailFile.click();
  });

  thumbnailFile.addEventListener('change', handleThumbnailFileSelect);
  removeThumbnailBtn.addEventListener('click', handleRemoveThumbnail);

  const filterButtons = document.querySelectorAll('.filter-tabs .tab-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVideoType = btn.dataset.type || '';
      loadVideos();
    });
  });

  // 検索機能（デバウンス処理）
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const debouncedSearch = typeof debounce === 'function' 
      ? debounce((value) => {
          searchQuery = value;
          loadVideos();
        }, 300)
      : (() => {
          let timeout;
          return (value) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              searchQuery = value;
              loadVideos();
            }, 300);
          };
        })();
    
    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });
  }

  // 一括操作ボタン
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.video-checkbox:not(:checked)');
      checkboxes.forEach(cb => {
        cb.checked = true;
        selectedIds.add(parseInt(cb.value));
      });
      updateBulkButtons();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      selectedIds.clear();
      document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
      updateBulkButtons();
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }
}

function openModal(video = null) {
  const modal = document.getElementById('videoModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('videoForm');

  if (video) {
    editingId = video.id;
    modalTitle.textContent = '動画の編集';
    document.getElementById('videoId').value = video.id;
    document.getElementById('videoNo').value = video.no || '';
    document.getElementById('videoType').value = video.type || '動画';
    document.getElementById('videoTitle').value = video.title || '';
    
    if (video.published_at) {
      const date = new Date(video.published_at);
      document.getElementById('videoPublishedAt').value = date.toISOString().split('T')[0];
    }
    
    document.getElementById('thumbnailUrl').value = video.thumbnail_url || '';
    if (video.thumbnail_url) {
      updateThumbnailPreview(video.thumbnail_url);
    }
    
    document.getElementById('videoUrl').value = video.url || '';
    document.getElementById('videoViewCount').value = video.view_count || '';
    document.getElementById('videoLikeCount').value = video.like_count || '';
    document.getElementById('isConvertedToVideo').checked = video.is_converted_to_video === 1;
    document.getElementById('isPublic').checked = video.is_public !== 0;

    const shortOptions = document.getElementById('shortOptions');
    if (video.type === 'ショート') {
      shortOptions.style.display = 'block';
    } else {
      shortOptions.style.display = 'none';
    }
  } else {
    editingId = null;
    modalTitle.textContent = '動画の追加';
    form.reset();
    document.getElementById('videoId').value = '';
    document.getElementById('isPublic').checked = true;
    clearThumbnailPreview();
    document.getElementById('shortOptions').style.display = 'none';
  }

  modal.classList.add('show');
  
  // キーボードナビゲーション設定
  const firstInput = document.getElementById('videoTitle') || document.getElementById('videoNo');
  if (typeof setupModalFocus === 'function') {
    setupModalFocus(modal, firstInput);
  }
  
  // リアルタイムバリデーション設定
  setupFormValidation();
}

function closeModalHandler() {
  const modal = document.getElementById('videoModal');
  modal.classList.remove('show');
  editingId = null;
  
  // バリデーションエラーをクリア
  const errorElements = modal.querySelectorAll('.input-error');
  errorElements.forEach(el => el.classList.remove('show'));
  const inputs = modal.querySelectorAll('input, textarea');
  inputs.forEach(input => input.style.borderColor = '');
}

// フォームバリデーション設定
function setupFormValidation() {
  const titleInput = document.getElementById('videoTitle');
  const publishedAtInput = document.getElementById('videoPublishedAt');
  
  if (titleInput && typeof setupInputValidation === 'function') {
    setupInputValidation(titleInput, (value) => {
      if (!value.trim()) {
        return 'タイトルを入力してください';
      }
      if (value.length > 200) {
        return 'タイトルは200文字以内で入力してください';
      }
      return null;
    });
  }
  
  if (publishedAtInput && typeof setupInputValidation === 'function') {
    setupInputValidation(publishedAtInput, (value) => {
      if (!value) {
        return '投稿日を入力してください';
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return '有効な日付を入力してください';
      }
      return null;
    });
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById('videoTitle');
  const publishedAtInput = document.getElementById('videoPublishedAt');
  
  // バリデーション
  if (!titleInput.value.trim()) {
    showErrorMessage('タイトルを入力してください');
    titleInput.focus();
    return;
  }
  
  if (!publishedAtInput.value) {
    showErrorMessage('投稿日を入力してください');
    publishedAtInput.focus();
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  showLoading(submitBtn, '保存中...');

  const viewCount = document.getElementById('videoViewCount').value;
  const likeCount = document.getElementById('videoLikeCount').value;
  
  const videoData = {
    no: parseInt(document.getElementById('videoNo').value) || 0,
    type: document.getElementById('videoType').value,
    title: titleInput.value.trim(),
    published_at: publishedAtInput.value,
    thumbnail_url: document.getElementById('thumbnailUrl').value,
    url: document.getElementById('videoUrl').value.trim() || '',
    view_count: viewCount ? parseInt(viewCount) : 0,
    like_count: likeCount ? parseInt(likeCount) : 0,
    is_converted_to_video: document.getElementById('isConvertedToVideo').checked,
    is_public: document.getElementById('isPublic').checked
  };

  try {
    let response;
    if (editingId) {
      response = await apiRequest(`/api/posted-videos/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(videoData)
      });
    } else {
      response = await apiRequest('/api/posted-videos', {
        method: 'POST',
        body: JSON.stringify(videoData)
      });
    }

    const data = await response.json();

    if (response.ok && data.success) {
      showSuccessMessage(editingId ? '動画を更新しました' : '動画を追加しました');
      closeModalHandler();
      await loadVideos();
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

async function loadVideos() {
  try {
    let url = '/api/posted-videos';
    const params = [];
    
    if (currentVideoType) {
      params.push(`type=${encodeURIComponent(currentVideoType)}`);
    }
    
    if (searchQuery) {
      params.push(`search=${encodeURIComponent(searchQuery)}`);
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    const response = await apiRequest(url);
    const videos = await response.json();

    const videosList = document.getElementById('videosList');
    if (!videos || videos.length === 0) {
      videosList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <h3>投稿済み動画がありません</h3>
          <p>「新規追加」ボタンから新しい動画を追加してください。</p>
        </div>
      `;
      return;
    }

    videosList.innerHTML = videos.map(video => {
      const needsUpdate = !video.published_at || !video.thumbnail_url;
      return `
      <div class="video-item">
        <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
          <input type="checkbox" class="video-checkbox" value="${video.id}" 
            ${selectedIds.has(video.id) ? 'checked' : ''}
            onchange="toggleVideoSelection(${video.id}, this.checked)"
            style="margin-top: 0.3rem; cursor: pointer;">
          <div style="flex: 1; display: flex; gap: 1.5rem;">
            <div class="video-thumbnail-wrapper">
              ${video.thumbnail_url ? `<img src="${escapeHtml(video.thumbnail_url)}" alt="${escapeHtml(video.title)}">` : '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#999999;padding:1rem;text-align:center;"><div>画像なし</div><div style="font-size:0.75rem;margin-top:0.5rem;color:#e65100;">※追記してください</div></div>'}
            </div>
            <div class="video-content-wrapper">
              <div class="video-header-info">
                <span class="video-no">No.${video.no || 0}</span>
                <span class="video-type ${escapeHtml(video.type)}">${escapeHtml(video.type)}</span>
                ${video.type === 'ショート' && video.is_converted_to_video === 1 ? '<span class="video-converted-badge">動画変換済み</span>' : ''}
                <span class="video-status ${video.is_public === 1 ? '公開' : '非公開'}">${video.is_public === 1 ? '公開' : '非公開'}</span>
              </div>
              <div class="video-title">${escapeHtml(video.title)}</div>
              <div class="video-meta">
                <span>📅 ${video.published_at ? formatDate(video.published_at) : '<span style="color:#e65100;">※投稿日を追記してください</span>'}</span>
                ${video.url ? `<span>🔗 <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer" style="color:#4a9eff;">YouTube</a></span>` : ''}
              </div>
              ${needsUpdate ? '<div class="video-update-notice">※投稿日とサムネイル画像を追記してください</div>' : ''}
              <div class="video-actions">
                <button class="btn btn-secondary" onclick="editVideo(${video.id})">編集</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.id})">削除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  } catch (error) {
    console.error('動画の読み込みエラー:', error);
    const videosList = document.getElementById('videosList');
    videosList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>動画の読み込みに失敗しました</h3>
        <p>ページを再読み込みするか、しばらく時間をおいてから再度お試しください。</p>
      </div>
    `;
  }
}

async function editVideo(id) {
  try {
    const response = await apiRequest('/api/posted-videos');
    const videos = await response.json();
    const video = videos.find(v => v.id === id);
    if (video) {
      openModal(video);
    } else {
      showErrorMessage('動画が見つかりませんでした');
    }
  } catch (error) {
    console.error('動画の取得エラー:', error);
    showErrorMessage('動画の取得に失敗しました');
  }
}

async function deleteVideo(id) {
  showDeleteConfirm('この動画を削除しますか？この操作は取り消せません。', async () => {
    try {
      const response = await apiRequest(`/api/posted-videos/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccessMessage('動画を削除しました');
        await loadVideos();
      } else {
        showErrorMessage(data.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      showErrorMessage('削除中にエラーが発生しました');
    }
  });
}

function handleThumbnailFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showErrorMessage('ファイルサイズは5MB以下にしてください');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showErrorMessage('画像ファイルのみアップロード可能です（jpeg, jpg, png, gif, webp）');
    return;
  }

  uploadThumbnail(file);
}

async function uploadThumbnail(file) {
  const formData = new FormData();
  formData.append('thumbnail', file);

  try {
    const response = await fetch('/api/upload-thumbnail', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      document.getElementById('thumbnailUrl').value = data.imageUrl;
      updateThumbnailPreview(data.imageUrl);
      showSuccessMessage('画像をアップロードしました');
    } else {
      showErrorMessage(data.error || '画像のアップロードに失敗しました');
    }
  } catch (error) {
    console.error('画像アップロードエラー:', error);
    showErrorMessage('画像のアップロード中にエラーが発生しました');
  }
}

function updateThumbnailPreview(imageUrl) {
  const preview = document.getElementById('thumbnailPreview');
  if (imageUrl) {
    preview.src = imageUrl;
    preview.style.display = 'block';
    document.getElementById('removeThumbnailBtn').style.display = 'inline-block';
  } else {
    clearThumbnailPreview();
  }
}

function clearThumbnailPreview() {
  const preview = document.getElementById('thumbnailPreview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('removeThumbnailBtn').style.display = 'none';
  document.getElementById('thumbnailFile').value = '';
}

function handleRemoveThumbnail() {
  document.getElementById('thumbnailUrl').value = '';
  clearThumbnailPreview();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleVideoSelection(id, checked) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateBulkButtons();
}

function updateBulkButtons() {
  const count = selectedIds.size;
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  
  if (count > 0) {
    if (selectAllBtn) selectAllBtn.style.display = 'inline-block';
    if (deselectAllBtn) deselectAllBtn.style.display = 'inline-block';
    if (bulkDeleteBtn) {
      bulkDeleteBtn.style.display = 'inline-block';
      bulkDeleteBtn.textContent = `選択した項目を削除 (${count})`;
    }
  } else {
    if (selectAllBtn) selectAllBtn.style.display = 'none';
    if (deselectAllBtn) deselectAllBtn.style.display = 'none';
    if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'none';
  }
}

async function handleBulkDelete() {
  if (selectedIds.size === 0) {
    showErrorMessage('削除する項目を選択してください');
    return;
  }
  
  showDeleteConfirm(`選択した${selectedIds.size}件の動画を削除しますか？この操作は取り消せません。`, async () => {
    try {
      const response = await apiRequest('/api/posted-videos/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showSuccessMessage(`${data.count}件の動画を削除しました`);
        selectedIds.clear();
        await loadVideos();
      } else {
        showErrorMessage(data.error || '一括削除に失敗しました');
      }
    } catch (error) {
      console.error('一括削除エラー:', error);
      showErrorMessage('一括削除中にエラーが発生しました');
    }
  });
}
