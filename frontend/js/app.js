(function () {
  const dropZone = document.getElementById('dropZone');
  const generateButton = document.getElementById('generateButton');
  const downloadButton = document.getElementById('downloadButton');
  const templateSelect = document.getElementById('templateSelect');
  const templateListBody = document.getElementById('templateListBody');
  const newTemplateForm = document.getElementById('newTemplateForm');
  
  let recentFiles = JSON.parse(localStorage.getItem('salesPlanRecentFiles') || '[]');
  let themeDark = localStorage.getItem('salesPlanTheme') === 'dark';
  let state = {
    uploadCount: 0,
    downloadCount: 0,
    processRuns: 0,
    currentGeneratedFile: null
  };

  function applyTheme() {
    document.body.classList.toggle('dark', themeDark);
    UI.toggleThemeButton(themeDark);
    localStorage.setItem('salesPlanTheme', themeDark ? 'dark' : 'light');
  }

  // Determine API base: when page is served via file:// use localhost:4000
  const API_BASE =
    window.location.hostname === 'localhost' || !window.location.hostname
      ? 'http://localhost:4000'
      : `http://${window.location.hostname}:4000`;

  // =============================
  // TEMPLATES SERVICES
  // =============================

  async function loadTemplates() {
    try {
      const response = await fetch(`${API_BASE}/api/templates`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const templates = await response.json();
      
      renderTemplateSelector(templates);
      renderTemplatesList(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      UI.notify('Could not load templates list.', 'danger');
    }
  }

  function renderTemplateSelector(templates) {
    if (!templateSelect) return;
    if (templates.length === 0) {
      templateSelect.innerHTML = '<option value="">No templates registered</option>';
      return;
    }
    templateSelect.innerHTML = templates
      .map(t => `<option value="${t.templateId}">${t.name} (${t.templateId})</option>`)
      .join('');
  }

  function renderTemplatesList(templates) {
    if (!templateListBody) return;
    if (templates.length === 0) {
      templateListBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No templates registered. Add one using the form.</td></tr>';
      return;
    }
    templateListBody.innerHTML = templates
      .map(t => `
        <tr>
          <td class="font-monospace fw-bold px-4">${t.templateId}</td>
          <td>${t.name}</td>
          <td>${t.sheetName}</td>
          <td class="text-end px-4">
            <button class="btn btn-sm btn-outline-danger btn-delete-template py-1" data-id="${t.templateId}" ${t.templateId === 'sales_v1' ? 'disabled' : ''}>
              <i class="bi bi-trash"></i> Delete
            </button>
          </td>
        </tr>
      `)
      .join('');

    // Attach click events for delete buttons
    document.querySelectorAll('.btn-delete-template').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        if (id === 'sales_v1') return; // protect default
        if (confirm(`Are you sure you want to delete template "${id}"? This cannot be undone.`)) {
          try {
            const res = await fetch(`${API_BASE}/api/templates/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete template');
            UI.notify('Template deleted successfully.', 'success');
            loadTemplates();
          } catch (err) {
            UI.notify(err.message, 'danger');
          }
        }
      });
    });
  }

  // =============================
  // MAIN FLOWS
  // =============================

  async function uploadFile(file) {
    UI.showLoadingOverlay('Uploading file...', 15);
    UI.setFileSize(file.size);

    const formData = new FormData();
    formData.append('salesFile', file);

    UI.addStatus('Uploading file to server...');
    UI.updateProgress(10);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      UI.hideLoadingOverlay();
      throw new Error(payload.error || 'Upload request failed.');
    }

    const metadata = await response.json();
    UI.addStatus('Upload validated: ' + metadata.originalName);
    UI.updateProgress(30);
    state.uploadCount += 1;
    updateCounters();
    addRecentFile(metadata);
    UI.hideLoadingOverlay();
    return metadata;
  }

  async function generateWorkbook(metadata) {
    UI.showLoadingOverlay('Processing workbook...', 55);
    UI.addStatus('Processing workbook...');
    UI.updateProgress(45);

    const templateId = templateSelect ? templateSelect.value : 'sales_v1';
    
    const payload = new FormData();
    payload.append('uploadFileName', metadata.fileName);
    payload.append('templateId', templateId);

    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      body: payload
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({}));
      UI.hideLoadingOverlay();
      throw new Error(payloadError.error || 'Generation request failed.');
    }

    const generated = await response.json();
    UI.addStatus('Sales plan created: ' + generated.sheetName);
    UI.updateProgress(70);
    state.processRuns += 1;
    state.currentGeneratedFile = generated.generatedFileName;
    
    setDashboardData(generated);
    if (generated.validation) {
      UI.setValidationSummary(generated.validation);
      
      // Log validation issues in UI status log
      if (generated.validation.issues && generated.validation.issues.length > 0) {
        UI.addStatus(`Completed with ${generated.validation.issues.length} warnings. See summary panel.`, 'error');
      } else {
        UI.addStatus('Sheet generated with zero validation warnings.', 'info');
      }
    }
    
    UI.setDownloadReady({ sheetName: generated.sheetName });
    UI.hideLoadingOverlay();
    return generated;
  }

  async function downloadWorkbook(filename) {
    UI.addStatus('Preparing download...');
    UI.updateProgress(80);

    const url = `${API_BASE}/download?name=${encodeURIComponent(filename)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({}));
      throw new Error(payloadError.error || 'Download failed.');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);

    UI.addStatus('Download complete. Workbook saved locally.');
    UI.updateProgress(100);
    state.downloadCount += 1;
    updateCounters();
    UI.notify('Workbook generated and download started.', 'success');
  }

  function addRecentFile(metadata) {
    const entry = {
      name: metadata.originalName || metadata.fileName,
      date: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      sheet: metadata.sheetName || 'N/A'
    };

    recentFiles = [entry, ...recentFiles.filter((item) => item.name !== entry.name)].slice(0, 5);
    localStorage.setItem('salesPlanRecentFiles', JSON.stringify(recentFiles));
    UI.setRecentFiles(recentFiles);
  }

  function setDashboardData({ totalRows, totalCustomers, sheetName }) {
    UI.setDashboard({ totalRows, totalCustomers, sheetName });
  }

  function updateCounters() {
    UI.updateCounters({
      uploads: state.uploadCount,
      downloads: state.downloadCount,
      runs: state.processRuns
    });
  }

  function setupEvents() {
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        themeDark = !themeDark;
        applyTheme();
      });
    }

    if (generateButton) {
      generateButton.addEventListener('click', async () => {
        const metadata = UploadUI.getUploadMetadata();
        if (!metadata) {
          UI.notify('No uploaded file is available. Please upload first.', 'danger');
          return;
        }

        generateButton.disabled = true;
        try {
          UI.showLoadingOverlay('Creating sales plan worksheet...', 45);
          UI.addStatus('Creating sales plan worksheet...');
          UI.updateProgress(50);
          const generated = await generateWorkbook(metadata);
          await downloadWorkbook(generated.generatedFileName);
        } catch (error) {
          UI.addStatus(error.message, 'error');
          UI.notify(error.message, 'danger');
          UI.updateProgress(0);
        } finally {
          generateButton.disabled = false;
          UI.hideLoadingOverlay();
        }
      });
    }

    if (downloadButton) {
      downloadButton.addEventListener('click', async () => {
        if (!state.currentGeneratedFile) {
          UI.notify('There is no generated workbook yet. Generate one first.', 'warning');
          return;
        }
        try {
          await downloadWorkbook(state.currentGeneratedFile);
        } catch (error) {
          UI.addStatus(error.message, 'error');
          UI.notify(error.message, 'danger');
        }
      });
    }

    // Register template form submission
    if (newTemplateForm) {
      newTemplateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const templateId = document.getElementById('newTemplateId').value.trim();
        const name = document.getElementById('newTemplateName').value.trim();
        const sheetName = document.getElementById('newSheetName').value.trim();
        const headerRow = parseInt(document.getElementById('newHeaderRow').value) || 1;
        const dataStartRow = parseInt(document.getElementById('newDataStartRow').value) || 2;
        const templateFile = document.getElementById('newTemplateFile').files[0];

        const mapping = {
          "CUSTOMER": document.getElementById('mapCustomer').value.trim(),
          "CUSTOMER DESC.": document.getElementById('mapCustomerDesc').value.trim(),
          "ITEM": document.getElementById('mapItem').value.trim(),
          "ITEM DESCRIPTION": document.getElementById('mapItemDesc').value.trim(),
          "Sales Plan Qty": document.getElementById('mapQty').value.trim(),
          "Sale Plan Value": document.getElementById('mapPrice').value.trim() // standard mapping to price/value
        };

        const summary = {
          enabled: document.getElementById('summaryEnabled').checked,
          sheetName: document.getElementById('summarySheetName').value.trim(),
          startCol: document.getElementById('summaryStartCol').value.trim(),
          startRow: parseInt(document.getElementById('summaryStartRow').value) || 1,
          customerHeader: document.getElementById('summaryCustomerHeader').value.trim(),
          valueHeader: "Sum of Sale Plan Value"
        };

        const config = {
          templateId,
          name,
          sheetName,
          headerRow,
          dataStartRow,
          mapping,
          summary
        };

        const formData = new FormData();
        formData.append('config', JSON.stringify(config));
        formData.append('templateFile', templateFile);

        try {
          const res = await fetch(`${API_BASE}/api/templates`, {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to register template.');
          }

          UI.notify('Template registered successfully!', 'success');
          newTemplateForm.reset();
          
          // Switch back to templates list tab in the modal
          const listTabEl = document.getElementById('list-tab');
          if (listTabEl) {
            const tab = bootstrap.Tab.getOrCreateInstance(listTabEl);
            tab.show();
          }

          // Reload templates dropdown
          await loadTemplates();
        } catch (err) {
          console.error(err);
          UI.notify(err.message, 'danger');
        }
      });
    }
  }

  function initialize() {
    applyTheme();
    UploadUI.init(uploadFile);
    UI.setRecentFiles(recentFiles);
    updateCounters();
    setupEvents();
    loadTemplates();
    UI.addStatus('Dashboard ready. Upload your sales plan file.');
  }

  initialize();
})();
