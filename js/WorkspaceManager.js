/**
 * Workspace Manager
 * Handles drag and drop functionality for the workspace area
 * Allows users to drag files into workspace and chat with their content
 */
class WorkspaceManager {
  constructor(config, logger, fileManager, appController) {
    this.config = config;
    this.logger = logger;
    this.fileManager = fileManager;
    this.appController = appController;
    
    this.workspaceFiles = new Map(); // Store files dropped in workspace
    this.dropZone = null;
    this.dropZoneOverlay = null;
    this.workspaceFilesContainer = null;
    
    this.logger.info('WorkspaceManager initialized');
  }

  /**
   * Initialize workspace drag and drop functionality
   */
  initialize() {
    this.dropZone = document.getElementById('workspaceDropZone');
    this.dropZoneOverlay = document.getElementById('dropZoneOverlay');
    this.workspaceFilesContainer = document.getElementById('workspaceFiles');
    
    this.logger.debug('WorkspaceManager initialization', {
      dropZoneFound: !!this.dropZone,
      dropZoneOverlayFound: !!this.dropZoneOverlay,
      workspaceFilesContainerFound: !!this.workspaceFilesContainer
    });
    
    if (!this.dropZone) {
      this.logger.error('Workspace drop zone not found');
      return;
    }
    
    if (!this.dropZoneOverlay) {
      this.logger.error('Workspace drop zone overlay not found');
      return;
    }
    
    this.bindDragAndDropEvents();
    this.updateWorkspaceFilesDisplay();
    
    // Add debugging commands to global scope
    window.testWorkspaceDrop = () => this.testDragAndDropChain();
    window.debugWorkspaceDrop = () => this.debugWorkspaceState();
    window.checkWorkspaceFiles = () => {
      console.log('Workspace Files:', Array.from(this.workspaceFiles.entries()));
      console.log('Total workspace files:', this.workspaceFiles.size);
    };
    window.testBrowserDrop = (fileId) => {
      console.log('Testing browser drop with file ID:', fileId);
      this.handleFileBrowserDrop(fileId);
    };
    window.forceWorkspaceRefresh = () => {
      console.log('Forcing workspace refresh');
      this.refreshWorkspaceUI();
    };
    window.checkAppController = () => {
      console.log('AppController status:', this.isAppControllerAvailable());
      console.log('AppController object:', this.appController);
      if (this.appController) {
        console.log('AppController.ui:', this.appController.ui);
        console.log('AppController.state:', this.appController.state);
      }
    };
    
    this.logger.info('Workspace drag and drop functionality initialized successfully');
  }

  /**
   * Bind drag and drop events to workspace area
   */
  bindDragAndDropEvents() {
    // Prevent default drag behaviors on the entire document
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
    });

    // Add global drop detection for files from browser
    document.addEventListener('dragover', (e) => {
      // Check if we're dragging a file from browser
      if (e.dataTransfer.types.includes('application/json')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Show drop zone overlay if we're over the workspace area
        const workspaceArea = document.getElementById('workspaceTab');
        if (workspaceArea && workspaceArea.contains(e.target)) {
          this.showDropZoneOverlay();
        }
      }
    });

    // Add global drop handler for workspace tab
    document.addEventListener('drop', (e) => {
      // Check if we're dropping a file from browser onto the workspace tab
      if (e.dataTransfer.types.includes('application/json')) {
        const workspaceArea = document.getElementById('workspaceTab');
        if (workspaceArea && workspaceArea.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          
          this.logger.debug('Global drop detected on workspace tab', {
            dataTransferTypes: Array.from(e.dataTransfer.types),
            target: e.target.tagName,
            targetId: e.target.id
          });
          
          // Ensure workspace tab is active
          if (!this.isWorkspaceTabActive()) {
            this.logger.debug('Switching to workspace tab for file drop');
            if (window.switchTab) {
              window.switchTab('workspace');
            }
          }
          
          // Process the drop
          try {
            const browserData = e.dataTransfer.getData('application/json');
            this.logger.debug('Browser data retrieved from global drop', { browserData });
            if (browserData) {
              const data = JSON.parse(browserData);
              this.logger.debug('Parsed browser data from global drop', data);
              if (data.type === 'file-from-browser') {
                this.logger.info('Processing browser file drop (global)', { fileId: data.fileId });
                this.handleFileBrowserDrop(data.fileId);
                return;
              }
            }
          } catch (error) {
            this.logger.debug('Global drop processing failed', { error: error.message });
          }
        }
      }
    });

    // Workspace drop zone events
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showDropZoneOverlay();
      this.logger.debug('Drag over workspace drop zone');
    });

    this.dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showDropZoneOverlay();
      this.logger.debug('Drag enter workspace drop zone');
    });

    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only hide if we're leaving the drop zone entirely
      if (!this.dropZone.contains(e.relatedTarget)) {
        this.hideDropZoneOverlay();
        this.logger.debug('Drag leave workspace drop zone');
      }
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideDropZoneOverlay();
      
      this.logger.debug('Drop event triggered in workspace', {
        dataTransferTypes: Array.from(e.dataTransfer.types),
        filesCount: e.dataTransfer.files.length,
        dataTransferItems: e.dataTransfer.items ? Array.from(e.dataTransfer.items).map(item => ({
          kind: item.kind,
          type: item.type
        })) : []
      });
      
      // Ensure workspace tab is active when dropping
      if (!this.isWorkspaceTabActive()) {
        this.logger.debug('Switching to workspace tab for file drop');
        if (window.switchTab) {
          window.switchTab('workspace');
        }
      }
      
      // Check if this is a file from the browser
      let browserFileId = null;
      try {
        const browserData = e.dataTransfer.getData('application/json');
        this.logger.debug('Browser data found in drop zone', { browserData });
        if (browserData) {
          const data = JSON.parse(browserData);
          this.logger.debug('Parsed browser data in drop zone', data);
          if (data.type === 'file-from-browser') {
            browserFileId = data.fileId;
            this.logger.info('Processing browser file drop in drop zone', { fileId: browserFileId });
          }
        }
      } catch (error) {
        this.logger.debug('Not a browser file drop, processing as external file', { error: error.message });
      }
      
      // If we have a browser file ID, process it
      if (browserFileId) {
        this.handleFileBrowserDrop(browserFileId);
        return;
      }
      
      // Handle external files
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.logger.info('Processing external file drop', { filesCount: files.length });
        this.handleWorkspaceFileDrop(files);
      } else {
        this.logger.warn('Drop event with no files detected');
        // Try to get data from text/plain format as fallback
        try {
          const plainData = e.dataTransfer.getData('text/plain');
          this.logger.debug('Plain text data found as fallback', { plainData });
          if (plainData && plainData.startsWith('file_')) {
            this.logger.info('Processing file ID from plain text fallback', { fileId: plainData });
            this.handleFileBrowserDrop(plainData);
            return;
          }
        } catch (error) {
          this.logger.debug('No plain text data found', { error: error.message });
        }
        
        this.showError('No valid files detected in drop');
      }
    });

    // Hide overlay when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.dropZone.contains(e.target)) {
        this.hideDropZoneOverlay();
      }
    });

    this.logger.info('Workspace drag and drop events bound successfully');
  }

  /**
   * Show drop zone overlay
   */
  showDropZoneOverlay() {
    if (this.dropZoneOverlay) {
      this.dropZoneOverlay.style.display = 'flex';
      this.dropZone.classList.add('drag-over');
      
      // Update overlay content based on what's being dragged
      const overlay = this.dropZoneOverlay;
      overlay.innerHTML = `
        <div class="drop-zone-content">
          <div class="drop-icon">📁</div>
          <h3>Drop files here to chat with them</h3>
          <p>Supported: Text files, Images, Documents</p>
          <p class="drop-hint">Release to add to workspace</p>
        </div>
      `;
    }
    
    // Also highlight the workspace tab content
    const workspaceTab = document.getElementById('workspaceTab');
    if (workspaceTab) {
      workspaceTab.classList.add('drag-target-active');
    }
  }

  /**
   * Hide drop zone overlay
   */
  hideDropZoneOverlay() {
    if (this.dropZoneOverlay) {
      this.dropZoneOverlay.style.display = 'none';
      this.dropZone.classList.remove('drag-over');
    }
    
    // Remove highlight from workspace tab content
    const workspaceTab = document.getElementById('workspaceTab');
    if (workspaceTab) {
      workspaceTab.classList.remove('drag-target-active');
    }
  }

  /**
   * Handle files dropped in workspace
   */
  async handleWorkspaceFileDrop(files) {
    this.logger.info('Files dropped in workspace', { count: files.length });
    
    // Show loading state
    this.showLoadingState(true);
    
    const validFiles = [];
    const invalidFiles = [];
    
    files.forEach(file => {
      if (!this.fileManager.isSupportedFileType(file.name)) {
        invalidFiles.push({ file, reason: 'Unsupported file type' });
        this.logger.warn('Unsupported file type dropped', { 
          fileName: file.name, 
          fileType: file.type 
        });
      } else if (file.size > this.fileManager.maxFileSize) {
        invalidFiles.push({ file, reason: 'File too large' });
        this.logger.warn('File too large', { 
          fileName: file.name, 
          fileSize: file.size 
        });
      } else {
        validFiles.push(file);
      }
    });

    // Show error messages for invalid files
    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.map(({ file, reason }) => 
        `${file.name}: ${reason}`
      ).join(', ');
      this.showError(`Some files could not be processed: ${errorMessage}`);
    }

    if (validFiles.length === 0) {
      this.showError('No valid files to process. Please check file type and size.');
      this.showLoadingState(false);
      return;
    }

    // Process each valid file
    let processedCount = 0;
    for (const file of validFiles) {
      try {
        await this.addFileToWorkspace(file);
        processedCount++;
      } catch (error) {
        this.logger.error('Error adding file to workspace', { 
          fileName: file.name, 
          error: error.message 
        });
        this.showError(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    // Show success summary
    if (processedCount > 0) {
      this.showSuccess(`Successfully added ${processedCount} file(s) to workspace`);
    }

    this.showLoadingState(false);
  }

  /**
   * Handle dropping a file from the file browser
   */
  handleFileBrowserDrop(fileId) {
    this.logger.info('Handling file browser drop', { fileId });
    
    try {
      // Get file from file manager
      const fileObj = this.fileManager.getFile(fileId);
      if (!fileObj) {
        this.logger.error('File not found in file manager', { fileId });
        this.showError(`File not found: ${fileId}`);
        return;
      }
      
      this.logger.debug('File object retrieved', { 
        fileId, 
        fileName: fileObj.name,
        fileSize: fileObj.size,
        fileExtension: fileObj.extension
      });
      
      // Get file content
      const fileContent = this.fileManager.getFileContent(fileId);
      if (!fileContent) {
        this.logger.error('File content not available', { fileId });
        this.showError(`File content not available: ${fileObj.name}`);
        return;
      }
      
      this.logger.debug('File content retrieved', { 
        fileId, 
        contentLength: fileContent.length,
        contentPreview: fileContent.substring(0, 100) + '...'
      });
      
      // Create a blob from the content
      const blob = new Blob([fileContent], { 
        type: this.getMimeType(fileObj.extension) || 'text/plain' 
      });
      
      this.logger.debug('Blob created from content', { 
        fileId, 
        blobSize: blob.size,
        blobType: blob.type
      });
      
      // Create a File object
      const file = new File([blob], fileObj.name, { 
        type: blob.type,
        lastModified: fileObj.lastModified || Date.now()
      });
      
      this.logger.debug('File object created', { 
        fileId, 
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      // Add to workspace
      this.addFileToWorkspaceFromBrowser(file, fileId).then(() => {
        this.logger.info('File successfully added to workspace from browser', { fileId, fileName: fileObj.name });
        this.showSuccess(`Added to workspace: ${fileObj.name}`);
        
        // Force UI refresh
        setTimeout(() => {
          this.refreshWorkspaceUI();
        }, 100);
      }).catch((error) => {
        this.logger.error('Failed to add file to workspace from browser', { 
          fileId, 
          fileName: fileObj.name,
          error: error.message 
        });
        this.showError(`Failed to add file: ${error.message}`);
      });
      
    } catch (error) {
      this.logger.error('Error in handleFileBrowserDrop', { 
        fileId, 
        error: error.message,
        stack: error.stack 
      });
      this.showError(`Error processing file: ${error.message}`);
    }
  }

  /**
   * Show loading state for workspace operations
   */
  showLoadingState(loading) {
    const dropZone = this.dropZone;
    if (!dropZone) return;

    if (loading) {
      dropZone.classList.add('processing');
      const overlay = this.dropZoneOverlay;
      if (overlay) {
        overlay.innerHTML = `
          <div class="drop-zone-content">
            <div class="drop-icon">⏳</div>
            <h3>Processing files...</h3>
            <p>Please wait while files are being added to workspace</p>
          </div>
        `;
        overlay.style.display = 'flex';
      }
    } else {
      dropZone.classList.remove('processing');
      this.hideDropZoneOverlay();
    }
  }

  /**
   * Add file to workspace
   */
  async addFileToWorkspace(file) {
    this.logger.info('Adding file to workspace', { 
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type 
    });
    
    // First add to file manager
    const fileId = await this.fileManager.addFile(file);
    const fileObj = this.fileManager.getFile(fileId);
    
    if (!fileObj) {
      this.logger.error('Failed to add file to file manager', { fileName: file.name });
      throw new Error('Failed to add file to file manager');
    }

    this.logger.debug('File added to file manager', { 
      fileId, 
      fileName: fileObj.name,
      fileSize: fileObj.size 
    });

    // Check if file is already in workspace (by name and size)
    const existingFile = this.findExistingFile(fileObj.name, fileObj.size);
    if (existingFile) {
      this.logger.info('File already exists in workspace', { 
        fileName: fileObj.name,
        existingFileId: existingFile.id 
      });
      this.showSuccess(`${fileObj.name} is already in workspace`);
      return existingFile.id;
    }

    // Add to workspace files
    this.workspaceFiles.set(fileId, {
      ...fileObj,
      addedToWorkspace: new Date(),
      workspaceId: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    this.logger.info('File added to workspace', { 
      fileId, 
      fileName: fileObj.name,
      workspaceId: this.workspaceFiles.get(fileId).workspaceId
    });

    // Update display
    this.updateWorkspaceFilesDisplay();
    
    // Show success message
    this.showSuccess(`Added ${fileObj.name} to workspace`);
    
    return fileId;
  }

  /**
   * Find existing file in workspace by name and size
   */
  findExistingFile(fileName, fileSize) {
    for (const [fileId, file] of this.workspaceFiles) {
      if (file.name === fileName && file.size === fileSize) {
        return file;
      }
    }
    return null;
  }

  /**
   * Remove file from workspace
   */
  removeFileFromWorkspace(fileId) {
    if (this.workspaceFiles.has(fileId)) {
      const fileObj = this.workspaceFiles.get(fileId);
      this.workspaceFiles.delete(fileId);
      
      this.logger.info('File removed from workspace', { 
        fileId, 
        fileName: fileObj.name 
      });
      
      this.updateWorkspaceFilesDisplay();
      this.showSuccess(`Removed ${fileObj.name} from workspace`);
    }
  }

  /**
   * Get workspace file content for chat
   */
  getWorkspaceFileContent(fileId) {
    if (!this.workspaceFiles.has(fileId)) {
      return null;
    }
    
    return this.fileManager.getFileContent(fileId);
  }

  /**
   * Get all workspace files info
   */
  getWorkspaceFiles() {
    return Array.from(this.workspaceFiles.values());
  }

  /**
   * Get workspace file by ID
   */
  getWorkspaceFile(fileId) {
    return this.workspaceFiles.get(fileId);
  }

  /**
   * Update workspace files display
   */
  updateWorkspaceFilesDisplay() {
    if (!this.workspaceFilesContainer) {
      this.logger.warn('Workspace files container not found');
      return;
    }

    const files = this.getWorkspaceFiles();
    this.logger.debug('Updating workspace files display', { filesCount: files.length });
    
    if (files.length === 0) {
      this.workspaceFilesContainer.innerHTML = `
        <div class="workspace-no-files">
          No files in workspace. Drag and drop files here to get started!
        </div>
      `;
    } else {
      const filesHTML = files.map(file => this.createWorkspaceFileItem(file)).join('');
      this.workspaceFilesContainer.innerHTML = filesHTML;
    }

    // Update workspace header with file count and size
    this.updateWorkspaceHeader();
    
    this.logger.debug('Workspace files display updated', { filesCount: files.length });
  }

  /**
   * Update workspace header with file statistics
   */
  updateWorkspaceHeader() {
    const files = this.getWorkspaceFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    const headerTitle = document.querySelector('.workspace-header h3');
    if (headerTitle) {
      if (files.length === 0) {
        headerTitle.textContent = '💼 Workspace';
      } else {
        headerTitle.textContent = `💼 Workspace (${files.length} file${files.length !== 1 ? 's' : ''}, ${this.fileManager.formatFileSize(totalSize)})`;
      }
    }
  }

  /**
   * Create workspace file item HTML
   */
  createWorkspaceFileItem(file) {
    const icon = this.getFileIcon(file.category, file.extension);
    const size = this.fileManager.formatFileSize(file.size);
    const date = new Date(file.addedToWorkspace).toLocaleString();
    
    return `
      <div class="workspace-file-item" data-file-id="${file.id}">
        <div class="workspace-file-info">
          <div class="workspace-file-icon">${icon}</div>
          <div class="workspace-file-details">
            <div class="workspace-file-name">${this.escapeHtml(file.name)}</div>
            <div class="workspace-file-meta">${size} • ${file.category} • Added ${date}</div>
          </div>
        </div>
        <div class="workspace-file-actions">
          <button class="workspace-file-btn primary" onclick="workspaceManager.chatWithFile('${file.id}')" title="Chat with this file">
            💬 Chat
          </button>
          <button class="workspace-file-btn" onclick="workspaceManager.viewFile('${file.id}')" title="View file">
            👁️ View
          </button>
          <button class="workspace-file-btn danger" onclick="workspaceManager.removeFileFromWorkspace('${file.id}')" title="Remove from workspace">
            🗑️ Remove
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get file icon based on category and extension
   */
  getFileIcon(category, extension) {
    const icons = {
      text: {
        '.txt': '📄', '.md': '📝', '.py': '🐍', '.js': '📜', '.html': '🌐', '.css': '🎨',
        '.json': '📋', '.xml': '📄', '.csv': '📊', '.ts': '📜', '.jsx': '⚛️', '.tsx': '⚛️',
        '.vue': '💚', '.php': '🐘', '.java': '☕', '.cpp': '⚙️', '.c': '⚙️', '.h': '⚙️',
        '.rb': '💎', '.go': '🐹', '.rs': '🦀', '.swift': '🍎', '.kt': '☕', '.scala': '⚡',
        '.r': '📊', '.sql': '🗄️', '.sh': '🐚', '.bash': '🐚', '.yaml': '📄', '.yml': '📄',
        '.toml': '📄', '.ini': '⚙️', '.conf': '⚙️', '.log': '📋'
      },
      image: {
        '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.bmp': '🖼️', '.svg': '🖼️', '.webp': '🖼️'
      },
      document: {
        '.pdf': '📕', '.doc': '📘', '.docx': '📘', '.rtf': '📄'
      }
    };

    return icons[category]?.[extension] || '📄';
  }

  /**
   * Check if appController is properly initialized
   */
  isAppControllerAvailable() {
    const available = !!(this.appController && 
                        this.appController.ui && 
                        this.appController.state);
    
    this.logger.debug('AppController availability check', {
      appControllerExists: !!this.appController,
      uiExists: !!(this.appController && this.appController.ui),
      stateExists: !!(this.appController && this.appController.state),
      overallAvailable: available
    });
    
    return available;
  }

  /**
   * Start a chat session with a specific file
   */
  chatWithFile(fileId) {
    const file = this.getWorkspaceFile(fileId);
    if (!file) {
      this.showError('File not found in workspace');
      return;
    }

    const fileContent = this.getWorkspaceFileContent(fileId);
    if (!fileContent) {
      this.showError('Could not retrieve file content');
      return;
    }

    // Check if appController is available
    if (!this.isAppControllerAvailable()) {
      this.logger.error('AppController not available for chat with file');
      this.showError('Chat functionality not available');
      return;
    }

    // Switch to chat section
    if (this.appController.ui && typeof this.appController.ui.toggleSection === 'function') {
      this.appController.ui.toggleSection('chatSection', true);
    } else {
      this.logger.warn('UI toggle not available, manually switching to chat');
      // Fallback: manually switch to chat tab
      const chatTab = document.querySelector('.tab-btn[data-tab="chat"]');
      if (chatTab) {
        chatTab.click();
      }
    }
    
    // Set the file as selected in the app state
    if (this.appController.state && typeof this.appController.state.updateContext === 'function') {
      this.appController.state.updateContext('selectedFile', {
        id: fileId,
        name: file.name,
        type: file.category,
        extension: file.extension,
        size: file.size
      });
      
      this.appController.state.updateContext('fileContent', fileContent);
    } else {
      this.logger.warn('App state not available for context update');
    }
    
    // Focus on chat input
    const chatInput = document.getElementById('userInput');
    if (chatInput) {
      chatInput.focus();
      chatInput.placeholder = `Ask about ${file.name}...`;
    }

    this.logger.info('Started chat with file', { 
      fileId, 
      fileName: file.name,
      contentLength: fileContent.length 
    });

    // Add a system message to indicate the file is loaded
    if (this.appController.ui && typeof this.appController.ui.addMessage === 'function') {
      this.appController.ui.addMessage(`📁 Loaded file: ${file.name} (${file.category}, ${this.fileManager.formatFileSize(file.size)})`, 'system');
    } else {
      // Fallback: show success message
      this.showSuccess(`📁 Loaded file: ${file.name} for chat`);
    }
  }

  /**
   * View a file in the file viewer
   */
  viewFile(fileId) {
    if (window.fileUI) {
      window.fileUI.openFile(fileId);
      // Switch to files tab to show the viewer
      this.switchToFilesTab();
    }
  }

  /**
   * Switch to files tab
   */
  switchToFilesTab() {
    const filesTab = document.querySelector('.tab-btn[data-tab="files"]');
    if (filesTab) {
      filesTab.click();
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (this.appController && this.appController.ui && typeof this.appController.ui.addMessage === 'function') {
      this.appController.ui.addMessage(message, 'success');
    } else {
      // Fallback: use console and alert
      this.logger.info('Success:', message);
      console.log('✅ Success:', message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.appController && this.appController.ui && typeof this.appController.ui.addMessage === 'function') {
      this.appController.ui.addMessage(message, 'error');
    } else {
      // Fallback: use console and alert
      this.logger.error('Error:', message);
      console.error('❌ Error:', message);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clear all workspace files
   */
  clearWorkspace() {
    this.workspaceFiles.clear();
    this.updateWorkspaceFilesDisplay();
    this.logger.info('Workspace cleared');
    this.showSuccess('Workspace cleared');
  }

  /**
   * Get workspace context for AI
   */
  getWorkspaceContext() {
    const files = this.getWorkspaceFiles();
    if (files.length === 0) return null;

    return {
      workspaceFiles: files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.category,
        extension: file.extension,
        size: file.size,
        addedToWorkspace: file.addedToWorkspace
      })),
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0)
    };
  }

  /**
   * Check if workspace tab is currently active
   */
  isWorkspaceTabActive() {
    const workspaceTab = document.querySelector('.tab-btn[data-tab="workspace"]');
    const workspaceContent = document.getElementById('workspaceTab');
    return workspaceTab && workspaceTab.classList.contains('active') && 
           workspaceContent && workspaceContent.classList.contains('active');
  }

  /**
   * Debug method to check workspace state
   */
  debugWorkspaceState() {
    const state = {
      dropZoneFound: !!this.dropZone,
      dropZoneOverlayFound: !!this.dropZoneOverlay,
      workspaceFilesContainerFound: !!this.workspaceFilesContainer,
      isWorkspaceTabActive: this.isWorkspaceTabActive(),
      workspaceFilesCount: this.workspaceFiles.size,
      fileManagerAvailable: !!this.fileManager,
      fileUIAvailable: !!window.fileUI
    };
    
    this.logger.info('Workspace debug state', state);
    return state;
  }

  /**
   * Test drop zone functionality
   */
  testDropZone() {
    this.logger.info('Testing drop zone functionality');
    
    // Test if drop zone is properly initialized
    if (!this.dropZone) {
      this.logger.error('Drop zone not found');
      return false;
    }
    
    // Test if overlay can be shown/hidden
    this.showDropZoneOverlay();
    setTimeout(() => {
      this.hideDropZoneOverlay();
      this.logger.info('Drop zone overlay test completed');
    }, 1000);
    
    return true;
  }

  /**
   * Simulate a file drop for testing
   */
  async simulateFileDrop(fileId) {
    this.logger.info('Simulating file drop', { fileId });
    
    try {
      await this.handleFileBrowserDrop(fileId);
      this.logger.info('Simulated file drop completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Simulated file drop failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get debug information for troubleshooting
   */
  getDebugInfo() {
    const files = this.fileManager.getAllFiles();
    const workspaceFiles = this.getWorkspaceFiles();
    
    return {
      totalFiles: files.length,
      workspaceFiles: workspaceFiles.length,
      dropZoneActive: !!this.dropZone,
      workspaceTabActive: this.isWorkspaceTabActive(),
      fileManagerAvailable: !!this.fileManager,
      fileUIAvailable: !!window.fileUI,
      availableFiles: files.map(f => ({ id: f.id, name: f.name, category: f.category }))
    };
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.py': 'text/x-python',
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.ts': 'application/typescript',
      '.jsx': 'text/jsx',
      '.tsx': 'text/tsx',
      '.vue': 'text/vue',
      '.php': 'application/x-httpd-php',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin',
      '.scala': 'text/x-scala',
      '.r': 'text/x-r',
      '.sql': 'text/x-sql',
      '.sh': 'text/x-sh',
      '.bash': 'text/x-sh',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.toml': 'text/x-toml',
      '.ini': 'text/plain',
      '.conf': 'text/plain',
      '.log': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.rtf': 'application/rtf'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Comprehensive test of drag and drop functionality
   */
  async testDragAndDropChain() {
    this.logger.info('Starting comprehensive drag and drop test');
    
    const debugInfo = this.getDebugInfo();
    this.logger.info('Current state', debugInfo);
    
    if (debugInfo.totalFiles === 0) {
      this.logger.warn('No files available for testing. Please upload a file first.');
      this.showError('No files available for testing. Please upload a file first.');
      return false;
    }
    
    // Get the first available file
    const testFile = debugInfo.availableFiles[0];
    this.logger.info('Testing with file', testFile);
    
    // Test 1: Check if file exists in file manager
    const fileObj = this.fileManager.getFile(testFile.id);
    if (!fileObj) {
      this.logger.error('Test file not found in file manager');
      this.showError('Test file not found in file manager');
      return false;
    }
    
    // Test 2: Check if file blob is available
    const fileBlob = this.fileManager.getFileBlob(testFile.id);
    if (!fileBlob) {
      this.logger.warn('Test file blob not available, trying alternative method');
      
      // Try to get file content directly
      const fileContent = this.fileManager.getFileContent(testFile.id);
      if (!fileContent) {
        this.logger.error('Neither file blob nor content available');
        this.showError('File content not available for testing');
        return false;
      }
      
      // Create a blob from content
      const newBlob = new Blob([fileContent], { type: 'text/plain' });
      this.logger.info('Created blob from file content', { 
        blobSize: newBlob.size,
        contentLength: fileContent.length 
      });
      
      // Test 3: Simulate the drop using the created blob
      try {
        const newFile = new File([newBlob], fileObj.name, {
          type: this.getMimeType(fileObj.extension)
        });
        
        await this.addFileToWorkspace(newFile);
        this.logger.info('Drag and drop test completed successfully with content-based blob');
        this.showSuccess(`Test completed: ${testFile.name} added to workspace`);
        return true;
      } catch (error) {
        this.logger.error('Test failed with content-based blob', { error: error.message });
        this.showError(`Test failed: ${error.message}`);
        return false;
      }
    }
    
    // Test 3: Simulate the drop with original blob
    const success = await this.simulateFileDrop(testFile.id);
    
    if (success) {
      this.logger.info('Drag and drop test completed successfully');
      this.showSuccess(`Test completed: ${testFile.name} added to workspace`);
    } else {
      this.logger.error('Drag and drop test failed');
      this.showError('Test failed: Could not add file to workspace');
    }
    
    return success;
  }

  /**
   * Force refresh workspace display
   */
  forceRefreshWorkspace() {
    this.logger.info('Forcing workspace refresh');
    this.updateWorkspaceFilesDisplay();
    
    // Also ensure the workspace tab is visible
    if (!this.isWorkspaceTabActive()) {
      this.logger.debug('Switching to workspace tab for refresh');
      if (window.switchTab) {
        window.switchTab('workspace');
      }
    }
  }

  /**
   * Check current workspace state
   */
  checkWorkspaceState() {
    const files = this.getWorkspaceFiles();
    const fileManagerFiles = this.fileManager.getAllFiles();
    
    const state = {
      workspaceFilesCount: files.length,
      fileManagerFilesCount: fileManagerFiles.length,
      workspaceFiles: files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        category: f.category,
        addedToWorkspace: f.addedToWorkspace
      })),
      fileManagerFiles: fileManagerFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        category: f.category
      }))
    };
    
    this.logger.info('Workspace state check', state);
    return state;
  }

  /**
   * Read file content as text
   */
  async readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file content'));
      reader.readAsText(file);
    });
  }

  /**
   * Add a file to workspace from browser
   */
  async addFileToWorkspaceFromBrowser(file, originalFileId) {
    this.logger.info('Adding file to workspace from browser', { 
      fileName: file.name,
      fileSize: file.size,
      originalFileId 
    });
    
    try {
      // Add to workspace files
      const workspaceFile = {
        id: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        content: await this.readFileContent(file),
        originalFileId: originalFileId, // Keep reference to original file
        addedAt: new Date().toISOString()
      };
      
      this.workspaceFiles.set(workspaceFile.id, workspaceFile);
      this.logger.debug('File added to workspace files Map', { 
        workspaceFileId: workspaceFile.id,
        totalWorkspaceFiles: this.workspaceFiles.size 
      });
      
      // Update UI
      this.updateWorkspaceUI();
      
      // Update chat context
      this.updateChatContext();
      
      this.logger.info('File successfully added to workspace from browser', { 
        workspaceFileId: workspaceFile.id,
        fileName: file.name 
      });
      
      return workspaceFile;
      
    } catch (error) {
      this.logger.error('Error adding file to workspace from browser', { 
        fileName: file.name,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Refresh the workspace UI
   */
  refreshWorkspaceUI() {
    this.logger.debug('Refreshing workspace UI');
    
    // Force update the workspace display
    this.updateWorkspaceUI();
    
    // Update chat context
    this.updateChatContext();
    
    // Trigger any global UI refresh if available
    if (window.fileUI && typeof window.fileUI.refreshUI === 'function') {
      window.fileUI.refreshUI();
    }
    
    this.logger.debug('Workspace UI refresh completed');
  }
} 