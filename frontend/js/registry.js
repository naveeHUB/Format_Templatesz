/**
 * Template Registry Module
 * Manages template listing, approval, and deletion
 */

const RegistryModule = (function() {
    let currentTemplates = [];
    
    const API_BASE = window.location.hostname === 'localhost' || !window.location.hostname
        ? 'http://localhost:4000'
        : `http://${window.location.hostname}:4000`;
    
    /**
     * Initialize registry module
     */
    function init() {
        createRegistryUI();
        loadTemplates();
        setupEventListeners();
        console.log('[RegistryModule] Initialized');
    }
    
    /**
     * Create registry UI
     */
    function createRegistryUI() {
        // Check if registry section already exists
        if (document.getElementById('registrySection')) return;
        
        const mainContent = document.querySelector('.main-content') || document.body;
        
        const registrySection = document.createElement('section');
        registrySection.id = 'registrySection';
        registrySection.className = 'registry-section';
        registrySection.innerHTML = `
            <div class="registry-header">
                <h2>📚 Template Registry</h2>
                <p>Manage your approved and pending templates</p>
                <button id="refreshRegistryBtn" class="btn btn-secondary">🔄 Refresh</button>
            </div>
            <div id="registryStats" class="registry-stats"></div>
            <div id="templatesList" class="templates-list">
                <div class="loading-spinner">Loading templates...</div>
            </div>
        `;
        
        // Insert after discovery section
        const discoverySection = document.getElementById('discoverySection');
        if (discoverySection && discoverySection.parentNode) {
            discoverySection.parentNode.insertBefore(registrySection, discoverySection.nextSibling);
        } else {
            mainContent.appendChild(registrySection);
        }
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const refreshBtn = document.getElementById('refreshRegistryBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => loadTemplates());
        }
    }
    
    /**
     * Load templates from registry
     */
    async function loadTemplates() {
        try {
            UI.addStatus('[Registry] Loading templates...');
            
            const response = await fetch(`${API_BASE}/api/templates/registry`);
            
            if (!response.ok) {
                throw new Error('Failed to load templates');
            }
            
            const result = await response.json();
            currentTemplates = result.templates || [];
            
            displayTemplates(currentTemplates);
            updateStats(currentTemplates);
            
            UI.addStatus(`[Registry] Loaded ${currentTemplates.length} template(s)`, 'success');
        } catch (error) {
            console.error('[Registry] Load error:', error);
            UI.addStatus(`[Registry] Error: ${error.message}`, 'error');
            
            const templatesList = document.getElementById('templatesList');
            if (templatesList) {
                templatesList.innerHTML = `
                    <div class="error-message">
                        Failed to load templates: ${error.message}
                        <button onclick="RegistryModule.loadTemplates()" class="btn btn-secondary">Retry</button>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Update registry statistics
     */
    function updateStats(templates) {
        const statsDiv = document.getElementById('registryStats');
        if (!statsDiv) return;
        
        const approved = templates.filter(t => t.approved).length;
        const pending = templates.filter(t => !t.approved).length;
        
        statsDiv.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${templates.length}</div>
                <div class="stat-label">Total Templates</div>
            </div>
            <div class="stat-card approved">
                <div class="stat-value">${approved}</div>
                <div class="stat-label">Approved</div>
            </div>
            <div class="stat-card pending">
                <div class="stat-value">${pending}</div>
                <div class="stat-label">Pending</div>
            </div>
        `;
    }
    
    /**
     * Display templates list
     */
    function displayTemplates(templates) {
        const container = document.getElementById('templatesList');
        if (!container) return;
        
        if (templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No templates yet</h3>
                    <p>Use the Discovery Studio above to analyze and save your first template.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = templates.map(template => `
            <div class="template-card ${template.approved ? 'approved' : 'pending'}">
                <div class="template-header">
                    <div class="template-title">
                        <h3>${escapeHtml(template.templateName)}</h3>
                        <span class="template-status ${template.approved ? 'status-approved' : 'status-pending'}">
                            ${template.approved ? '✓ Approved' : '⏳ Pending'}
                        </span>
                    </div>
                    <div class="template-version">v${template.version}</div>
                </div>
                
                <div class="template-details">
                    <div class="detail-item">
                        <strong>ID:</strong> 
                        <code>${template.templateId.substring(0, 8)}...</code>
                    </div>
                    <div class="detail-item">
                        <strong>Created:</strong> 
                        ${new Date(template.createdAt).toLocaleDateString()}
                    </div>
                    <div class="detail-item">
                        <strong>Sheets:</strong> 
                        ${template.sheets.length}
                    </div>
                    <div class="detail-item">
                        <strong>Fields:</strong> 
                        ${template.sheets.reduce((sum, sheet) => sum + sheet.fields.length, 0)}
                    </div>
                </div>
                
                <div class="template-actions">
                    ${!template.approved ? `
                        <button class="btn btn-success approve-template" data-id="${template.templateId}">
                            ✓ Approve
                        </button>
                    ` : ''}
                    <button class="btn btn-danger delete-template" data-id="${template.templateId}">
                        🗑️ Delete
                    </button>
                    <button class="btn btn-secondary view-template" data-id="${template.templateId}">
                        👁️ View Details
                    </button>
                </div>
            </div>
        `).join('');
        
        // Attach event handlers
        attachCardEventHandlers();
    }
    
    /**
     * Attach event handlers to template cards
     */
    function attachCardEventHandlers() {
        // Approve buttons
        document.querySelectorAll('.approve-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = btn.getAttribute('data-id');
                await approveTemplate(templateId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = btn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this template? This cannot be undone.')) {
                    await deleteTemplate(templateId);
                }
            });
        });
        
        // View buttons
        document.querySelectorAll('.view-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = btn.getAttribute('data-id');
                await viewTemplateDetails(templateId);
            });
        });
    }
    
    /**
     * Approve a template
     */
    async function approveTemplate(templateId) {
        try {
            UI.addStatus(`[Registry] Approving template...`);
            
            const response = await fetch(`${API_BASE}/api/templates/registry/${templateId}/approve`, {
                method: 'PUT'
            });
            
            if (!response.ok) {
                throw new Error('Failed to approve template');
            }
            
            UI.addStatus(`[Registry] Template approved successfully!`, 'success');
            UI.notify('Template approved successfully', 'success');
            
            // Reload templates
            await loadTemplates();
        } catch (error) {
            console.error('[Registry] Approve error:', error);
            UI.addStatus(`[Registry] Error: ${error.message}`, 'error');
            UI.notify(`Failed to approve template: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Delete a template
     */
    async function deleteTemplate(templateId) {
        try {
            UI.addStatus(`[Registry] Deleting template...`);
            
            const response = await fetch(`${API_BASE}/api/templates/registry/${templateId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete template');
            }
            
            UI.addStatus(`[Registry] Template deleted successfully`, 'warning');
            UI.notify('Template deleted successfully', 'info');
            
            // Reload templates
            await loadTemplates();
        } catch (error) {
            console.error('[Registry] Delete error:', error);
            UI.addStatus(`[Registry] Error: ${error.message}`, 'error');
            UI.notify(`Failed to delete template: ${error.message}`, 'danger');
        }
    }
    
    /**
     * View template details in modal
     */
    async function viewTemplateDetails(templateId) {
        try {
            const response = await fetch(`${API_BASE}/api/templates/registry/${templateId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load template details');
            }
            
            const result = await response.json();
            const template = result.template;
            
            showTemplateDetailsModal(template);
        } catch (error) {
            console.error('[Registry] View error:', error);
            UI.notify(`Failed to load template details: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Show template details modal
     */
    function showTemplateDetailsModal(template) {
        // Create modal if not exists
        let modal = document.getElementById('templateDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'templateDetailsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>📄 ${escapeHtml(template.templateName)}</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="details-grid">
                        <div><strong>Template ID:</strong><br><code>${template.templateId}</code></div>
                        <div><strong>Version:</strong><br>${template.version}</div>
                        <div><strong>Status:</strong><br>${template.approved ? '✓ Approved' : '⏳ Pending'}</div>
                        <div><strong>Created:</strong><br>${new Date(template.createdAt).toLocaleString()}</div>
                        <div><strong>Last Updated:</strong><br>${new Date(template.updatedAt).toLocaleString()}</div>
                    </div>
                    
                    ${template.sheets.map(sheet => `
                        <div class="sheet-details">
                            <h4>📊 Sheet: ${escapeHtml(sheet.name)}</h4>
                            <div class="sheet-info">
                                <span>Header Row: ${sheet.headerRow}</span>
                                <span>Data Start: ${sheet.dataStartRow}</span>
                                <span>Data End: ${sheet.dataEndRow}</span>
                            </div>
                            <h5>Fields:</h5>
                            <table class="fields-table">
                                <thead><tr><th>Name</th><th>Column</th><th>Required</th></tr></thead>
                                <tbody>
                                    ${sheet.fields.map(f => `
                                        <tr>
                                            <td>${escapeHtml(f.name)}</td>
                                            <td>${f.column}</td>
                                            <td>${f.required ? '✓' : '○'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ${sheet.formulaFields.length > 0 ? `
                                <h5>Formula Fields:</h5>
                                <div class="formula-list">
                                    ${sheet.formulaFields.map(f => `
                                        <div><strong>Column ${f.column}:</strong> <code>${escapeHtml(f.formula)}</code></div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-modal">Close</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Close handlers
        const closeBtn = modal.querySelector('.modal-close');
        const closeModalBtn = modal.querySelector('.close-modal');
        const closeModal = () => modal.style.display = 'none';
        
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeModalBtn) closeModalBtn.onclick = closeModal;
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public API
    return {
        init: init,
        loadTemplates: loadTemplates
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RegistryModule.init());
} else {
    RegistryModule.init();
}