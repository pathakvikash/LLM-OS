/**
 * File UI Management
 * Handles file upload interface, file browser, and file viewer components
 */
class FileUI {
  constructor(config, logger, fileManager, uiManager) {
    this.config = config;
    this.logger = logger;
    this.fileManager = fileManager;
    this.uiManager = uiManager;
    
    this.currentView = 'browser'; // 'browser', 'viewer', 'upload'
    this.selectedFileId = null;
    this.fileSearchQuery = '';
    
    this.logger.info('FileUI initialized');
  }

  /**
   * Initialize file UI components
   */
  initialize() {
    this.createFileUploadArea();
    this.createFileBrowser();
    this.createFileViewer();
    this.createFileSearch();
    this.bindEvents();
    this.updateFileList();
  }

  /**
   * Create file upload area
   */
  createFileUploadArea() {
    const uploadArea = document.createElement('div');
    uploadArea.className = 'file-upload-area';
    uploadArea.innerHTML = `
      <div class="upload-zone" id="uploadZone">
        <div class="upload-icon">📁</div>
        <h3>Upload Files</h3>
        <p>Drag and drop files here or click to browse</p>
        <p class="upload-info">Supported: Text files, Images, Documents (max 10MB each)</p>
        <input type="file" id="fileInput" multiple accept=".txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.ts,.jsx,.tsx,.vue,.php,.java,.cpp,.c,.h,.rb,.go,.rs,.swift,.kt,.scala,.r,.sql,.sh,.bash,.yaml,.yml,.toml,.ini,.conf,.log,.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.pdf,.doc,.docx,.rtf" style="display: none;">
        <button class="upload-btn" onclick="document.getElementById('fileInput').click()">Choose Files</button>
      </div>
      <div class="upload-progress" id="uploadProgress" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="progress-text" id="progressText">Uploading...</div>
      </div>
    `;
    
    // Insert into file management container
    const fileManagementContainer = document.querySelector('.file-management-container');
    if (fileManagementContainer) {
      fileManagementContainer.appendChild(uploadArea);
    }
  }

  /**
   * Create file browser
   */
  createFileBrowser() {
    const fileBrowser = document.createElement('div');
    fileBrowser.className = 'file-browser';
    fileBrowser.innerHTML = `
      <div class="browser-header">
        <h3>📁 File Browser</h3>
        <div class="browser-controls">
          <button class="browser-btn" onclick="fileUI.refreshFiles()">🔄</button>
          <button class="browser-btn" onclick="fileUI.clearAllFiles()">🗑️</button>
        </div>
      </div>
      <div class="file-search-container">
        <input type="text" id="fileSearch" placeholder="Search files..." class="file-search">
        <select id="categoryFilter" class="category-filter">
          <option value="">All Categories</option>
          <option value="text">Text Files</option>
          <option value="image">Images</option>
          <option value="document">Documents</option>
        </select>
      </div>
      <div class="file-list" id="fileList">
        <div class="no-files">No files uploaded yet</div>
      </div>
    `;
    
    // Insert into file management container
    const fileManagementContainer = document.querySelector('.file-management-container');
    if (fileManagementContainer) {
      fileManagementContainer.appendChild(fileBrowser);
    }
  }

  /**
   * Create file viewer
   */
  createFileViewer() {
    const fileViewer = document.createElement('div');
    fileViewer.className = 'file-viewer';
    fileViewer.style.display = 'none';
    fileViewer.innerHTML = `
      <div class="viewer-header">
        <button class="back-btn" onclick="fileUI.showBrowser()">← Back</button>
        <h3 id="viewerTitle">File Viewer</h3>
        <div class="viewer-controls">
          <button class="viewer-btn" onclick="fileUI.performFileAction('edit')" title="Edit with AI">✏️</button>
          <button class="viewer-btn" onclick="fileUI.performFileAction('ask')" title="Ask about file">❓</button>
          <button class="viewer-btn" onclick="fileUI.performFileAction('agent')" title="Agent mode">🤖</button>
          <button class="viewer-btn" onclick="fileUI.downloadFile()" title="Download">⬇️</button>
          <button class="viewer-btn" onclick="fileUI.deleteFile()" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="viewer-content" id="viewerContent">
        <div class="file-info" id="fileInfo"></div>
        <div class="file-display" id="fileDisplay"></div>
      </div>
    `;
    
    // Insert into file management container
    const fileManagementContainer = document.querySelector('.file-management-container');
    if (fileManagementContainer) {
      fileManagementContainer.appendChild(fileViewer);
    }
  }

  /**
   * Create file search functionality
   */
  createFileSearch() {
    // Search functionality is already included in the browser
    const searchInput = document.getElementById('fileSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.fileSearchQuery = e.target.value;
        this.updateFileList();
      });
    }
    
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        this.updateFileList();
      });
    }
  }

  /**
   * Bind file upload events
   */
  bindEvents() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadZone) {
      // Drag and drop events
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
        const files = Array.from(e.dataTransfer.files);
        this.handleFileUpload(files);
      });
      
      // Click to upload
      uploadZone.addEventListener('click', () => {
        fileInput.click();
      });
    }
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        this.handleFileUpload(files);
      });
    }
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(files) {
    if (files.length === 0) return;
    
    const progressBar = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressBar.style.display = 'block';
    
    let uploadedCount = 0;
    const totalFiles = files.length;
    
    for (const file of files) {
      try {
        progressText.textContent = `Uploading ${file.name}...`;
        progressFill.style.width = `${(uploadedCount / totalFiles) * 100}%`;
        
        await this.fileManager.addFile(file);
        uploadedCount++;
        
        this.logger.info('File uploaded successfully', { name: file.name });
      } catch (error) {
        this.logger.error('Failed to upload file', { name: file.name, error: error.message });
        this.showError(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    
    progressFill.style.width = '100%';
    progressText.textContent = `Uploaded ${uploadedCount} of ${totalFiles} files`;
    
    setTimeout(() => {
      progressBar.style.display = 'none';
      progressFill.style.width = '0%';
    }, 2000);
    
    this.updateFileList();
  }

  /**
   * Update file list display
   */
  updateFileList() {
    const fileList = document.getElementById('fileList');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (!fileList) return;
    
    let files = this.fileManager.getAllFiles();
    
    // Apply category filter
    if (categoryFilter && categoryFilter.value) {
      files = files.filter(file => file.category === categoryFilter.value);
    }
    
    // Apply search filter
    if (this.fileSearchQuery) {
      files = this.fileManager.searchFiles(this.fileSearchQuery);
    }
    
    if (files.length === 0) {
      fileList.innerHTML = '<div class="no-files">No files found</div>';
      return;
    }
    
    // Sort files by upload date (newest first)
    files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    const fileItems = files.map(file => this.createFileItem(file)).join('');
    fileList.innerHTML = fileItems;
  }

  /**
   * Create file item element
   */
  createFileItem(file) {
    const icon = this.getFileIcon(file.category, file.extension);
    const size = this.fileManager.formatFileSize(file.size);
    const date = new Date(file.uploadDate).toLocaleDateString();
    
    return `
      <div class="file-item" data-file-id="${file.id}" onclick="fileUI.openFile('${file.id}')">
        <div class="file-icon">${icon}</div>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            <span class="file-size">${size}</span>
            <span class="file-date">${date}</span>
            <span class="file-category">${file.category}</span>
          </div>
          ${file.preview ? `<div class="file-preview">${file.preview}</div>` : ''}
        </div>
        <div class="file-actions">
          <button class="file-action-btn" onclick="event.stopPropagation(); performFileAction('edit', '${file.id}')" title="Edit with AI">✏️</button>
          <button class="file-action-btn" onclick="event.stopPropagation(); performFileAction('ask', '${file.id}')" title="Ask about file">❓</button>
          <button class="file-action-btn" onclick="event.stopPropagation(); performFileAction('agent', '${file.id}')" title="Agent mode">🤖</button>
          <button class="file-action-btn" onclick="event.stopPropagation(); fileUI.deleteFile('${file.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Get file icon based on category and extension
   */
  getFileIcon(category, extension) {
    const iconMap = {
      text: {
        '.py': '🐍', '.js': '📜', '.html': '🌐', '.css': '🎨', '.json': '📋',
        '.md': '📝', '.txt': '📄', '.ts': '📘', '.jsx': '⚛️', '.tsx': '⚛️',
        '.vue': '💚', '.php': '🐘', '.java': '☕', '.cpp': '⚙️', '.c': '⚙️',
        '.rb': '💎', '.go': '🐹', '.rs': '🦀', '.swift': '🍎', '.kt': '☕',
        '.sql': '🗄️', '.sh': '🐚', '.yaml': '📄', '.yml': '📄', '.xml': '📄'
      },
      image: {
        '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🎬', '.svg': '🎨'
      },
      document: {
        '.pdf': '📕', '.doc': '📘', '.docx': '📘', '.rtf': '📄'
      }
    };
    
    return iconMap[category]?.[extension] || '📄';
  }

  /**
   * Open file in viewer
   */
  openFile(fileId) {
    const file = this.fileManager.getFile(fileId);
    if (!file) return;
    
    this.selectedFileId = fileId;
    this.showViewer();
    this.displayFile(file);
  }

  /**
   * Display file content in viewer
   */
  displayFile(file) {
    const viewerTitle = document.getElementById('viewerTitle');
    const fileInfo = document.getElementById('fileInfo');
    const fileDisplay = document.getElementById('fileDisplay');
    
    viewerTitle.textContent = file.name;
    
    // File info
    fileInfo.innerHTML = `
      <div class="info-item">
        <strong>Size:</strong> ${this.fileManager.formatFileSize(file.size)}
      </div>
      <div class="info-item">
        <strong>Type:</strong> ${file.category} (${file.extension})
      </div>
      <div class="info-item">
        <strong>Uploaded:</strong> ${new Date(file.uploadDate).toLocaleString()}
      </div>
    `;
    
    // File content
    if (file.category === 'text') {
      fileDisplay.innerHTML = `
        <div class="text-content">
          <pre><code>${this.escapeHtml(file.content || 'No content available')}</code></pre>
        </div>
      `;
    } else if (file.category === 'image') {
      fileDisplay.innerHTML = `
        <div class="image-content">
          <img src="${file.preview}" alt="${file.name}" style="max-width: 100%; height: auto;">
        </div>
      `;
    } else if (file.category === 'document') {
      if (file.extension === '.pdf' && file.content) {
        // Show extracted PDF text content
        fileDisplay.innerHTML = `
          <div class="text-content">
            <h4>Extracted PDF Content:</h4>
            <pre><code>${this.escapeHtml(file.content)}</code></pre>
          </div>
        `;
      } else {
        fileDisplay.innerHTML = `
          <div class="document-content">
            <p>Document preview not available for ${file.extension} files.</p>
            <p>File: ${file.name} (${this.fileManager.formatFileSize(file.size)})</p>
            ${file.content ? `<p><strong>Content:</strong> ${this.escapeHtml(file.content.substring(0, 500))}...</p>` : ''}
          </div>
        `;
      }
    } else {
      fileDisplay.innerHTML = `
        <div class="document-content">
          <p>File: ${file.name} (${this.fileManager.formatFileSize(file.size)})</p>
          ${file.content ? `<p><strong>Content:</strong> ${this.escapeHtml(file.content)}</p>` : ''}
        </div>
      `;
    }
  }

  /**
   * Show file viewer
   */
  showViewer() {
    document.querySelector('.file-browser').style.display = 'none';
    document.querySelector('.file-viewer').style.display = 'block';
    this.currentView = 'viewer';
  }

  /**
   * Show file browser
   */
  showBrowser() {
    document.querySelector('.file-browser').style.display = 'block';
    document.querySelector('.file-viewer').style.display = 'none';
    this.currentView = 'browser';
    this.selectedFileId = null;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId = null) {
    const targetFileId = fileId || this.selectedFileId;
    if (!targetFileId) return;
    
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await this.fileManager.removeFile(targetFileId);
        this.updateFileList();
        
        if (this.currentView === 'viewer' && targetFileId === this.selectedFileId) {
          this.showBrowser();
        }
        
        this.logger.info('File deleted', { fileId: targetFileId });
      } catch (error) {
        this.logger.error('Failed to delete file', { fileId: targetFileId, error: error.message });
        this.showError(`Failed to delete file: ${error.message}`);
      }
    }
  }

  /**
   * Download file
   */
  downloadFile() {
    if (!this.selectedFileId) return;
    
    const file = this.fileManager.getFile(this.selectedFileId);
    const blob = this.fileManager.getFileBlob(this.selectedFileId);
    
    if (!file || !blob) {
      this.showError('File not found');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Refresh file list
   */
  refreshFiles() {
    this.updateFileList();
  }

  /**
   * Clear all files
   */
  async clearAllFiles() {
    if (confirm('Are you sure you want to delete all files? This action cannot be undone.')) {
      try {
        await this.fileManager.clearAllFiles();
        this.updateFileList();
        if (this.currentView === 'viewer') {
          this.showBrowser();
        }
        this.logger.info('All files cleared');
      } catch (error) {
        this.logger.error('Failed to clear files', error);
        this.showError(`Failed to clear files: ${error.message}`);
      }
    }
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show error message
   */
  showError(message) {
    // You can implement a toast notification system here
    console.error(message);
    alert(message);
  }

  /**
   * Perform AI action on the currently selected file
   */
  performFileAction(actionType) {
    if (!this.selectedFileId) {
      this.showError('No file selected');
      return;
    }
    
    if (window.performFileAction) {
      window.performFileAction(actionType, this.selectedFileId);
    } else {
      this.showError('AI actions not available');
    }
  }

  /**
   * Get selected file content for AI processing
   */
  getSelectedFileContent() {
    if (!this.selectedFileId) return null;
    return this.fileManager.getFileContent(this.selectedFileId);
  }

  /**
   * Get selected file info
   */
  getSelectedFileInfo() {
    if (!this.selectedFileId) return null;
    return this.fileManager.getFile(this.selectedFileId);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileUI;
} else {
  window.FileUI = FileUI;
} 