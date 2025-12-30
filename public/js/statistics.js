// 統計ページ

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStatistics();
});

async function loadStatistics() {
  try {
    const response = await apiRequest('/api/statistics');
    const stats = await response.json();

    const content = document.getElementById('statisticsContent');
    
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <h3>動画予定</h3>
          <div class="stat-value">${stats.plans?.total || 0}</div>
          <div class="stat-label">総数</div>
        </div>
        <div class="stat-card">
          <h3>投稿済み</h3>
          <div class="stat-value">${stats.plans?.posted || 0}</div>
          <div class="stat-label">${stats.plans?.total ? Math.round((stats.plans.posted / stats.plans.total) * 100) : 0}%</div>
        </div>
        <div class="stat-card">
          <h3>未投稿</h3>
          <div class="stat-value">${stats.plans?.not_posted || 0}</div>
          <div class="stat-label">${stats.plans?.total ? Math.round((stats.plans.not_posted / stats.plans.total) * 100) : 0}%</div>
        </div>
        <div class="stat-card">
          <h3>投稿済み動画</h3>
          <div class="stat-value">${stats.videos?.total || 0}</div>
          <div class="stat-label">総数</div>
        </div>
        <div class="stat-card">
          <h3>総視聴回数</h3>
          <div class="stat-value">${formatNumber(stats.videos?.total_views || 0)}</div>
          <div class="stat-label">回</div>
        </div>
        <div class="stat-card">
          <h3>総いいね数</h3>
          <div class="stat-value">${formatNumber(stats.videos?.total_likes || 0)}</div>
          <div class="stat-label">回</div>
        </div>
        <div class="stat-card">
          <h3>平均視聴回数</h3>
          <div class="stat-value">${formatNumber(Math.round(stats.videos?.avg_views || 0))}</div>
          <div class="stat-label">回/動画</div>
        </div>
        <div class="stat-card">
          <h3>平均いいね数</h3>
          <div class="stat-value">${formatNumber(Math.round(stats.videos?.avg_likes || 0))}</div>
          <div class="stat-label">回/動画</div>
        </div>
      </div>

      <div class="chart-section">
        <h3>月別投稿数</h3>
        <div class="monthly-chart">
          ${stats.monthlyPosts && stats.monthlyPosts.length > 0 ? renderMonthlyChart(stats.monthlyPosts) : '<p style="color: #999999; text-align: center;">データがありません</p>'}
        </div>
      </div>

      <div class="chart-section">
        <h3>トップ動画（視聴回数順）</h3>
        <div class="top-videos-list">
          ${stats.topVideos && stats.topVideos.length > 0 ? renderTopVideos(stats.topVideos) : '<p style="color: #999999; text-align: center;">データがありません</p>'}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('統計データの読み込みエラー:', error);
    const content = document.getElementById('statisticsContent');
    content.innerHTML = '<div class="empty-state">統計データの読み込みに失敗しました</div>';
  }
}

function renderMonthlyChart(monthlyPosts) {
  const maxCount = Math.max(...monthlyPosts.map(p => p.count || 0), 1);
  
  return monthlyPosts.map((post, index) => {
    const height = ((post.count || 0) / maxCount) * 100;
    const monthLabel = post.month ? post.month.replace('-', '年').replace('-', '月') : '';
    return `
      <div class="month-bar">
        <div class="bar-value">${post.count || 0}</div>
        <div class="bar" style="height: ${height}%;" title="${monthLabel}: ${post.count || 0}件"></div>
        <div class="month-label">${monthLabel}</div>
      </div>
    `;
  }).join('');
}

function renderTopVideos(videos) {
  return videos.map((video, index) => `
    <div class="top-video-item">
      <div class="top-video-rank">${index + 1}</div>
      <div class="top-video-info">
        <div class="top-video-title">${escapeHtml(video.title)}</div>
        <div class="top-video-stats">
          👁 ${formatNumber(video.view_count || 0)} | 👍 ${formatNumber(video.like_count || 0)} | 
          ${video.type} | ${video.published_at ? formatDate(video.published_at) : '-'}
        </div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
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

