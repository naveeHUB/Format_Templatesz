const UploadUI = (function () {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseButton = document.getElementById('browseButton');
  const previewPanel = document.getElementById('filePreview');
  const previewName = document.getElementById('previewName');
  const previewMonth = document.getElementById('previewMonth');
  const previewYear = document.getElementById('previewYear');
  const previewSheet = document.getElementById('previewSheet');
  const fileStatus = document.getElementById('fileStatus');
  const generateButton = document.getElementById('generateButton');
  const exportLogButton = document.getElementById('exportLogButton');

  let currentFile = null;
  let uploadMetadata = null;

  function init(onFileSelected) {
    if (browseButton && fileInput) {
      browseButton.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
          await handleFile(file, onFileSelected);
        }
      });
    }

    if (dropZone) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });

      dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

      dropZone.addEventListener('drop', async (event) => {
        dropZone.classList.remove('dragover');
        const file = event.dataTransfer.files[0];
        if (file) {
          await handleFile(file, onFileSelected);
        }
      });
    }

    if (exportLogButton) {
      exportLogButton.addEventListener('click', () => {
        const logEntries = document.querySelectorAll('.status-log .log-item');
        const lines = Array.from(logEntries).map((el) => (el.textContent || '').trim());
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'sales-plan-processing-log.txt';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      });
    }
  }

  async function handleFile(file, onFileSelected) {
    currentFile = file;
    uploadMetadata = null;
    if (previewPanel) previewPanel.classList.remove('d-none');
    if (previewName) previewName.textContent = file.name;
    if (fileStatus) {
      fileStatus.textContent = 'Validating file...';
      fileStatus.className = 'badge bg-warning';
    }
    if (generateButton) generateButton.disabled = true;
    if (exportLogButton) exportLogButton.disabled = true;
    UI.addStatus('File selected: ' + (file.name || 'file'), 'info');

    try {
      const metadata = await onFileSelected(file);
      uploadMetadata = metadata;
      if (previewMonth) previewMonth.textContent = metadata.detectedMonth || '';
      if (previewYear) previewYear.textContent = metadata.detectedYear || '';
      if (previewSheet) previewSheet.textContent = metadata.sheetName || '';
      if (fileStatus) {
        fileStatus.textContent = 'File Ready';
        fileStatus.className = 'badge bg-success';
      }
      if (generateButton) generateButton.disabled = false;
      if (exportLogButton) exportLogButton.disabled = false;
      UI.notify('File is ready for generation.', 'success');
    } catch (error) {
      if (previewMonth) previewMonth.textContent = '';
      if (previewYear) previewYear.textContent = '';
      if (previewSheet) previewSheet.textContent = '';
      if (fileStatus) {
        fileStatus.textContent = 'Upload failed';
        fileStatus.className = 'badge bg-danger';
      }
      if (generateButton) generateButton.disabled = true;
      if (exportLogButton) exportLogButton.disabled = true;
      UI.notify(error.message || 'Upload validation failed.', 'danger');
      throw error;
    }
  }

  function getCurrentFile() {
    return currentFile;
  }

  function getUploadMetadata() {
    return uploadMetadata;
  }

  return {
    init,
    getCurrentFile,
    getUploadMetadata
  };
})();
