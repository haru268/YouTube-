// カレンダーページ

let currentDate = new Date();

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
  renderCalendar();
});

function setupEventListeners() {
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('todayBtn');

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      renderCalendar();
    });
  }
}

async function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 月の最初の日と最後の日を取得
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // データを取得
  const plans = await loadPlans();
  const videos = await loadVideos();

  // カレンダーHTMLを生成
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  let html = `
    <div class="calendar-container">
      <div class="calendar-header">
        <div class="calendar-month">${year}年${monthNames[month]}</div>
      </div>
      <div class="calendar-grid">
  `;

  // 曜日ヘッダー
  dayNames.forEach(day => {
    html += `<div class="calendar-day-header">${day}</div>`;
  });

  // 前月の日付（空白を埋める）
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    html += renderDay(new Date(year, month - 1, day), true, plans, videos);
  }

  // 今月の日付
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    html += renderDay(date, false, plans, videos);
  }

  // 次月の日付（空白を埋める）
  const remainingDays = 42 - (startingDayOfWeek + daysInMonth); // 6週間分
  for (let day = 1; day <= remainingDays; day++) {
    html += renderDay(new Date(year, month + 1, day), true, plans, videos);
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderDay(date, isOtherMonth, plans, videos) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  const dateStr = date.toISOString().split('T')[0];
  const dateStrStart = dateStr + 'T00:00:00';
  const dateStrEnd = dateStr + 'T23:59:59';

  // その日のイベントを取得
  const dayPlans = plans.filter(plan => {
    if (plan.posted_at) {
      const postedDate = new Date(plan.posted_at).toISOString().split('T')[0];
      return postedDate === dateStr;
    }
    if (plan.reminder_date) {
      const reminderDate = new Date(plan.reminder_date).toISOString().split('T')[0];
      return reminderDate === dateStr;
    }
    return false;
  });

  const dayVideos = videos.filter(video => {
    if (video.published_at) {
      const publishedDate = new Date(video.published_at).toISOString().split('T')[0];
      return publishedDate === dateStr;
    }
    return false;
  });

  const reminders = plans.filter(plan => {
    if (plan.reminder_date) {
      const reminderDate = new Date(plan.reminder_date).toISOString().split('T')[0];
      return reminderDate === dateStr;
    }
    return false;
  });

  let html = `<div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">`;
  html += `<div class="calendar-day-number">${date.getDate()}</div>`;

  // リマインダー
  reminders.forEach(plan => {
    html += `<div class="calendar-event reminder" title="${escapeHtml(plan.title)}">🔔 ${escapeHtml(plan.title)}</div>`;
  });

  // 投稿済み動画
  dayVideos.forEach(video => {
    html += `<div class="calendar-event posted" title="${escapeHtml(video.title)}">📹 ${escapeHtml(video.title)}</div>`;
  });

  // 動画予定（投稿済み）
  dayPlans.forEach(plan => {
    html += `<div class="calendar-event plan" title="${escapeHtml(plan.title)}">📝 ${escapeHtml(plan.title)}</div>`;
  });

  const totalEvents = reminders.length + dayVideos.length + dayPlans.length;
  if (totalEvents > 3) {
    html += `<div class="event-count">他${totalEvents - 3}件</div>`;
  }

  html += `</div>`;
  return html;
}

async function loadPlans() {
  try {
    const response = await apiRequest('/api/video-plans');
    return await response.json();
  } catch (error) {
    console.error('動画予定の読み込みエラー:', error);
    return [];
  }
}

async function loadVideos() {
  try {
    const response = await apiRequest('/api/posted-videos');
    return await response.json();
  } catch (error) {
    console.error('投稿済み動画の読み込みエラー:', error);
    return [];
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

