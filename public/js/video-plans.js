// 動画予定ページ

let currentFilter = '';
let editingId = null;
let selectedIds = new Set();
let searchQuery = '';
let sortColumn = null;
let sortDirection = 'asc';
let editingCell = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadPlans();
  setupEventListeners();
});

let csvData = [];

function setupEventListeners() {
  const addPlanBtn = document.getElementById('addPlanBtn');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const modal = document.getElementById('planModal');
  const csvModal = document.getElementById('csvModal');
  const closeModal = document.getElementById('closeModal');
  const closeCsvModal = document.getElementById('closeCsvModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const cancelCsvBtn = document.getElementById('cancelCsvBtn');
  const planForm = document.getElementById('planForm');
  const csvFile = document.getElementById('csvFile');
  const importCsvBtnConfirm = document.getElementById('importCsvBtnConfirm');

  if (addPlanBtn) {
    addPlanBtn.addEventListener('click', () => {
      editingId = null;
      openModal();
    });
  }

  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('CSV読み込みボタンがクリックされました');
      openCsvModal();
    });
  } else {
    console.error('CSV読み込みボタンが見つかりません');
  }

  if (closeModal) {
    closeModal.addEventListener('click', closeModalHandler);
  }
  if (closeCsvModal) {
    closeCsvModal.addEventListener('click', closeCsvModalHandler);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModalHandler);
  }
  if (cancelCsvBtn) {
    cancelCsvBtn.addEventListener('click', closeCsvModalHandler);
  }

  if (planForm) {
    planForm.addEventListener('submit', handleFormSubmit);
  }

  if (csvFile) {
    csvFile.addEventListener('change', handleCsvFileSelect);
  }
  if (importCsvBtnConfirm) {
    importCsvBtnConfirm.addEventListener('click', handleCsvImport);
  }

  const filterButtons = document.querySelectorAll('.filter-tabs .tab-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || '';
      loadPlans();
    });
  });

  // 検索機能（デバウンス処理）
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const debouncedSearch = typeof debounce === 'function' 
      ? debounce((value) => {
          searchQuery = value;
          loadPlans();
        }, 300)
      : (() => {
          let timeout;
          return (value) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              searchQuery = value;
              loadPlans();
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
  const bulkMoveToPostedBtn = document.getElementById('bulkMoveToPostedBtn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.plan-checkbox:not(:checked)');
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
      document.querySelectorAll('.plan-checkbox').forEach(cb => cb.checked = false);
      updateBulkButtons();
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }

  if (bulkMoveToPostedBtn) {
    bulkMoveToPostedBtn.addEventListener('click', handleBulkMoveToPosted);
  }

  // テンプレート機能
  const templateSelect = document.getElementById('templateSelect');
  const saveAsTemplateBtn = document.getElementById('saveAsTemplateBtn');
  const previewBtn = document.getElementById('previewBtn');
  const saveDraftBtn = document.getElementById('saveDraftBtn');

  if (templateSelect) {
    loadTemplates();
  }

  if (saveAsTemplateBtn) {
    saveAsTemplateBtn.addEventListener('click', handleSaveAsTemplate);
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', showPreview);
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', saveDraft);
  }

  // 下書きの読み込み
  loadDraft();
}

async function openModal(plan = null) {
  const modal = document.getElementById('planModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('planForm');

  if (plan) {
    editingId = plan.id;
    modalTitle.textContent = '動画予定の編集';
    document.getElementById('planId').value = plan.id;
    document.getElementById('planNo').value = plan.no;
    document.getElementById('planType').value = plan.type;
    document.getElementById('planTitle').value = plan.title;
    document.getElementById('planIntro').value = plan.intro_content || '';
    document.getElementById('planNarration').value = plan.narration_content || '';
    document.getElementById('planTags').value = plan.tags || '';
    document.getElementById('planCategory').value = plan.category || '';
    document.getElementById('planReminder').value = plan.reminder_date ? new Date(plan.reminder_date).toISOString().slice(0, 16) : '';
    document.getElementById('planPosted').checked = plan.is_posted === 1;
  } else {
    editingId = null;
    modalTitle.textContent = '動画予定の追加';
    form.reset();
    document.getElementById('planId').value = '';
    
    // 次のNoを取得して表示
    try {
      const response = await apiRequest('/api/video-plans/next-no');
      const data = await response.json();
      if (data.nextNo) {
        document.getElementById('planNo').value = data.nextNo;
      }
    } catch (error) {
      console.error('次のNo取得エラー:', error);
    }
  }

  // テンプレートリストを再読み込み
  await loadTemplates();
  modal.classList.add('show');
  
  // モーダルのフォーカス管理
  const firstInput = document.getElementById('planTitle') || document.getElementById('planType');
  if (typeof setupModalFocus === 'function') {
    setupModalFocus(modal, firstInput);
  }
  
  // リアルタイムバリデーション設定
  setupFormValidation();
}

function openCsvModal() {
  const csvModal = document.getElementById('csvModal');
  if (!csvModal) {
    console.error('CSVモーダルが見つかりません');
    showErrorMessage('CSVモーダルが見つかりません。ページを再読み込みしてください。');
    return;
  }
  
  // ローディングオーバーレイを確実に非表示にする
  hideLoading();
  
  csvModal.classList.add('show');
  const csvFile = document.getElementById('csvFile');
  const csvPreview = document.getElementById('csvPreview');
  const importCsvBtnConfirm = document.getElementById('importCsvBtnConfirm');
  
  if (csvFile) csvFile.value = '';
  if (csvPreview) csvPreview.innerHTML = '';
  if (importCsvBtnConfirm) importCsvBtnConfirm.disabled = true;
  csvData = [];
  
  // モーダルのフォーカス管理
  if (typeof setupModalFocus === 'function' && csvFile) {
    setupModalFocus(csvModal, csvFile);
  }
}

function closeCsvModalHandler() {
  const csvModal = document.getElementById('csvModal');
  if (csvModal) {
    csvModal.classList.remove('show');
  }
  csvData = [];
}

function closeModalHandler() {
  const modal = document.getElementById('planModal');
  if (modal) {
    modal.classList.remove('show');
    
    // バリデーションエラーをクリア
    const errorElements = modal.querySelectorAll('.input-error');
    errorElements.forEach(el => el.classList.remove('show'));
    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(input => input.style.borderColor = '');
  }
  editingId = null;
}

// フォームバリデーション設定
function setupFormValidation() {
  const titleInput = document.getElementById('planTitle');
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
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById('planTitle');
  const titleError = document.getElementById('planTitleError');
  
  // バリデーション
  if (!titleInput.value.trim()) {
    titleError.textContent = 'タイトルを入力してください';
    titleError.style.display = 'block';
    titleInput.focus();
    return;
  } else {
    titleError.style.display = 'none';
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  showLoading(submitBtn, '保存中...');

  const reminderDate = document.getElementById('planReminder').value;
  
  const planData = {
    no: editingId ? parseInt(document.getElementById('planNo').value) : null, // 新規作成時は自動設定
    type: document.getElementById('planType').value,
    title: titleInput.value.trim(),
    intro_content: document.getElementById('planIntro').value.trim(),
    narration_content: document.getElementById('planNarration').value.trim(),
    tags: document.getElementById('planTags').value.trim(),
    category: document.getElementById('planCategory').value.trim(),
    reminder_date: reminderDate ? new Date(reminderDate).toISOString() : null,
    is_posted: document.getElementById('planPosted').checked ? 1 : 0
  };

  try {
    let response;
    if (editingId) {
      response = await apiRequest(`/api/video-plans/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(planData)
      });
    } else {
      response = await apiRequest('/api/video-plans', {
        method: 'POST',
        body: JSON.stringify(planData)
      });
    }

    const data = await response.json();

    if (response.ok && data.success) {
      showSuccessMessage(editingId ? '動画予定を更新しました' : '動画予定を追加しました');
      closeModalHandler();
      await loadPlans();
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

function handleCsvFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    parseCsv(text);
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCsv(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    alert('CSVファイルの形式が正しくありません');
    return;
  }

  // ヘッダー行をスキップ（1行目）
  const dataLines = lines.slice(1);
  csvData = [];

  dataLines.forEach((line, index) => {
    // CSV解析（カンマ区切り、ダブルクォート対応）
    const values = parseCsvLine(line);
    if (values.length >= 2) {
      csvData.push({
        type: values[0] && (values[0].includes('ショート') || values[0].includes('ショ') ? 'ショート' : '動画'),
        title: values[1] || '',
        intro_content: values[2] || '',
        narration_content: values[3] || ''
      });
    }
  });

  if (csvData.length === 0) {
    alert('有効なデータが見つかりませんでした');
    return;
  }

  displayCsvPreview();
  document.getElementById('importCsvBtnConfirm').disabled = false;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function displayCsvPreview() {
  const preview = document.getElementById('csvPreview');
  let html = '<table><thead><tr><th>種類</th><th>タイトル</th><th>冒頭内容</th><th>ナレーション内容</th></tr></thead><tbody>';
  
  csvData.forEach(plan => {
    html += `<tr>
      <td>${escapeHtml(plan.type)}</td>
      <td>${escapeHtml(plan.title)}</td>
      <td>${escapeHtml(plan.intro_content || '')}</td>
      <td>${escapeHtml(plan.narration_content || '')}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  html += `<p style="margin-top: 1rem; color: #b0b0b0;">${csvData.length}件のデータをインポートします</p>`;
  preview.innerHTML = html;
}

async function handleCsvImport() {
  if (csvData.length === 0) {
    showErrorMessage('インポートするデータがありません');
    return;
  }

  const importBtn = document.getElementById('importCsvBtnConfirm');
  showLoading(importBtn, 'インポート中...');

  try {
    const response = await apiRequest('/api/video-plans/import-csv', {
      method: 'POST',
      body: JSON.stringify({ plans: csvData })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const message = `${data.successCount}件のデータをインポートしました${data.errorCount > 0 ? `（${data.errorCount}件エラー）` : ''}`;
      showSuccessMessage(message);
      closeCsvModalHandler();
      await loadPlans();
    } else {
      showErrorMessage(data.error || 'インポートに失敗しました');
    }
  } catch (error) {
    console.error('インポートエラー:', error);
    showErrorMessage('インポート中にエラーが発生しました');
  } finally {
    hideLoading(importBtn);
  }
}

async function loadPlans() {
  try {
    // ローディングオーバーレイを確実に非表示にする
    hideLoading();
    
    let url = '/api/video-plans';
    const params = [];
    
    if (currentFilter === '投稿済み') {
      params.push('posted=true');
    } else if (currentFilter === '未投稿') {
      params.push('posted=false');
    }
    
    if (searchQuery) {
      params.push(`search=${encodeURIComponent(searchQuery)}`);
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await apiRequest(url);
    const plans = await response.json();

    const plansList = document.getElementById('plansList');
    if (!plans || plans.length === 0) {
      plansList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>動画予定がありません</h3>
          <p>「手動追加」ボタンから新しい動画予定を追加するか、「CSV読み込み」ボタンで一括インポートできます。</p>
        </div>
      `;
      return;
    }

    // ソート処理
    let sortedPlans = [...plans];
    if (sortColumn) {
      sortedPlans.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        
        if (sortColumn === 'no') {
          aVal = parseInt(aVal) || 0;
          bVal = parseInt(bVal) || 0;
        } else if (sortColumn === 'is_posted') {
          aVal = aVal === 1 ? 1 : 0;
          bVal = bVal === 1 ? 1 : 0;
        } else {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const getSortClass = (col) => {
      if (sortColumn === col) {
        return sortDirection === 'asc' ? 'sortable sort-asc' : 'sortable sort-desc';
      }
      return 'sortable';
    };

    plansList.innerHTML = `
      <table class="plans-table">
        <thead>
          <tr>
            <th class="cell-checkbox">
              <input type="checkbox" id="selectAllTable" onchange="toggleSelectAll(this.checked)">
            </th>
            <th class="cell-number ${getSortClass('no')}" onclick="sortTable('no')">No</th>
            <th class="cell-type ${getSortClass('type')}" onclick="sortTable('type')">種類</th>
            <th class="cell-title ${getSortClass('title')}" onclick="sortTable('title')">タイトル</th>
            <th class="cell-intro ${getSortClass('intro_content')}" onclick="sortTable('intro_content')">冒頭内容</th>
            <th class="cell-narration ${getSortClass('narration_content')}" onclick="sortTable('narration_content')">ナレーション内容</th>
            <th class="cell-status ${getSortClass('is_posted')}" onclick="sortTable('is_posted')">状態</th>
            <th class="cell-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlans.map(plan => `
            <tr class="${selectedIds.has(plan.id) ? 'selected' : ''}" data-id="${plan.id}">
              <td class="cell-checkbox">
                <input type="checkbox" class="plan-checkbox" value="${plan.id}" 
                  ${selectedIds.has(plan.id) ? 'checked' : ''}
                  onchange="togglePlanSelection(${plan.id}, this.checked)">
              </td>
              <td class="cell-number editable-cell" data-field="no" data-id="${plan.id}">
                <div class="cell-content">${plan.no || ''}</div>
              </td>
              <td class="cell-type editable-cell" data-field="type" data-id="${plan.id}">
                <div class="cell-content">${escapeHtml(plan.type)}</div>
              </td>
              <td class="cell-title editable-cell" data-field="title" data-id="${plan.id}">
                <div class="cell-content">${escapeHtml(plan.title || '')}</div>
              </td>
              <td class="cell-intro editable-cell" data-field="intro_content" data-id="${plan.id}">
                <div class="cell-content ${!plan.intro_content ? 'empty' : ''}">${escapeHtml(plan.intro_content || '(未入力)')}</div>
              </td>
              <td class="cell-narration editable-cell" data-field="narration_content" data-id="${plan.id}">
                <div class="cell-content ${!plan.narration_content ? 'empty' : ''}">${escapeHtml(plan.narration_content || '(未入力)')}</div>
              </td>
              <td class="cell-status">
                <span class="plan-status ${plan.is_posted === 1 ? '投稿済み' : '未投稿'}">
                  ${plan.is_posted === 1 ? '投稿済み' : '未投稿'}
                </span>
              </td>
              <td class="cell-actions">
                <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="editPlan(${plan.id})">編集</button>
                <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deletePlan(${plan.id})">削除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // インライン編集のイベントリスナーを追加
    setupInlineEditing();
  } catch (error) {
    console.error('動画予定の読み込みエラー:', error);
    const plansList = document.getElementById('plansList');
    plansList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-icon">⚠️</div>
        <h3>動画予定の読み込みに失敗しました</h3>
        <p>ページを再読み込みするか、しばらく時間をおいてから再度お試しください。</p>
        <p>ページを再読み込みするか、しばらく時間をおいてから再度お試しください。</p>
      </div>
    `;
  }
}

async function editPlan(id) {
  try {
    const response = await apiRequest('/api/video-plans');
    const plans = await response.json();
    const plan = plans.find(p => p.id === id);
    if (plan) {
      openModal(plan);
    } else {
      showErrorMessage('動画予定が見つかりませんでした');
    }
  } catch (error) {
    console.error('動画予定の取得エラー:', error);
    showErrorMessage('動画予定の取得に失敗しました');
  }
}

async function deletePlan(id) {
  showDeleteConfirm('この動画予定を削除しますか？この操作は取り消せません。', async () => {
    try {
      const response = await apiRequest(`/api/video-plans/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccessMessage('動画予定を削除しました');
        await loadPlans();
      } else {
        showErrorMessage(data.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      showErrorMessage('削除中にエラーが発生しました');
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  loadPlans();
}

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.plan-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.value);
    if (checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
  });
  updateBulkButtons();
  
  // 行の選択状態を更新
  document.querySelectorAll('.plans-table tbody tr').forEach(row => {
    if (checked) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  });
}

function setupInlineEditing() {
  const editableCells = document.querySelectorAll('.editable-cell');
  editableCells.forEach(cell => {
    cell.addEventListener('dblclick', (e) => {
      if (editingCell && editingCell !== cell) {
        if (window.currentEdit && window.currentEdit.cancelEdit) {
          window.currentEdit.cancelEdit();
        }
      }
      startEdit(cell);
    });
  });
}

function startEdit(cell) {
  if (editingCell) return;
  
  editingCell = cell;
  const field = cell.dataset.field;
  const id = parseInt(cell.dataset.id);
  const currentValue = cell.querySelector('.cell-content').textContent.trim();
  const isEmpty = cell.querySelector('.cell-content').classList.contains('empty');
  const value = isEmpty ? '' : currentValue;
  
  cell.classList.add('editing');
  
  let input;
  if (field === 'type') {
    input = document.createElement('select');
    input.innerHTML = '<option value="動画">動画</option><option value="ショート">ショート</option>';
    input.value = value || '動画';
  } else if (field === 'intro_content' || field === 'narration_content') {
    input = document.createElement('textarea');
    input.value = value;
  } else {
    input = document.createElement('input');
    input.type = field === 'no' ? 'number' : 'text';
    input.value = value;
  }
  
  const cellContent = cell.querySelector('.cell-content');
  cellContent.style.display = 'none';
  cell.appendChild(input);
  input.focus();
  if (input.select) input.select();
  
  const saveEdit = async () => {
    const newValue = input.value.trim();
    await updatePlanField(id, field, newValue);
    cancelEdit();
    await loadPlans();
  };
  
  const cancelEdit = () => {
    if (!editingCell) return;
    editingCell.classList.remove('editing');
    const input = editingCell.querySelector('input, textarea, select');
    if (input) {
      input.remove();
    }
    const cellContent = editingCell.querySelector('.cell-content');
    if (cellContent) {
      cellContent.style.display = '';
    }
    editingCell = null;
    window.currentEdit = null;
  };
  
  window.currentEdit = { saveEdit, cancelEdit };
  
  input.addEventListener('blur', saveEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && field !== 'intro_content' && field !== 'narration_content') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
}

async function updatePlanField(id, field, value) {
  try {
    // まず現在のデータを取得
    const response = await apiRequest(`/api/video-plans/${id}`);
    const plan = await response.json();
    
    if (!plan) {
      showErrorMessage('動画予定が見つかりません');
      return;
    }
    
    // フィールドを更新
    const updateData = {
      no: plan.no,
      type: plan.type,
      title: plan.title,
      intro_content: plan.intro_content || '',
      narration_content: plan.narration_content || '',
      tags: plan.tags || '',
      category: plan.category || '',
      reminder_date: plan.reminder_date || null,
      is_posted: plan.is_posted
    };
    
    updateData[field] = value;
    
    // 更新
    const updateResponse = await apiRequest(`/api/video-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    const data = await updateResponse.json();
    
    if (updateResponse.ok && data.success) {
      // 成功時は静かに更新（メッセージは表示しない）
    } else {
      showErrorMessage(data.error || '更新に失敗しました');
    }
  } catch (error) {
    console.error('更新エラー:', error);
    showErrorMessage('更新中にエラーが発生しました');
  }
}

function togglePlanSelection(id, checked) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateBulkButtons();
  
  // 行の選択状態を更新
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) {
    if (checked) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  }
}

function updateBulkButtons() {
  const count = selectedIds.size;
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkMoveToPostedBtn = document.getElementById('bulkMoveToPostedBtn');
  
  if (count > 0) {
    if (selectAllBtn) selectAllBtn.style.display = 'inline-block';
    if (deselectAllBtn) deselectAllBtn.style.display = 'inline-block';
    if (bulkDeleteBtn) {
      bulkDeleteBtn.style.display = 'inline-block';
      bulkDeleteBtn.textContent = `選択した項目を削除 (${count})`;
    }
    if (bulkMoveToPostedBtn) {
      bulkMoveToPostedBtn.style.display = 'inline-block';
      bulkMoveToPostedBtn.textContent = `選択項目を投稿済みに移動 (${count})`;
    }
  } else {
    if (selectAllBtn) selectAllBtn.style.display = 'none';
    if (deselectAllBtn) deselectAllBtn.style.display = 'none';
    if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'none';
    if (bulkMoveToPostedBtn) bulkMoveToPostedBtn.style.display = 'none';
  }
}

async function handleBulkDelete() {
  if (selectedIds.size === 0) {
    showErrorMessage('削除する項目を選択してください');
    return;
  }
  
  showDeleteConfirm(`選択した${selectedIds.size}件の動画予定を削除しますか？この操作は取り消せません。`, async () => {
    try {
      const response = await apiRequest('/api/video-plans/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showSuccessMessage(`${data.count}件の動画予定を削除しました`);
        selectedIds.clear();
        await loadPlans();
      } else {
        showErrorMessage(data.error || '一括削除に失敗しました');
      }
    } catch (error) {
      console.error('一括削除エラー:', error);
      showErrorMessage('一括削除中にエラーが発生しました');
    }
  });
}

async function handleBulkMoveToPosted() {
  if (selectedIds.size === 0) {
    showErrorMessage('移動する項目を選択してください');
    return;
  }
  
  showDeleteConfirm(`選択した${selectedIds.size}件の動画予定を投稿済みに移動しますか？`, async () => {
    try {
      const response = await apiRequest('/api/video-plans/bulk-move-to-posted', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showSuccessMessage(`${data.count}件の動画予定を投稿済みに移動しました（${data.addedCount}件が投稿済み動画に追加されました）`);
        selectedIds.clear();
        await loadPlans();
      } else {
        showErrorMessage(data.error || '一括移動に失敗しました');
      }
    } catch (error) {
      console.error('一括移動エラー:', error);
      showErrorMessage('一括移動中にエラーが発生しました');
    }
  });
}

// テンプレート機能
async function loadTemplates() {
  try {
    const response = await apiRequest('/api/templates');
    const templates = await response.json();
    const templateSelect = document.getElementById('templateSelect');
    
    if (templateSelect) {
      // 最初のオプションを保持
      const firstOption = templateSelect.querySelector('option');
      templateSelect.innerHTML = '';
      if (firstOption) {
        templateSelect.appendChild(firstOption);
      }
      
      templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = `${template.name} (${template.type})`;
        templateSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('テンプレート読み込みエラー:', error);
  }
}

async function loadTemplate() {
  const templateSelect = document.getElementById('templateSelect');
  const templateId = templateSelect.value;
  
  if (!templateId) return;
  
  try {
    const response = await apiRequest(`/api/templates/${templateId}`);
    const template = await response.json();
    
    if (template) {
      document.getElementById('planType').value = template.type;
      document.getElementById('planIntro').value = template.intro_content || '';
      document.getElementById('planNarration').value = template.narration_content || '';
      showSuccessMessage('テンプレートを読み込みました');
    }
  } catch (error) {
    console.error('テンプレート読み込みエラー:', error);
    showErrorMessage('テンプレートの読み込みに失敗しました');
  }
}

async function handleSaveAsTemplate() {
  const name = prompt('テンプレート名を入力してください:');
  if (!name || !name.trim()) {
    return;
  }
  
  const type = document.getElementById('planType').value;
  const intro_content = document.getElementById('planIntro').value;
  const narration_content = document.getElementById('planNarration').value;
  
  try {
    const response = await apiRequest('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), type, intro_content, narration_content })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showSuccessMessage('テンプレートを保存しました');
      await loadTemplates();
    } else {
      showErrorMessage(data.error || 'テンプレートの保存に失敗しました');
    }
  } catch (error) {
    console.error('テンプレート保存エラー:', error);
    showErrorMessage('テンプレートの保存中にエラーが発生しました');
  }
}

function showPreview() {
  const title = document.getElementById('planTitle').value;
  const intro = document.getElementById('planIntro').value;
  const narration = document.getElementById('planNarration').value;
  const type = document.getElementById('planType').value;
  
  const previewContent = `
    <div style="padding: 1.5rem;">
      <h3 style="margin-bottom: 1rem; color: #333333;">プレビュー</h3>
      <div style="background-color: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
        <div style="font-weight: 600; color: #4a9eff; margin-bottom: 0.5rem;">${escapeHtml(type)}</div>
        <div style="font-size: 1.2rem; font-weight: 600; color: #333333; margin-bottom: 1rem;">${escapeHtml(title || '(タイトル未入力)')}</div>
        ${intro ? `<div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #ffffff; border-left: 3px solid #4a9eff; border-radius: 4px;">
          <div style="font-size: 0.85rem; color: #666666; margin-bottom: 0.5rem;">冒頭内容:</div>
          <div style="white-space: pre-line; color: #333333;">${escapeHtml(intro).replace(/\n/g, '<br>')}</div>
        </div>` : ''}
        ${narration ? `<div style="padding: 0.75rem; background-color: #ffffff; border-left: 3px solid #4a9eff; border-radius: 4px;">
          <div style="font-size: 0.85rem; color: #666666; margin-bottom: 0.5rem;">ナレーション内容:</div>
          <div style="white-space: pre-line; color: #333333;">${escapeHtml(narration).replace(/\n/g, '<br>')}</div>
        </div>` : ''}
      </div>
    </div>
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center;';
  modal.innerHTML = `
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #e0e0e0;">
        <h3 style="font-size: 1.3rem; color: #333333; margin: 0;">プレビュー</h3>
        <button id="previewCloseBtn" style="background: none; border: none; color: #666666; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px;" aria-label="閉じる">&times;</button>
      </div>
      ${previewContent}
      <div style="padding: 1.5rem; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end;">
        <button type="button" id="previewOkBtn" class="btn btn-primary">閉じる</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const closeModal = () => modal.remove();
  
  modal.querySelector('#previewCloseBtn').addEventListener('click', closeModal);
  const okBtn = modal.querySelector('#previewOkBtn');
  if (okBtn) {
    okBtn.addEventListener('click', closeModal);
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

async function saveDraft() {
  const draftData = {
    title: document.getElementById('planTitle').value,
    type: document.getElementById('planType').value,
    intro: document.getElementById('planIntro').value,
    narration: document.getElementById('planNarration').value,
    tags: document.getElementById('planTags').value,
    category: document.getElementById('planCategory').value
  };
  
  try {
    const response = await apiRequest('/api/video-plans/draft', {
      method: 'POST',
      body: JSON.stringify({ draft_content: JSON.stringify(draftData) })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showSuccessMessage('下書きを保存しました');
      const draftNotice = document.getElementById('draftNotice');
      if (draftNotice) {
        draftNotice.style.display = 'block';
      }
    } else {
      showErrorMessage(data.error || '下書きの保存に失敗しました');
    }
  } catch (error) {
    console.error('下書き保存エラー:', error);
    showErrorMessage('下書きの保存中にエラーが発生しました');
  }
}

async function loadDraft() {
  try {
    const response = await apiRequest('/api/video-plans/draft');
    const draft = await response.json();
    
    if (draft && draft.draft_content) {
      try {
        const draftData = JSON.parse(draft.draft_content);
        if (draftData.title || draftData.intro || draftData.narration) {
          const draftNotice = document.getElementById('draftNotice');
          if (draftNotice) {
            draftNotice.style.display = 'block';
          }
        }
      } catch (e) {
        // JSON解析エラーは無視
      }
    }
  } catch (error) {
    // エラーは無視（下書きがない場合もエラーになる）
  }
}

