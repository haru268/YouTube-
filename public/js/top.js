// トップページ

let currentVideoType = '';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadChannelInfo();
  await loadVideos();
  setupEventListeners();
});

function setupEventListeners() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVideoType = btn.dataset.type || '';
      loadVideos();
    });
  });

  const fetchVideosBtn = document.getElementById('fetchVideosBtn');
  if (fetchVideosBtn) {
    fetchVideosBtn.addEventListener('click', fetchYouTubeVideos);
  }
}

async function loadChannelInfo() {
  try {
    const response = await apiRequest('/api/channel');
    const channel = await response.json();

    const channelInfo = document.getElementById('channelInfo');
    if (!channel) {
      channelInfo.innerHTML = `
        <div class="message-box">
          <p>チャンネル情報が設定されていません。</p>
          <a href="settings.html" class="btn btn-primary">設定画面へ</a>
        </div>
      `;
      return;
    }

    channelInfo.innerHTML = `
      <div class="channel-card">
        ${channel.channel_image_url ? `<img src="${channel.channel_image_url}" alt="${channel.channel_name}" class="channel-image">` : ''}
        <div class="channel-details">
          <h3>${escapeHtml(channel.channel_name)}</h3>
          <a href="${channel.channel_url}" target="_blank" rel="noopener noreferrer">${channel.channel_url}</a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('チャンネル情報の読み込みエラー:', error);
  }
}

async function loadVideos() {
  try {
    const url = currentVideoType ? `/api/posted-videos?type=${currentVideoType}` : '/api/posted-videos';
    const response = await apiRequest(url);
    const videos = await response.json();

    const videosList = document.getElementById('videosList');
    if (!videos || videos.length === 0) {
      videosList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <h3>投稿済み動画がありません</h3>
          <p>「動画を追加」ボタンから新しい動画を追加するか、「YouTubeから取得」ボタンでYouTubeから動画を取得できます。</p>
        </div>
      `;
      return;
    }

    videosList.innerHTML = videos.map(video => {
      const needsUpdate = !video.published_at || !video.thumbnail_url;
      return `
      <div class="video-card">
        ${video.thumbnail_url ? `<img src="${video.thumbnail_url}" alt="${escapeHtml(video.title)}" class="video-thumbnail">` : '<div style="width:100%;aspect-ratio:16/9;background-color:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#999999;border-radius:4px;"><div>画像なし</div><div style="font-size:0.75rem;margin-top:0.5rem;color:#e65100;">※追記してください</div></div>'}
        <div class="video-content">
          <div class="video-header">
            <span class="video-type ${escapeHtml(video.type)}">${escapeHtml(video.type)}</span>
            ${video.type === 'ショート' && video.is_converted_to_video === 1 ? '<span style="font-size:0.75rem;background-color:#e3f2fd;color:#4a9eff;padding:0.2rem 0.4rem;border-radius:4px;margin-left:0.5rem;">動画変換済み</span>' : ''}
            <span style="font-size:0.75rem;background-color:#e0e0e0;color:#666666;padding:0.2rem 0.4rem;border-radius:4px;margin-left:0.5rem;">No.${video.no || 0}</span>
          </div>
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-stats">
            <span>👁 ${formatNumber(video.view_count || 0)}</span>
            <span>👍 ${formatNumber(video.like_count || 0)}</span>
          </div>
          <div class="video-date">${video.published_at ? formatDate(video.published_at) : '<span style="color:#e65100;">※投稿日を追記してください</span>'}</div>
          ${needsUpdate ? '<div style="margin-top:0.5rem;padding:0.5rem;background-color:#fff3e0;border:1px solid #ffb74d;border-radius:4px;color:#e65100;font-size:0.85rem;">※投稿日とサムネイル画像を追記してください</div>' : ''}
          ${video.url ? `<a href="${video.url}" target="_blank" rel="noopener noreferrer" class="video-link">YouTubeで見る →</a>` : ''}
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

async function fetchYouTubeVideos() {
  // YouTube APIの使用は課金が必要なため、現在は利用できません
  showErrorMessage(
    'YouTube APIの利用には課金が必要なため、現在この機能は使用できません。\n' +
    '動画情報は「投稿済み動画」ページから手動で追加してください。'
  );
  return;
  
  // 以下は将来APIが利用可能になった場合のコード（現在は実行されません）
  /*
  try {
    const response = await apiRequest('/api/channel');
    const channel = await response.json();

    if (!channel) {
      showErrorMessage('まずチャンネル情報を設定してください');
      setTimeout(() => {
        window.location.href = 'settings.html';
      }, 2000);
      return;
    }

    const fetchVideosBtn = document.getElementById('fetchVideosBtn');
    showLoading(fetchVideosBtn, '取得中...');

    const fetchResponse = await apiRequest('/api/fetch-youtube-videos', {
      method: 'POST',
      body: JSON.stringify({ channel_url: channel.channel_url })
    });

    const data = await fetchResponse.json();

    if (fetchResponse.ok && data.success) {
      showSuccessMessage(`${data.count}件の動画を取得しました`);
      await loadVideos();
    } else {
      showErrorMessage(data.error || '動画の取得に失敗しました');
    }
  } catch (error) {
    console.error('YouTube動画取得エラー:', error);
    showErrorMessage('動画の取得中にエラーが発生しました');
  } finally {
    const fetchVideosBtn = document.getElementById('fetchVideosBtn');
    if (fetchVideosBtn) {
      hideLoading(fetchVideosBtn);
    }
  }
  */
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

