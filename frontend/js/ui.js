const UI = (function () {
  const toastContainer = document.getElementById('toastContainer');
  const statusLog = document.getElementById('statusLog');
  const processProgress =
    document.getElementById('processProgress') ||
    document.getElementById('overlayProgress');

  const cardRows = document.getElementById('cardRows') || document.getElementById('metricRows');
  const cardCustomers = document.getElementById('cardCustomers') || document.getElementById('metricCustomers');
  const cardSheet = document.getElementById('cardSheet') || document.getElementById('metricSheet');

  const recentFilesTable = document.getElementById('recentFilesTable');
  const downloadSheet = document.getElementById('downloadSheet');
  const downloadButton = document.getElementById('downloadButton');

  const overlay = document.getElementById('loadingOverlay');
  const overlayStage = document.getElementById('overlayStage');
  const overlayProgress = document.getElementById('overlayProgress');

  const statUploads = document.getElementById('statUploads');
  const statDownloads = document.getElementById('statDownloads');
  const statRuns = document.getElementById('statRuns');

  const previewSize = document.getElementById('previewSize');

  const totalRowsValue = document.getElementById('totalRowsValue');
  const validRowsValue = document.getElementById('validRowsValue');
  const missingCustomerValue = document.getElementById('missingCustomerValue');
  const missingItemValue = document.getElementById('missingItemValue');
  const duplicatesValue = document.getElementById('duplicatesValue');

  const themeToggleBtn = document.getElementById('themeToggle');
  const clearLogButton = document.getElementById('clearLogButton');

  // =============================
  // HELPERS
  // =============================

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }

  function isInvalid(row, field) {
    return !row || row[field] === undefined || row[field] === null || row[field] === "";
  }

  // =============================
  // NOTIFICATIONS
  // =============================

  function notify(message, variant = 'info', delay = 3500) {
    const container = toastContainer || (function createContainer() {
      const c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(c);
      return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${variant} border-0 show`;

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
      </div>
    `;

    container.appendChild(toast);

    toast.querySelector('button').addEventListener('click', () => toast.remove());

    setTimeout(() => {
      toast.classList.remove('show');
      toast.remove();
    }, delay);
  }

  // =============================
  // PROGRESS
  // =============================

  function updateProgress(value) {
    if (!processProgress) return;
    const clamped = Math.min(100, Math.max(0, value));
    processProgress.style.width = `${clamped}%`;
    processProgress.textContent = `${clamped}%`;
  }

  // =============================
  // STATUS LOG
  // =============================

  function addStatus(message, type = 'info') {
    if (!statusLog) return;
    const entry = document.createElement('div');
    entry.className = 'log-item';
    entry.innerHTML = `<span class="text-${type === 'error' ? 'danger' : 'success'}">•</span> ${message}`;
    statusLog.prepend(entry);
  }

  // =============================
  // DASHBOARD
  // =============================

  function setDashboard({ totalRows, totalCustomers, sheetName, totalValue }) {
    if (cardRows) cardRows.textContent = formatNumber(totalRows || 0);
    if (cardCustomers) cardCustomers.textContent = formatNumber(totalCustomers || 0);
    if (cardSheet) cardSheet.textContent = sheetName || 'N/A';
  }

  function setValidationSummary({
    totalRows = 0,
    validRows = 0,
    missingCustomer = 0,
    missingItem = 0,
    duplicates = 0
  }) {
    if (totalRowsValue) totalRowsValue.textContent = formatNumber(totalRows);
    if (validRowsValue) validRowsValue.textContent = formatNumber(validRows);
    if (missingCustomerValue) missingCustomerValue.textContent = formatNumber(missingCustomer);
    if (missingItemValue) missingItemValue.textContent = formatNumber(missingItem);
    if (duplicatesValue) duplicatesValue.textContent = formatNumber(duplicates);
  }

  // =============================
  // FILE SIZE
  // =============================

  function setFileSize(bytes) {
    if (!previewSize) return;
    const kb = bytes / 1024;
    previewSize.textContent =
      kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
  }

  // =============================
  // RECENT FILES
  // =============================

  function setRecentFiles(files) {
    if (!recentFilesTable) return;

    if (!files || !files.length) {
      recentFilesTable.innerHTML = 'No files uploaded yet.';
      return;
    }

    recentFilesTable.innerHTML = files
      .map((item) => {
        const entry =
          typeof item === 'string'
            ? { name: item, date: '—', sheet: '—' }
            : item;

        return `
          <tr>
            <td class="text-truncate" style="max-width: 180px;">${entry.name}</td>
            <td>${entry.date}</td>
            <td>${entry.sheet || 'N/A'}</td>
          </tr>
        `;
      })
      .join('');
  }

  // =============================
  // DOWNLOAD
  // =============================

  function setDownloadReady({ sheetName }) {
    if (downloadSheet) downloadSheet.textContent = sheetName || 'N/A';
    if (downloadButton) downloadButton.disabled = false;
  }

  // =============================
  // OVERLAY
  // =============================

  function showLoadingOverlay(stage = 'Processing workbook...', percent = 0) {
    if (!overlay || !overlayStage || !overlayProgress) return;

    overlay.classList.add('overlay-visible');
    overlayStage.textContent = stage;
    overlayProgress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  function hideLoadingOverlay() {
    if (!overlay) return;
    overlay.classList.remove('overlay-visible');
  }

  // =============================
  // THEME
  // =============================

  function toggleThemeButton(isDark) {
    if (!themeToggleBtn) return;
    themeToggleBtn.innerHTML = isDark ? ' Light Mode' : ' Dark Mode';
  }

  // =============================
  // CONTROLS
  // =============================

  function bindControls() {
    if (clearLogButton && statusLog) {
      clearLogButton.addEventListener('click', () => {
        statusLog.innerHTML = '';
        notify('Processing log cleared.', 'info');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls);
  } else {
    bindControls();
  }

  // =============================
  // PUBLIC API
  // =============================

  return {
    notify,
    updateProgress,
    addStatus,
    setDashboard,
    setFileSize,
    setValidationSummary,
    setRecentFiles,
    setDownloadReady,
    showLoadingOverlay,
    hideLoadingOverlay,
    toggleThemeButton,

    // ✅ NEW: validation helper exposed
    isInvalid,

    updateCounters: function ({ uploads, downloads, runs }) {
      if (statUploads) statUploads.textContent = uploads;
      if (statDownloads) statDownloads.textContent = downloads;
      if (statRuns) statRuns.textContent = runs;
    }
  };
})();