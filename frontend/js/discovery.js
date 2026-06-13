/**
 * Template Discovery Module
 * Integrates with existing UI to provide template discovery functionality
 */

const DiscoveryModule = (function() {
    // State
    let currentTemplateModel = null;
    let currentSheetIndex = 0;
    let currentFields = [];
    let editingFieldId = null;
    
    // DOM Elements (will be created dynamically)
    let discoveryModal = null;
    let discoveryResultsDiv = null;
    
    // API Base
    const API_BASE = window.location.hostname === 'localhost' || !window.location.hostname
        ? 'http://localhost:4000'
        : `http://${window.location.hostname}:4000`;
    
    /**
     * Initialize discovery module
     */
    function init() {
        createDiscoveryUI();
        attachEventListeners();
        console.log('[DiscoveryModule] Initialized');
    }
    
    /**
     * Create discovery UI elements
     */
    function createDiscoveryUI() {
        // Find main container or create one
        const mainContent = document.querySelector('.main-content') || document.body;
        
        // Create discovery section
        const discoverySection = document.createElement('section');
        discoverySection.id = 'discoverySection';
        discoverySection.className = 'discovery-section';
        discoverySection.innerHTML = `
            <div class="discovery-header">
                <h2>🔍 Template Discovery Studio</h2>
                <p>Upload an Excel template to automatically detect its structure</p>
            </div>
            <div class="discovery-upload-zone" id="discoveryUploadZone">
                <div class="upload-icon">📊</div>
                <h3>Upload Excel Template</h3>
                <p>Drag & drop or click to browse (.xlsx, .xls)</p>
                <input type="file" id="discoveryFileInput" accept=".xlsx,.xls" style="display: none;">
                <button id="discoveryBrowseBtn" class="btn btn-primary">Browse Files</button>
            </div>
            <div id="discoveryProgress" class="discovery-progress" style="display: none;">
                <div class="spinner"></div>
                <p>Analyzing template structure...</p>
            </div>
            <div id="discoveryResults" class="discovery-results" style="display: none;"></div>
        `;
        
        // Insert after upload section or at appropriate location
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection && uploadSection.parentNode) {
            uploadSection.parentNode.insertBefore(discoverySection, uploadSection.nextSibling);
        } else {
            mainContent.appendChild(discoverySection);
        }
    }
    
    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        const uploadZone = document.getElementById('discoveryUploadZone');
        const fileInput = document.getElementById('discoveryFileInput');
        const browseBtn = document.getElementById('discoveryBrowseBtn');
        
        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                }
            });
        }
        
        if (uploadZone) {
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('drag-over');
            });
            
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('drag-over');
            });
            
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    handleFileUpload(file);
                } else {
                    UI.notify('Please upload an Excel file (.xlsx or .xls)', 'danger');
                }
            });
        }
    }
    
    /**
     * Handle file upload and discovery
     */
    async function handleFileUpload(file) {
        const uploadZone = document.getElementById('discoveryUploadZone');
        const progressDiv = document.getElementById('discoveryProgress');
        const resultsDiv = document.getElementById('discoveryResults');
        
        // Show progress
        if (uploadZone) uploadZone.style.display = 'none';
        if (progressDiv) progressDiv.style.display = 'block';
        if (resultsDiv) resultsDiv.style.display = 'none';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            UI.addStatus(`[Discovery] Analyzing template: ${file.name}`);
            
            const response = await fetch(`${API_BASE}/api/templates/discover`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Discovery failed');
            }
            
            const result = await response.json();
            currentTemplateModel = result.templateModel;
            
            UI.addStatus(`[Discovery] Analysis complete! Found ${currentTemplateModel.sheets.length} sheet(s)`, 'success');
            UI.notify('Template analysis complete! Review the structure below.', 'success');
            
            displayResults(currentTemplateModel);
            
        } catch (error) {
            console.error('[Discovery] Error:', error);
            UI.addStatus(`[Discovery] Error: ${error.message}`, 'error');
            UI.notify(`Discovery failed: ${error.message}`, 'danger');
            
            // Reset UI
            if (uploadZone) uploadZone.style.display = 'block';
            if (progressDiv) progressDiv.style.display = 'none';
        }
    }
    
    /**
     * Display discovery results
     */
    function displayResults(model) {
        const progressDiv = document.getElementById('discoveryProgress');
        const resultsDiv = document.getElementById('discoveryResults');
        
        if (!resultsDiv) return;
        
        const sheet = model.sheets[0]; // Show first sheet initially
        
        resultsDiv.innerHTML = `
            <div class="discovery-card">
                <div class="discovery-card-header">
                    <h3>📋 Template Structure</h3>
                    <div class="sheet-selector">
                        <label>Sheet:</label>
                        <select id="discoverySheetSelect">
                            ${model.sheets.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h4>Template Name</h4>
                        <p>${escapeHtml(model.fileName)}</p>
                    </div>
                    <div class="info-card">
                        <h4>Detected At</h4>
                        <p>${new Date(model.detectedAt).toLocaleString()}</p>
                    </div>
                    <div class="info-card">
                        <h4>Header Row</h4>
                        <p>${sheet.headerRow}</p>
                    </div>
                    <div class="info-card">
                        <h4>Data Start Row</h4>
                        <p>${sheet.dataStartRow}</p>
                    </div>
                    <div class="info-card">
                        <h4>Data End Row</h4>
                        <p>${sheet.dataEndRow}</p>
                    </div>
                    <div class="info-card">
                        <h4>Total Columns</h4>
                        <p>${sheet.totalColumns}</p>
                    </div>
                </div>
                
                <div class="fields-section">
                    <h3>🔍 Detected Fields</h3>
                    <div class="fields-toolbar">
                        <button id="addDiscoveryFieldBtn" class="btn btn-secondary">+ Add Custom Field</button>
                    </div>
                    <div class="table-container">
                        <table class="fields-table">
                            <thead>
                                <tr><th>Field Name</th><th>Column</th><th>Required</th><th>Actions</th></tr>
                            </thead>
                            <tbody id="discoveryFieldsBody">
                                ${renderFieldsRows(sheet.fields)}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                ${sheet.formulaFields.length > 0 ? `
                <div class="formula-section">
                    <h3>⚙️ Formula Fields</h3>
                    <div class="formula-list">
                        ${sheet.formulaFields.map(f => `
                            <div class="formula-item">
                                <strong>Column ${f.column}:</strong> <code>${escapeHtml(f.formula)}</code>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${sheet.summarySections.length > 0 ? `
                <div class="summary-section">
                    <h3>📊 Summary Sections</h3>
                    <div class="summary-list">
                        ${sheet.summarySections.map(s => `
                            <div class="summary-item">
                                <strong>Location:</strong> ${s.location}<br>
                                <strong>Type:</strong> ${s.type}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div class="discovery-actions">
                    <button id="clearDiscoveryBtn" class="btn btn-secondary">Clear Results</button>
                    <button id="saveDiscoveryBtn" class="btn btn-success" disabled>
                        💾 Save Template (Phase 3)
                    </button>
                </div>
                <p class="info-note">Note: Template saving will be available in Phase 3. Field editing is client-side only.</p>
            </div>
        `;
        
        // Attach event listeners for the new elements
        attachResultEventListeners(model);
        
        if (progressDiv) progressDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
        
        // Scroll to results
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Render fields rows
     */
    function renderFieldsRows(fields) {
        if (!fields || fields.length === 0) {
            return '<tr><td colspan="4" class="text-center">No fields detected</td></tr>';
        }
        
        return fields.map(field => `
            <tr data-field-id="${field.id}">
                <td class="field-name">${escapeHtml(field.name)}</td>
                <td>${field.column}</td>
                <td>
                    <button class="toggle-required-btn ${field.required ? 'required-active' : ''}" data-field-id="${field.id}">
                        ${field.required ? '✓ Required' : '◯ Optional'}
                    </button>
                </td>
                <td>
                    <button class="edit-field-btn btn-sm" data-field-id="${field.id}">✏️ Edit</button>
                    <button class="delete-field-btn btn-sm" data-field-id="${field.id}">🗑️ Delete</button>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * Attach event listeners to result elements
     */
    function attachResultEventListeners(model) {
        // Sheet selector
        const sheetSelect = document.getElementById('discoverySheetSelect');
        if (sheetSelect) {
            sheetSelect.addEventListener('change', (e) => {
                currentSheetIndex = parseInt(e.target.value);
                displayResults(model); // Re-render with selected sheet
            });
        }
        
        // Clear button
        const clearBtn = document.getElementById('clearDiscoveryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const uploadZone = document.getElementById('discoveryUploadZone');
                const resultsDiv = document.getElementById('discoveryResults');
                if (uploadZone) uploadZone.style.display = 'block';
                if (resultsDiv) resultsDiv.style.display = 'none';
                currentTemplateModel = null;
            });
        }
        
        // Toggle required buttons
        document.querySelectorAll('.toggle-required-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldId = btn.getAttribute('data-field-id');
                toggleRequired(fieldId, model);
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-field-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldId = btn.getAttribute('data-field-id');
                showEditModal(fieldId, model);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-field-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldId = btn.getAttribute('data-field-id');
                if (confirm('Remove this field from the template?')) {
                    deleteField(fieldId, model);
                }
            });
        });
        
        // Add field button
        const addBtn = document.getElementById('addDiscoveryFieldBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => showAddFieldModal(model));
        }
    }
    
    /**
     * Toggle required status
     */
    function toggleRequired(fieldId, model) {
        const sheet = model.sheets[currentSheetIndex];
        const field = sheet.fields.find(f => f.id === fieldId);
        if (field) {
            field.required = !field.required;
            displayResults(model); // Re-render
            UI.addStatus(`[Discovery] Field "${field.name}" marked as ${field.required ? 'required' : 'optional'}`, 'info');
        }
    }
    
    /**
     * Delete field
     */
    function deleteField(fieldId, model) {
        const sheet = model.sheets[currentSheetIndex];
        const index = sheet.fields.findIndex(f => f.id === fieldId);
        if (index !== -1) {
            const deleted = sheet.fields.splice(index, 1)[0];
            displayResults(model);
            UI.addStatus(`[Discovery] Removed field: "${deleted.name}"`, 'warning');
        }
    }
    
    /**
     * Show edit modal for field
     */
    function showEditModal(fieldId, model) {
        const sheet = model.sheets[currentSheetIndex];
        const field = sheet.fields.find(f => f.id === fieldId);
        if (!field) return;
        
        editingFieldId = fieldId;
        
        // Create modal if not exists
        let modal = document.getElementById('discoveryEditModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'discoveryEditModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Field</h3>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <label>Field Name:</label>
                        <input type="text" id="discoveryEditFieldName" placeholder="Enter field name">
                    </div>
                    <div class="modal-footer">
                        <button id="discoverySaveFieldBtn" class="btn btn-primary">Save</button>
                        <button id="discoveryCancelFieldBtn" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        const input = document.getElementById('discoveryEditFieldName');
        if (input) input.value = field.name;
        
        modal.style.display = 'flex';
        
        // Close handlers
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('discoveryCancelFieldBtn');
        const saveBtn = document.getElementById('discoverySaveFieldBtn');
        
        const closeModal = () => modal.style.display = 'none';
        
        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (saveBtn) {
            saveBtn.onclick = () => {
                const newName = input ? input.value.trim() : field.name;
                if (newName) {
                    field.name = newName;
                    displayResults(model);
                    UI.addStatus(`[Discovery] Renamed field to "${newName}"`, 'success');
                }
                closeModal();
            };
        }
        
        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    /**
     * Show add field modal
     */
    function showAddFieldModal(model) {
        let modal = document.getElementById('discoveryAddModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'discoveryAddModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add Custom Field</h3>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <label>Field Name:</label>
                        <input type="text" id="discoveryAddFieldName" placeholder="Enter field name">
                        <label style="margin-top: 1rem;">Column:</label>
                        <input type="text" id="discoveryAddColumn" placeholder="e.g., G" maxlength="2">
                    </div>
                    <div class="modal-footer">
                        <button id="discoveryConfirmAddBtn" class="btn btn-primary">Add</button>
                        <button id="discoveryCancelAddBtn" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'flex';
        
        const nameInput = document.getElementById('discoveryAddFieldName');
        const columnInput = document.getElementById('discoveryAddColumn');
        if (nameInput) nameInput.value = '';
        if (columnInput) columnInput.value = '';
        
        const closeModal = () => modal.style.display = 'none';
        
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('discoveryCancelAddBtn');
        const addBtn = document.getElementById('discoveryConfirmAddBtn');
        
        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (addBtn) {
            addBtn.onclick = () => {
                const newName = nameInput ? nameInput.value.trim() : '';
                const column = columnInput ? columnInput.value.trim().toUpperCase() : 'A';
                
                if (newName) {
                    const sheet = model.sheets[currentSheetIndex];
                    const newField = {
                        id: `field_${Date.now()}_${Math.random()}`,
                        name: newName,
                        column: column,
                        columnIndex: sheet.fields.length,
                        required: false,
                        detected: false,
                        sampleValues: []
                    };
                    sheet.fields.push(newField);
                    displayResults(model);
                    UI.addStatus(`[Discovery] Added custom field: "${newName}"`, 'success');
                }
                closeModal();
            };
        }
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public API
    return {
        init: init
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DiscoveryModule.init());
} else {
    DiscoveryModule.init();
}
/**
 * Save template to registry
 */
async function saveToRegistry(model) {
    try {
        UI.addStatus('[Registry] Saving template to registry...');
        
        const response = await fetch(`${API_BASE}/api/templates/registry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ templateModel: model })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }
        
        const result = await response.json();
        UI.addStatus(`[Registry] Template saved! ID: ${result.templateId}`, 'success');
        UI.notify(`Template "${model.fileName}" saved to registry. Awaiting approval.`, 'success');
        
        return result;
    } catch (error) {
        console.error('[Registry] Save error:', error);
        UI.addStatus(`[Registry] Error: ${error.message}`, 'error');
        UI.notify(`Failed to save template: ${error.message}`, 'danger');
        throw error;
    }
}