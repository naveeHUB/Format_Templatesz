// Template Discovery Module
document.addEventListener('DOMContentLoaded', function() {
    const templateList = document.getElementById('template-list');
    const searchInput = document.getElementById('search-templates');
    const categoryFilter = document.getElementById('category-filter');
    const industryFilter = document.getElementById('industry-filter');
    const editModal = document.getElementById('templateEditModal');
    const editForm = document.getElementById('edit-template-form');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelBtn = document.querySelector('.cancel-btn');
    
    let currentTemplates = [];
    let currentEditId = null;
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function showNotification(message, type = 'info') {
        const statusDiv = document.getElementById('upload-status');
        if (statusDiv) {
            const prefix = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
            statusDiv.innerHTML = `${prefix} ${message}`;
            statusDiv.style.color = type === 'error' ? '#f44336' : '#4CAF50';
            setTimeout(() => {
                if (statusDiv.innerHTML.includes(message)) statusDiv.innerHTML = '';
            }, 3000);
        }
    }
    
    async function fetchTemplates() {
        if (!templateList) return;
        templateList.innerHTML = '<div class="loading-spinner">Loading templates...</div>';
        
        try {
            console.log('Fetching templates from /api/discovery/templates');
            const response = await fetch('/api/discovery/templates');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response is not JSON');
            }
            
            currentTemplates = await response.json();
            console.log('Templates loaded:', currentTemplates.length);
            displayTemplates(currentTemplates);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            templateList.innerHTML = `<div class="empty-message">❌ Failed to load templates: ${error.message}</div>`;
        }
    }
    
    function displayTemplates(templates) {
        if (!templateList) return;
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const category = categoryFilter ? categoryFilter.value : 'all';
        const industry = industryFilter ? industryFilter.value : 'all';
        
        const filtered = templates.filter(template => {
            const matchesSearch = !searchTerm || 
                template.name.toLowerCase().includes(searchTerm) ||
                (template.description && template.description.toLowerCase().includes(searchTerm));
            const matchesCategory = category === 'all' || template.category === category;
            const matchesIndustry = industry === 'all' || template.industry === industry;
            return matchesSearch && matchesCategory && matchesIndustry;
        });
        
        if (filtered.length === 0) {
            templateList.innerHTML = '<div class="empty-message">No templates found matching your criteria</div>';
            return;
        }
        
        templateList.innerHTML = filtered.map(template => `
            <div class="template-card" data-id="${template.id}">
                <h3>${escapeHtml(template.name)}</h3>
                <p>${escapeHtml(template.description || 'No description available')}</p>
                <div class="template-meta">
                    <span class="template-badge">📁 ${escapeHtml(template.category || 'Uncategorized')}</span>
                    <span class="template-badge">🏭 ${escapeHtml(template.industry || 'General')}</span>
                    <span class="template-badge">📌 v${template.version || 1}</span>
                </div>
                <div class="card-actions">
                    <button class="edit-btn" data-id="${template.id}">✏️ Edit</button>
                    <button class="select-btn" data-id="${template.id}">📌 Select Template</button>
                    <button class="delete-btn" data-id="${template.id}" style="background: #f44336; color: white;">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                openEditModal(id);
            });
        });
        
        document.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                selectTemplate(id);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const template = currentTemplates.find(t => t.id === id);
                if (confirm(`Delete template "${template?.name}"?`)) {
                    await deleteTemplate(id);
                }
            });
        });
    }
    
    async function deleteTemplate(templateId) {
        try {
            const response = await fetch(`/api/discovery/templates/${templateId}`, { method: 'DELETE' });
            if (response.ok) {
                showNotification('Template deleted', 'success');
                fetchTemplates();
            } else {
                throw new Error('Delete failed');
            }
        } catch (error) {
            showNotification('Failed to delete template', 'error');
        }
    }
    
    function openEditModal(templateId) {
        const template = currentTemplates.find(t => t.id === templateId);
        if (!template) return;
        currentEditId = templateId;
        
        document.getElementById('edit-name').value = template.name || '';
        document.getElementById('edit-category').value = template.category || '';
        document.getElementById('edit-industry').value = template.industry || '';
        document.getElementById('edit-description').value = template.description || '';
        
        if (editModal) editModal.style.display = 'flex';
    }
    
    function closeModal() {
        if (editModal) editModal.style.display = 'none';
        currentEditId = null;
    }
    
    async function saveTemplateEdits(event) {
        event.preventDefault();
        if (!currentEditId) return;
        
        const updatedTemplate = {
            name: document.getElementById('edit-name')?.value || '',
            category: document.getElementById('edit-category')?.value || '',
            industry: document.getElementById('edit-industry')?.value || '',
            description: document.getElementById('edit-description')?.value || ''
        };
        
        try {
            const response = await fetch(`/api/discovery/templates/${currentEditId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTemplate)
            });
            
            if (response.ok) {
                showNotification('Template updated', 'success');
                fetchTemplates();
                closeModal();
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            showNotification('Failed to update template', 'error');
        }
    }
    
    async function selectTemplate(templateId) {
        const template = currentTemplates.find(t => t.id === templateId);
        if (!template) return;
        
        try {
            await fetch('/api/discovery/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, template })
            });
            
            if (typeof window.onTemplateSelected === 'function') {
                window.onTemplateSelected(template);
            }
            showNotification(`Template "${template.name}" selected`, 'success');
        } catch (error) {
            showNotification('Failed to select template', 'error');
        }
    }
    
    // Event listeners
    if (searchInput) searchInput.addEventListener('input', () => displayTemplates(currentTemplates));
    if (categoryFilter) categoryFilter.addEventListener('change', () => displayTemplates(currentTemplates));
    if (industryFilter) industryFilter.addEventListener('change', () => displayTemplates(currentTemplates));
    
    if (editForm) editForm.addEventListener('submit', saveTemplateEdits);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (editModal) {
        editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });
    }
    
    // Initial load
    fetchTemplates();
});