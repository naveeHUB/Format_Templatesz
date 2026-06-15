let currentTemplateId = null;
let currentTemplateStructure = null;
let currentSourceHeaders = null;
let currentSourceFile = null;
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

// Modern Toast Notification System
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    
    toast.innerHTML = `
        <span style="font-size: 1.25rem;">${icon}</span>
        <div style="flex: 1;">
            <strong style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 2px;">${title}</strong>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${message}</span>
        </div>
        <button style="background: transparent; border: none; font-size: 1rem; color: var(--text-secondary); cursor: pointer;" onclick="this.parentElement.remove()">✕</button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Progress bar animation
    const progress = toast.querySelector('.toast-progress');
    progress.style.transition = 'width 3s linear';
    setTimeout(() => {
        progress.style.width = '0%';
    }, 10);
    
    // Auto dismiss
    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation Step & Stepper Progress
function updateNavigation(stepNumber) {
    // Update active nav-item in sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.step) === stepNumber) {
            item.classList.add('active');
        }
    });
    
    // Update stepper progress fill
    const progressPercent = ((stepNumber - 1) / 5) * 100;
    const progressFill = document.getElementById('stepper-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    
    // Update step nodes
    for (let i = 1; i <= 6; i++) {
        const node = document.getElementById(`step-node-${i}`);
        if (node) {
            node.classList.remove('active', 'completed');
            if (i < stepNumber) {
                node.classList.add('completed');
            } else if (i === stepNumber) {
                node.classList.add('active');
            }
        }
    }
}

// Step 1: Upload and analyze template
async function uploadTemplate(file) {
    if (!file || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls'))) {
        showToast('Invalid File', 'Please upload a valid Excel workbook (.xlsx or .xls)', 'error');
        return;
    }
    
    const templateId = 'template_' + Date.now();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId);
    formData.append('templateName', file.name.replace('.xlsx', '').replace('.xls', ''));
    
    showStatus(templateStatus, 'Analyzing template structure...', 'info');
    showToast('Analyzing Template', 'Extracting sheets, formatting and structure...', 'info');
    
    if (templateUploadBtn) {
        templateUploadBtn.classList.add('btn-loading');
        templateUploadBtn.disabled = true;
    }
    
    try {
        const response = await fetch('/api/analyze-template', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Analysis failed');
        
        currentTemplateId = templateId;
        currentTemplateStructure = await response.json();
        
        showStatus(templateStatus, '✅ Template analyzed successfully!', 'success');
        showToast('Success', 'Template analyzed successfully!', 'success');
        displayTemplateStructure(currentTemplateStructure);
        
    } catch (error) {
        showStatus(templateStatus, 'Error: ' + error.message, 'error');
        showToast('Error', 'Template analysis failed: ' + error.message, 'error');
    } finally {
        if (templateUploadBtn) {
            templateUploadBtn.classList.remove('btn-loading');
            templateUploadBtn.disabled = false;
        }
    }
}

function displayTemplateStructure(structure) {
    const parentContainer = document.getElementById('template-structure');
    if (parentContainer) parentContainer.style.display = 'block';
    
    const container = document.getElementById('structure-display');
    if (container) {
        container.style.display = 'block';
        container.innerHTML = `
            <div class="structure-summary" style="background: var(--bg-app); border: 1px solid var(--border); padding: 15px; border-radius: var(--radius-lg); margin-bottom: 20px;">
                <p style="margin-bottom: 5px;"><strong>Template Name:</strong> ${structure.templateName}</p>
                <p style="margin-bottom: 0;"><strong>Sheets Count:</strong> ${structure.sheetCount}</p>
            </div>
            <div class="sheets-list">
                ${structure.sheets.map(sheet => `
                    <div class="sheet-card">
                        <h4>📄 ${sheet.sheetName}</h4>
                        <p style="margin-top: 10px;"><strong>Headers:</strong> ${sheet.headers.map(h => h.header).join(', ')}</p>
                        <p style="margin-top: 5px; color: var(--text-secondary);">Columns: ${sheet.columnCount} | Rows: ${sheet.rowCount}</p>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 30px; text-align: right;">
                <button id="template-continue-btn" class="primary-btn" style="padding: 12px 24px; font-size: 14px;">Continue to Step 2 →</button>
            </div>
        `;
        
        document.getElementById('template-continue-btn')?.addEventListener('click', () => {
            showStepSource();
        });
    }
}

function showStepSource() {
    stepTemplate.style.display = 'none';
    stepSource.style.display = 'block';
    
    const matchingContainer = document.getElementById('matching-results-container');
    if (matchingContainer) matchingContainer.style.display = 'none';
    
    const dropZone = document.getElementById('source-drop-zone');
    if (dropZone) dropZone.style.display = 'block';
    
    updateNavigation(2);
}

// Step 2: Upload source file
const sourceDropZone = document.getElementById('source-drop-zone');
const sourceFileInput = document.getElementById('source-file-input');
const sourceUploadBtn = document.getElementById('source-upload-btn');
const sourceStatus = document.getElementById('source-status');

async function uploadSource(file) {
    if (!file || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls'))) {
        showToast('Invalid File', 'Please upload a valid Excel workbook (.xlsx or .xls)', 'error');
        return;
    }
    
    currentSourceFile = file;
    showStatus(sourceStatus, 'Analyzing source file...', 'info');
    showToast('Analyzing Source', 'Extracting file header names...', 'info');
    
    if (sourceUploadBtn) {
        sourceUploadBtn.classList.add('btn-loading');
        sourceUploadBtn.disabled = true;
    }
    
    try {
        currentSourceHeaders = await extractSourceHeaders(file);
        
        showStatus(sourceStatus, `✅ Source file analyzed!`, 'success');
        showToast('Success', 'Source file headers parsed successfully!', 'success');
        
        // Match with template
        await matchTemplate();
        
    } catch (error) {
        showStatus(sourceStatus, 'Error analyzing source: ' + error.message, 'error');
        showToast('Error', 'Source analysis failed: ' + error.message, 'error');
    } finally {
        if (sourceUploadBtn) {
            sourceUploadBtn.classList.remove('btn-loading');
            sourceUploadBtn.disabled = false;
        }
    }
}

async function extractSourceHeaders(file) {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1);
    
    const headers = [];
    let headerRowIndex = 1;
    for (let i = 1; i <= 10; i++) {
        const row = worksheet.getRow(i);
        let cellCount = 0;
        row.eachCell(cell => {
            if (cell.value !== null && cell.value !== undefined && cell.value.toString().trim()) {
                cellCount++;
            }
        });
        if (cellCount >= 2) {
            headerRowIndex = i;
            break;
        }
    }
    
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell(cell => {
        const val = cell.value;
        if (val !== null && val !== undefined) {
            const text = val.toString().trim();
            if (text) headers.push(text);
        }
    });
    return headers;
}

let currentMatchResults = null;

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
        
        if (!response.ok) throw new Error('Match failed');
        currentMatchResults = await response.json();
        
        renderMatchingResults(currentMatchResults);
        
    } catch (error) {
        showStatus(sourceStatus, 'Match error: ' + error.message, 'error');
    }
}

function renderMatchingResults(result) {
    const bestMatch = result.bestMatch;
    const alternatives = result.alternatives || [];
    
    let container = document.getElementById('matching-results-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'matching-results-container';
        container.style.marginTop = '20px';
        stepSource.appendChild(container);
    }
    container.style.display = 'block';
    
    // Hide the upload card (drop zone)
    const dropZone = document.getElementById('source-drop-zone');
    if (dropZone) dropZone.style.display = 'none';
    
    const altHtml = alternatives.map(alt => `
        <div class="alt-match-card" style="border: 1px solid var(--border); padding: 15px; margin-top: 15px; border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); box-shadow: var(--shadow-sm);">
            <div>
                <strong style="font-size: 0.95rem; display: block; margin-bottom: 4px;">${escapeHtml(alt.templateName)}</strong>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Score: ${alt.score}% | ${alt.confidence} confidence</span>
            </div>
            <button class="secondary-btn select-template-btn" data-id="${alt.templateId}">Use This Template</button>
        </div>
    `).join('');
    
    container.innerHTML = `
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: var(--space-3);">🎯 Step 3: Template Match Results</h3>
        <div class="best-match-card ${getConfidenceClass(bestMatch.score)}" style="border: 1px solid var(--border); padding: var(--space-5); border-radius: var(--radius-xl); margin-bottom: var(--space-4); background: var(--primary-light); box-shadow: var(--shadow-sm);">
            <h4 style="font-size: 1.15rem; font-weight: 600; color: var(--primary); margin-bottom: var(--space-2);">🏆 Best Match: ${escapeHtml(bestMatch.templateName)}</h4>
            <p style="font-size: 0.875rem; margin-bottom: var(--space-3);">Match Confidence: <strong>${bestMatch.score}%</strong> (${getConfidenceText(bestMatch.score)})</p>
            <div>
                <button id="use-best-template" class="primary-btn" data-id="${bestMatch.templateId}">Use This Template</button>
            </div>
        </div>
        
        ${alternatives.length > 0 ? `
            <div class="alternative-matches" style="margin-top: 30px;">
                <h5 style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-2);">Alternative Templates</h5>
                ${altHtml}
            </div>
        ` : ''}
        
        <div style="margin-top: 35px; text-align: right; border-top: 1px solid var(--border); padding-top: 20px;">
            <button id="continue-to-mapping" class="success-btn" style="padding: 12px 24px; font-size: 14px;">Continue to Mapping →</button>
        </div>
    `;
    
    document.getElementById('use-best-template')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await loadTemplate(id);
    });
    
    document.querySelectorAll('.select-template-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await loadTemplate(id);
        });
    });
    
    document.getElementById('continue-to-mapping')?.addEventListener('click', () => {
        stepSource.style.display = 'none';
        stepMapping.style.display = 'block';
        renderMappingUI();
        updateNavigation(4);
    });
    
    updateNavigation(3);
}

async function loadTemplate(templateId) {
    currentTemplateId = templateId;
    await loadMappings();
    
    if (!currentTemplateStructure || currentTemplateStructure.templateId !== templateId) {
        if (currentMatchResults) {
            const found = [currentMatchResults.bestMatch, ...currentMatchResults.alternatives]
                .find(t => t && t.templateId === templateId);
            if (found) {
                currentTemplateStructure = {
                    templateId: found.templateId,
                    templateName: found.templateName,
                    sheets: [
                        {
                            sheetName: "Sheet1",
                            headers: found.matches.map(m => ({ header: m.templateField }))
                        }
                    ]
                };
            }
        }
    }
    showToast('Template Loaded', `Successfully loaded template: ${templateId}`, 'success');
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

function renderMappingUI() {
    if (!currentMatchResults) return;
    
    const activeMatch = [currentMatchResults.bestMatch, ...currentMatchResults.alternatives]
        .find(t => t && t.templateId === currentTemplateId) || currentMatchResults.bestMatch;
        
    const matches = activeMatch.matches;
    const container = document.getElementById('mapping-table-container');
    const matchScoreDiv = document.getElementById('match-score');
    
    const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
    matchScoreDiv.innerHTML = `
        <div class="score-card ${getConfidenceClass(avgScore)}" style="margin-bottom: var(--space-4);">
            <strong style="font-size: 1.1rem; display: block; margin-bottom: var(--space-1);">Overall Match Score: ${Math.round(avgScore)}%</strong>
            <span style="font-size: 0.875rem; color: var(--text-secondary);">${getConfidenceText(avgScore)}</span>
        </div>
    `;
    
    matches.forEach(match => {
        if (!currentMappings[match.sourceHeader]) {
            currentMappings[match.sourceHeader] = match.templateField;
        }
    });
    
    container.innerHTML = `
        <table class="mapping-table" style="box-shadow: var(--shadow-sm); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;">
            <thead>
                <tr>
                    <th style="width: 30%;">Source Header</th>
                    <th style="width: 10%; text-align: center;">→</th>
                    <th style="width: 30%;">Template Field</th>
                    <th style="width: 15%;">Match %</th>
                    <th style="width: 15%;">Confidence</th>
                </tr>
            </thead>
            <tbody>
                ${matches.map(match => {
                    const selectedField = currentMappings[match.sourceHeader] || match.templateField;
                    return `
                        <tr class="${getConfidenceClass(match.score)}">
                            <td style="font-weight: 500;">${escapeHtml(match.sourceHeader)}</td>
                            <td style="text-align: center; color: var(--text-secondary);">→</td>
                            <td>
                                <select class="template-field-select" data-source="${match.sourceHeader}">
                                    ${generateOptions(currentTemplateStructure, selectedField)}
                                </select>
                            </td>
                            <td style="font-weight: 600;">${match.score}%</td>
                            <td style="font-weight: 500;">${getStatusIcon(match.confidence)} ${match.confidence}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    document.querySelectorAll('.template-field-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const source = select.dataset.source;
            const target = select.value;
            currentMappings[source] = target;
        });
    });
}

function generateOptions(templateStructure, selectedValue) {
    if (!templateStructure || !templateStructure.sheets) return '';
    const allHeaders = templateStructure.sheets.flatMap(s => s.headers.map(h => h.header));
    return allHeaders.map(header => 
        `<option value="${escapeHtml(header)}" ${header === selectedValue ? 'selected' : ''}>${escapeHtml(header)}</option>`
    ).join('');
}

async function saveMappings() {
    try {
        const response = await fetch(`/api/mappings/${currentTemplateId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings: currentMappings })
        });
        
        if (response.ok) {
            const btn = document.getElementById('save-mappings');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Saved!';
                btn.disabled = true;
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }, 2000);
            }
            showToast('Saved Mappings', 'Column mappings successfully saved on the server!', 'success');
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        showToast('Error', 'Failed to save mappings: ' + error.message, 'error');
    }
}

async function loadExcelJS() {
    if (window.ExcelJS) return window.ExcelJS;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        script.onload = () => resolve(window.ExcelJS);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function getSourcePreviewData() {
    if (!currentSourceFile) return [];
    
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await currentSourceFile.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1);
    
    let headerRowIndex = 1;
    for (let i = 1; i <= 10; i++) {
        const row = worksheet.getRow(i);
        let cellCount = 0;
        row.eachCell(cell => {
            if (cell.value !== null && cell.value !== undefined && cell.value.toString().trim()) {
                cellCount++;
            }
        });
        if (cellCount >= 2) {
            headerRowIndex = i;
            break;
        }
    }
    
    const headers = [];
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell(cell => {
        const val = cell.value;
        if (val !== null && val !== undefined) {
            headers.push(val.toString().trim());
        }
    });
    
    const previewRows = [];
    const startRow = headerRowIndex + 1;
    const endRow = Math.min(worksheet.rowCount, startRow + 3);
    
    for (let r = startRow; r < endRow; r++) {
        const row = worksheet.getRow(r);
        const rowData = {};
        headers.forEach((h, idx) => {
            const cell = row.getCell(idx + 1);
            rowData[h] = cell.value ? cell.value.toString() : '';
        });
        previewRows.push(rowData);
    }
    return previewRows;
}

function getMappedPreviewData(sourcePreview) {
    return sourcePreview.map(row => {
        const mappedRow = {};
        for (const [sourceField, targetField] of Object.entries(currentMappings)) {
            if (row[sourceField] !== undefined) {
                mappedRow[targetField] = row[sourceField];
            }
        }
        return mappedRow;
    });
}

async function showGenerationPreview() {
    try {
        const sourceData = await getSourcePreviewData();
        const outputData = getMappedPreviewData(sourceData);
        
        stepMapping.style.display = 'none';
        
        let previewContainer = document.getElementById('step-preview-container');
        if (!previewContainer) {
            previewContainer = document.createElement('section');
            previewContainer.id = 'step-preview-container';
            previewContainer.className = 'step-section';
            stepMapping.parentNode.insertBefore(previewContainer, stepResults);
        }
        previewContainer.style.display = 'block';
        
        const sourceRowsHtml = sourceData.map(row => `
            <tr>
                ${Object.values(row).map(val => `<td style="padding: 10px; border-bottom: 1px solid var(--border);">${escapeHtml(val)}</td>`).join('')}
            </tr>
        `).join('');
        
        const sourceHeadersHtml = sourceData[0] ? Object.keys(sourceData[0]).map(h => `<th style="padding: 10px; background: var(--bg-app); border-bottom: 1px solid var(--border);">${escapeHtml(h)}</th>`).join('') : '';
        
        const outputRowsHtml = outputData.map(row => `
            <tr>
                ${Object.values(row).map(val => `<td style="padding: 10px; border-bottom: 1px solid var(--border);">${escapeHtml(val)}</td>`).join('')}
            </tr>
        `).join('');
        
        const outputHeadersHtml = outputData[0] ? Object.keys(outputData[0]).map(h => `<th style="padding: 10px; background: var(--bg-app); border-bottom: 1px solid var(--border);">${escapeHtml(h)}</th>`).join('') : '';
        
        previewContainer.innerHTML = `
            <h2>📋 Step 5: Generation Preview</h2>
            <p>Compare the raw source data with the mapped template structure (first 3 rows):</p>
            
            <div style="display: flex; flex-direction: column; gap: var(--space-5); margin-top: 20px;">
                <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); background: var(--bg-card);">
                    <h4 style="margin-bottom: 10px; font-weight: 600; color: var(--text-secondary);">Source Data Preview (First 3 Rows)</h4>
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead><tr>${sourceHeadersHtml}</tr></thead>
                        <tbody>${sourceRowsHtml}</tbody>
                    </table>
                </div>
                <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); background: var(--bg-card);">
                    <h4 style="margin-bottom: 10px; font-weight: 600; color: var(--secondary);">Mapped Output Preview (First 3 Rows)</h4>
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead><tr>${outputHeadersHtml}</tr></thead>
                        <tbody>${outputRowsHtml}</tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 35px; text-align: right; border-top: 1px solid var(--border); padding-top: 20px;">
                <button id="confirm-generate-btn" class="success-btn" style="padding: 12px 24px; font-size: 14px;">Confirm & Generate →</button>
            </div>
        `;
        
        document.getElementById('confirm-generate-btn')?.addEventListener('click', async () => {
            await generateOutput();
        });
        
    } catch (error) {
        showToast('Error', 'Failed to prepare preview: ' + error.message, 'error');
    }
}

async function generateOutput() {
    if (!currentSourceFile) {
        showToast('Warning', 'Please upload a source file first', 'warning');
        return;
    }
    
    const btn = document.getElementById('confirm-generate-btn');
    if (btn) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
    }
    
    const formData = new FormData();
    formData.append('file', currentSourceFile);
    formData.append('templateId', currentTemplateId);
    formData.append('mappings', JSON.stringify(currentMappings));
    
    try {
        const response = await fetch('/api/transform', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Generation failed');
        
        const result = await response.json();
        currentOutputFile = result.outputFilename;
        
        const previewContainer = document.getElementById('step-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
        
        stepResults.style.display = 'block';
        
        const fileSizeStr = formatBytes(currentSourceFile.size);
        document.getElementById('generation-status').innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <span style="font-size: 3rem; display: block; margin-bottom: 10px;">🎉</span>
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 10px;">Transformation Completed Successfully!</h3>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">Your Excel workbook has been transformed and is ready for download.</p>
                <div class="stats-card" style="background: var(--bg-app); padding: var(--space-4); border-radius: var(--radius-lg); margin: var(--space-4) auto; max-width: 500px; text-align: left; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                    <p style="margin-bottom: var(--space-2);"><strong>Output Filename:</strong> ${escapeHtml(result.outputFilename)}</p>
                    <p style="margin-bottom: var(--space-2);"><strong>File Size:</strong> ${fileSizeStr}</p>
                    <p style="margin-bottom: var(--space-2);"><strong>Processed Rows:</strong> ${currentTemplateStructure ? currentTemplateStructure.sheets[0].rowCount : 'N/A'}</p>
                    <p style="margin-bottom: 0; color: var(--text-secondary);"><strong>Completed At:</strong> ${new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        `;
        showToast('Success', 'Excel workbook generated successfully!', 'success');
        updateNavigation(6);
    } catch (error) {
        showToast('Error', 'Failed to generate file: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    }
}

function downloadOutput() {
    if (currentOutputFile) {
        window.location.href = `/api/download/${currentOutputFile}`;
        showToast('Downloading', 'Initializing Excel file download...', 'info');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sidebar and Hamburger Menu Interactions
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    
    sidebarToggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
        sidebarToggle.textContent = sidebar?.classList.contains('collapsed') ? '▶' : '◀';
    });
    
    hamburgerMenu?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
    });
    
    // Close sidebar on item click on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar?.classList.remove('open');
        });
    });
    
    // Initialize navigation bar indicator
    updateNavigation(1);
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

// Save mappings event
document.getElementById('save-mappings')?.addEventListener('click', async () => {
    await saveMappings();
});

// Continue generation event
document.getElementById('continue-generation')?.addEventListener('click', async () => {
    await showGenerationPreview();
    updateNavigation(5);
});

// Download output event
document.getElementById('download-output')?.addEventListener('click', () => {
    downloadOutput();
});

// Start new transformation event
document.getElementById('new-transformation')?.addEventListener('click', () => {
    location.reload();
});