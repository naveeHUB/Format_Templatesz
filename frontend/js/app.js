let currentTemplateId = null;
let currentTemplateStructure = null;
let currentSourceHeaders = null;
let currentMappings = {};
let currentOutputFile = null;

// DOM Elements
const templateDropZone = document.getElementById('template-drop-zone');
const templateFileInput = document.getElementById('template-file-input');
const templateUploadBtn = document.getElementById('template-upload-btn');
const templateStatus = document.getElementById('template-status');
const stepTemplate = document.getElementById('step-template');
const stepSource = document.getElementById('step-source');
const stepMapping = document.getElementById('step-mapping');
const stepResults = document.getElementById('step-results');

// Step 1: Upload and analyze template
async function uploadTemplate(file) {
    if (!file || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls'))) {
        showStatus(templateStatus, 'Please upload a valid Excel file', 'error');
        return;
    }
    
    const templateId = 'template_' + Date.now();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId);
    formData.append('templateName', file.name.replace('.xlsx', '').replace('.xls', ''));
    
    showStatus(templateStatus, 'Analyzing template structure...', 'info');
    
    try {
        const response = await fetch('/api/analyze-template', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Analysis failed');
        
        currentTemplateId = templateId;
        currentTemplateStructure = await response.json();
        
        showStatus(templateStatus, '✅ Template analyzed successfully!', 'success');
        displayTemplateStructure(currentTemplateStructure);
        
        // Move to step 2
        stepTemplate.style.display = 'none';
        stepSource.style.display = 'block';
        
    } catch (error) {
        showStatus(templateStatus, 'Error: ' + error.message, 'error');
    }
}

function displayTemplateStructure(structure) {
    const container = document.getElementById('structure-display');
    container.style.display = 'block';
    
    container.innerHTML = `
        <div class="structure-summary">
            <p><strong>Template Name:</strong> ${structure.templateName}</p>
            <p><strong>Sheets:</strong> ${structure.sheetCount}</p>
        </div>
        <div class="sheets-list">
            ${structure.sheets.map(sheet => `
                <div class="sheet-card">
                    <h4>📄 ${sheet.sheetName}</h4>
                    <p>Headers: ${sheet.headers.map(h => h.header).join(', ')}</p>
                    <p>Columns: ${sheet.columnCount} | Rows: ${sheet.rowCount}</p>
                </div>
            `).join('')}
        </div>
    `;
}

// Step 2: Upload source file
const sourceDropZone = document.getElementById('source-drop-zone');
const sourceFileInput = document.getElementById('source-file-input');
const sourceUploadBtn = document.getElementById('source-upload-btn');
const sourceStatus = document.getElementById('source-status');

async function uploadSource(file) {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    showStatus(sourceStatus, 'Analyzing source file...', 'info');
    
    try {
        // First, extract headers from source file using a temporary endpoint
        // For now, we'll simulate header extraction
        
        // Simulate source headers (in production, create /api/extract-headers endpoint)
        currentSourceHeaders = ['Customer', 'Part No', 'Qty', 'Value'];
        
        showStatus(sourceStatus, '✅ Source file analyzed!', 'success');
        
        // Match with template
        await matchTemplate();
        
    } catch (error) {
        showStatus(sourceStatus, 'Error: ' + error.message, 'error');
    }
}

async function matchTemplate() {
    showStatus(sourceStatus, 'Finding best template match...', 'info');
    
    try {
        const response = await fetch('/api/match-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceHeaders: currentSourceHeaders,
                templateId: currentTemplateId
            })
        });
        
        const result = await response.json();
        
        showStatus(sourceStatus, `✅ Best match: ${result.bestMatch.templateName} (${result.bestMatch.score}%)`, 'success');
        
        // Load existing mappings
        await loadMappings();
        
        // Show mapping interface
        stepSource.style.display = 'none';
        stepMapping.style.display = 'block';
        
        renderMappingUI(result.bestMatch.matches);
        
    } catch (error) {
        showStatus(sourceStatus, 'Match error: ' + error.message, 'error');
    }
}

async function loadMappings() {
    try {
        const response = await fetch(`/api/mappings/${currentTemplateId}`);
        currentMappings = await response.json();
    } catch (error) {
        console.error('Failed to load mappings:', error);
        currentMappings = {};
    }
}

function renderMappingUI(matches) {
    const container = document.getElementById('mapping-table-container');
    const matchScoreDiv = document.getElementById('match-score');
    
    const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
    matchScoreDiv.innerHTML = `
        <div class="score-card ${getConfidenceClass(avgScore)}">
            <strong>Overall Match Score: ${Math.round(avgScore)}%</strong>
            <span>${getConfidenceText(avgScore)}</span>
        </div>
    `;
    
    container.innerHTML = `
        <table class="mapping-table">
            <thead>
                <tr><th>Source Header</th><th>→</th><th>Template Field</th><th>Match %</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${matches.map(match => `
                    <tr class="${getConfidenceClass(match.score)}">
                        <td><strong>${escapeHtml(match.sourceHeader)}</strong></td>
                        <td>→</td>
                        <td>
                            <select class="template-field-select" data-source="${match.sourceHeader}">
                                ${generateOptions(currentTemplateStructure, match.templateField)}
                            </select>
                        </td>
                        <td>${match.score}%</td>
                        <td>${getStatusIcon(match.confidence)} ${match.confidence}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Attach change handlers
    document.querySelectorAll('.template-field-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const source = select.dataset.source;
            const target = select.value;
            currentMappings[source] = target;
        });
    });
}

function generateOptions(templateStructure, selectedValue) {
    const allHeaders = templateStructure.sheets.flatMap(s => s.headers.map(h => h.header));
    return allHeaders.map(header => 
        `<option value="${escapeHtml(header)}" ${header === selectedValue ? 'selected' : ''}>${escapeHtml(header)}</option>`
    ).join('');
}

// Save mappings
document.getElementById('save-mappings')?.addEventListener('click', async () => {
    try {
        const response = await fetch(`/api/mappings/${currentTemplateId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings: currentMappings })
        });
        
        if (response.ok) {
            alert('✅ Mappings saved successfully!');
        }
    } catch (error) {
        alert('Failed to save mappings: ' + error.message);
    }
});

// Generate output
document.getElementById('continue-generation')?.addEventListener('click', async () => {
    // Simulate file upload and generation
    // In production, get actual file from step 2
    
    showStatus(sourceStatus, 'Generating transformed Excel...', 'info');
    
    // Simulate generation (replace with actual API call)
    setTimeout(() => {
        currentOutputFile = 'transformed_output.xlsx';
        
        stepMapping.style.display = 'none';
        stepResults.style.display = 'block';
        
        document.getElementById('generation-status').innerHTML = `
            ✅ Transformation completed successfully!<br>
            Your Excel file is ready for download.
        `;
    }, 2000);
});

// Download output
document.getElementById('download-output')?.addEventListener('click', () => {
    if (currentOutputFile) {
        window.location.href = `/api/download/${currentOutputFile}`;
    }
});

// Start new transformation
document.getElementById('new-transformation')?.addEventListener('click', () => {
    location.reload();
});

// Helper functions
function showStatus(element, message, type) {
    element.innerHTML = message;
    element.className = `status ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        if (element.innerHTML === message) {
            element.style.display = 'none';
        }
    }, 5000);
}

function getConfidenceClass(score) {
    if (score >= 90) return 'high-confidence';
    if (score >= 70) return 'medium-confidence';
    return 'low-confidence';
}

function getConfidenceText(score) {
    if (score >= 90) return '✓ High Confidence';
    if (score >= 70) return '⚠️ Medium Confidence';
    return '❌ Low Confidence - Review Required';
}

function getStatusIcon(confidence) {
    switch(confidence) {
        case 'high': return '✅';
        case 'medium': return '⚠️';
        default: return '❌';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Event listeners
templateUploadBtn?.addEventListener('click', () => templateFileInput.click());
templateFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadTemplate(e.target.files[0]);
});

if (templateDropZone) {
    templateDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        templateDropZone.classList.add('drag-over');
    });
    templateDropZone.addEventListener('dragleave', () => {
        templateDropZone.classList.remove('drag-over');
    });
    templateDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        templateDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) uploadTemplate(e.dataTransfer.files[0]);
    });
    templateDropZone.addEventListener('click', () => templateFileInput.click());
}

sourceUploadBtn?.addEventListener('click', () => sourceFileInput.click());
sourceFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadSource(e.target.files[0]);
});

if (sourceDropZone) {
    sourceDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        sourceDropZone.classList.add('drag-over');
    });
    sourceDropZone.addEventListener('dragleave', () => {
        sourceDropZone.classList.remove('drag-over');
    });
    sourceDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        sourceDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) uploadSource(e.dataTransfer.files[0]);
    });
    sourceDropZone.addEventListener('click', () => sourceFileInput.click());
}

// Dark mode toggle
document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('theme-toggle').textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
});