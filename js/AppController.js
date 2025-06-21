/**
 * Main Application Controller
 * Orchestrates all application functionality and coordinates between modules
 */
class AppController {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    this.state = new AppState(this.config, this.logger);
    this.ui = new UIManager(this.config, this.logger);
    this.ollama = new OllamaAPI(this.config, this.logger);
    
    this.initializeEventListeners();
    this.initializeModel();
    this.loadConversationHistory();
    this.updateUI();
    this.applySavedUIState();
    this.initializeConnectionStatus();
    
    this.logger.info('AppController initialized successfully');
  }

  initializeEventListeners() {
    // Text selection handling for workspace tab
    document.getElementById('userSection').addEventListener('mouseup', () => {
      const selection = window.getSelection().toString().trim();
      if (selection) {
        this.state.updateContext('selectedText', selection);
        this.ui.showActionButtons(true);
        this.logger.logUserAction('text_selected', { selectionLength: selection.length });
      } else {
        this.ui.showActionButtons(false);
      }
    });

    // Text selection handling for file viewer
    document.addEventListener('mouseup', (event) => {
      const selection = window.getSelection().toString().trim();
      const isInFileViewer = event.target.closest('.file-viewer');
      const isInWorkspace = event.target.closest('#workspaceTab');
      
      if (selection && (isInFileViewer || isInWorkspace)) {
        this.state.updateContext('selectedText', selection);
        this.ui.showActionButtons(true);
        this.logger.logUserAction('text_selected', { 
          selectionLength: selection.length,
          location: isInFileViewer ? 'file_viewer' : 'workspace'
        });
      } else if (!selection) {
        this.ui.showActionButtons(false);
      }
    });

    // Enter key handling
    document.getElementById('userInput').addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
    
    this.logger.debug('Event listeners initialized');
  }

  async initializeModel() {
    try {
      const validatedModel = await this.ollama.validateAndSelectModel(this.state.currentModel);
      
      if (validatedModel !== this.state.currentModel) {
        this.state.currentModel = validatedModel;
        this.state.saveState();
        this.ui.addMessage(`Model changed to: ${validatedModel}`, 'system');
        this.logger.logStateChange('AppController', 'model_changed', { 
          from: this.state.currentModel, 
          to: validatedModel 
        });
      } else {
        this.ui.addMessage(`Using model: ${validatedModel}`, 'system');
      }
      
      // Update model selector
      const models = await this.ollama.getAvailableModels();
      this.ui.updateModelSelect(models, this.state.currentModel);
      
    } catch (error) {
      this.logger.error('Error initializing model', error);
      this.ui.addMessage(`Error initializing model: ${error.message}`, 'error');
    }
  }

  updateUI() {
    this.ui.updateSessionInfo(this.state.sessionId);
    this.ui.selectAutomationType(this.state.selectedAutomationType);
    this.logger.debug('UI updated');
  }

  applySavedUIState() {
    // Apply saved UI state
    this.ui.toggleSection('sidebar', this.state.uiState.sidebarVisible);
    this.ui.toggleSection('userSection', this.state.uiState.userSectionVisible);
    this.ui.toggleSection('chatSection', this.state.uiState.chatSectionVisible);
    this.ui.updateCollapseButtons();
    this.logger.debug('Saved UI state applied');
  }

  async sendMessage() {
    const message = this.ui.userInput.value.trim();
    if (!message || this.state.isProcessing) return;

    // --- AI FILE EDITING VIA CHAT ---
    // Detect edit intent in chat (simple heuristics)
    // Examples: "Edit file", "Edit the file to ...", "Edit: ..."
    const editRegex = /^(edit( file)?(\s*[:\-])?\s*)(.+)$/i;
    const match = message.match(editRegex);
    let editInstruction = null;
    if (match) {
      // If a file is selected, use it
      const selectedFileId = window.fileUI?.selectedFileId;
      if (selectedFileId && window.fileManager?.isFileEditable(selectedFileId)) {
        editInstruction = match[4].trim();
        // Call performFileEdit directly
        this.ui.addMessage(`(AI Edit via chat detected)`, 'system');
        await this.performFileEdit(selectedFileId, editInstruction);
        this.ui.userInput.value = '';
        return;
      } else {
        this.ui.addMessage('No editable file is selected. Please select a text file first.', 'error');
        return;
      }
    }
    // --- END AI FILE EDITING VIA CHAT ---

    const startTime = performance.now();
    this.state.isProcessing = true;
    this.ui.setLoading(true);

    try {
      this.ui.addMessage(message, 'user');
      this.state.addMessage('user', message);
      this.ui.userInput.value = '';

      const context = this.buildContext();
      const aiResponse = await this.getAIResponse(message, context);

      this.ui.addMessage(aiResponse, 'agent');
      this.state.addMessage('assistant', aiResponse);

      const duration = performance.now() - startTime;
      this.logger.logPerformance('Message processing', duration, { 
        messageLength: message.length, 
        responseLength: aiResponse.length 
      });

    } catch (error) {
      this.logger.error('Error sending message', error);
      this.ui.addMessage(`Failed to get response: ${error.message}`, 'error');
    } finally {
      this.state.isProcessing = false;
      this.ui.setLoading(false);
    }
  }

  buildContext() {
    const context = {
      selectedText: this.state.getContext('selectedText'),
      sessionId: this.state.sessionId,
      conversationLength: this.state.conversationHistory.length,
      currentModel: this.state.currentModel,
      automationType: this.state.selectedAutomationType
    };

    // Add file context if FileManager is available
    if (window.fileManager && window.fileUI) {
      this.logger.debug('FileManager and FileUI available, building file context');
      
      const selectedFileInfo = window.fileUI.getSelectedFileInfo();
      if (selectedFileInfo) {
        this.logger.debug('Selected file found', { 
          fileId: selectedFileInfo.id,
          fileName: selectedFileInfo.name,
          category: selectedFileInfo.category 
        });
        
        context.selectedFile = {
          name: selectedFileInfo.name,
          type: selectedFileInfo.category,
          extension: selectedFileInfo.extension,
          size: selectedFileInfo.size
        };
        
        const fileContent = window.fileManager.getFileContent(selectedFileInfo.id);
        this.logger.debug('File content retrieved', { 
          hasContent: !!fileContent,
          contentLength: fileContent?.length || 0,
          contentPreview: fileContent?.substring(0, 100) + '...' || 'No content'
        });
        
        if (fileContent) {
          context.fileContent = fileContent;
        }
      } else {
        this.logger.debug('No selected file found');
      }
      
      // Add all files info for context
      const allFiles = window.fileManager.getAllFiles();
      if (allFiles.length > 0) {
        this.logger.debug('Available files found', { count: allFiles.length });
        context.availableFiles = allFiles.map(file => ({
          name: file.name,
          type: file.category,
          extension: file.extension,
          size: file.size
        }));
      } else {
        this.logger.debug('No files available');
      }
    } else {
      this.logger.debug('FileManager or FileUI not available');
    }

    // Add workspace context if WorkspaceManager is available
    if (window.workspaceManager) {
      this.logger.debug('WorkspaceManager available, building workspace context');
      
      const workspaceContext = window.workspaceManager.getWorkspaceContext();
      if (workspaceContext) {
        this.logger.debug('Workspace context found', { 
          totalFiles: workspaceContext.totalFiles,
          totalSize: workspaceContext.totalSize
        });
        
        context.workspace = workspaceContext;
        
        // Add workspace file contents for context
        const workspaceFiles = workspaceContext.workspaceFiles;
        if (workspaceFiles.length > 0) {
          context.workspaceFileContents = {};
          
          for (const file of workspaceFiles) {
            const content = window.workspaceManager.getWorkspaceFileContent(file.id);
            if (content) {
              context.workspaceFileContents[file.id] = {
                name: file.name,
                type: file.type,
                content: content
              };
              
              this.logger.debug('Workspace file content added', { 
                fileId: file.id,
                fileName: file.name,
                contentLength: content.length
              });
            }
          }
        }
      } else {
        this.logger.debug('No workspace context found');
      }
    } else {
      this.logger.debug('WorkspaceManager not available');
    }

    const recentMessages = this.state.getConversationContext();
    if (recentMessages.length > 0) {
      const previewLength = this.config.getMessagePreviewLength();
      context.recentConversation = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, previewLength)
      }));
    }

    this.logger.debug('Context built', { 
      contextKeys: Object.keys(context),
      hasSelectedFile: !!context.selectedFile,
      hasFileContent: !!context.fileContent,
      fileContentLength: context.fileContent?.length || 0,
      hasWorkspace: !!context.workspace,
      workspaceFilesCount: context.workspace?.totalFiles || 0
    });
    return context;
  }

  async getAIResponse(userMessage, context) {
    const messages = [
      { role: 'system', content: this.state.systemPrompt },
      ...this.state.getConversationContext().map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: this.buildPrompt(userMessage, context) }
    ];

    return await this.ollama.chat(messages, this.state.currentModel);
  }

  buildPrompt(userMessage, context) {
    let prompt = userMessage;

    if (context.selectedText) {
      prompt += `\n\nSelected text: "${context.selectedText}"`;
    }

    if (context.automationType) {
      prompt += `\n\nAutomation type: ${context.automationType}`;
    }

    // Add file context
    if (context.selectedFile) {
      prompt += `\n\nSelected file: ${context.selectedFile.name} (${context.selectedFile.type}, ${context.selectedFile.extension})`;
      if (context.fileContent) {
        prompt += `\n\nFile content:\n${context.fileContent}`;
        this.logger.debug('File content added to prompt', { 
          fileName: context.selectedFile.name,
          contentLength: context.fileContent.length,
          contentPreview: context.fileContent.substring(0, 200) + '...'
        });
      } else {
        this.logger.warn('No file content available for prompt', { fileName: context.selectedFile.name });
      }
    }

    if (context.availableFiles && context.availableFiles.length > 0) {
      prompt += `\n\nAvailable files (${context.availableFiles.length}):`;
      context.availableFiles.forEach(file => {
        prompt += `\n- ${file.name} (${file.type}, ${file.extension})`;
      });
    }

    // Add workspace context
    if (context.workspace && context.workspace.totalFiles > 0) {
      prompt += `\n\nWorkspace files (${context.workspace.totalFiles} files, total size: ${this.formatFileSize(context.workspace.totalSize)}):`;
      context.workspace.workspaceFiles.forEach(file => {
        prompt += `\n- ${file.name} (${file.type}, ${file.extension}, ${this.formatFileSize(file.size)})`;
      });
      
      // Add workspace file contents
      if (context.workspaceFileContents && Object.keys(context.workspaceFileContents).length > 0) {
        prompt += `\n\nWorkspace file contents:`;
        Object.entries(context.workspaceFileContents).forEach(([fileId, fileData]) => {
          prompt += `\n\n--- ${fileData.name} (${fileData.type}) ---\n${fileData.content}`;
          
          this.logger.debug('Workspace file content added to prompt', { 
            fileId: fileId,
            fileName: fileData.name,
            contentLength: fileData.content.length,
            contentPreview: fileData.content.substring(0, 200) + '...'
          });
        });
      }
    }

    if (context.recentConversation && context.recentConversation.length > 0) {
      prompt += `\n\nRecent conversation context: ${JSON.stringify(context.recentConversation)}`;
    }

    this.logger.debug('Prompt built', { 
      promptLength: prompt.length,
      hasFileContent: prompt.includes('File content:'),
      hasWorkspaceContent: prompt.includes('Workspace file contents:'),
      promptPreview: prompt.substring(0, 300) + '...'
    });

    return prompt;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async performAction(actionType) {
    const selected = this.state.getContext('selectedText') || "[no selection]";
    const actionMessage = `${actionType.toUpperCase()} request on: ${selected}`;
    
    this.ui.addMessage(actionMessage, 'user');
    this.state.addMessage('user', actionMessage);

    try {
      const context = this.buildContext();
      const response = await this.getAIResponse(actionMessage, context);
      
      this.ui.addMessage(response, 'agent');
      this.state.addMessage('assistant', response);
      
      this.logger.logUserAction('action_performed', { actionType, selectedLength: selected.length });
    } catch (error) {
      this.logger.error('Action failed', error);
      this.ui.addMessage(`Action failed: ${error.message}`, 'error');
    }
  }

  /**
   * Perform AI action on a specific file
   */
  async performFileAction(actionType, fileId) {
    if (!window.fileManager) {
      this.ui.addMessage('File management not available', 'error');
      return;
    }

    const file = window.fileManager.getFile(fileId);
    if (!file) {
      this.ui.addMessage('File not found', 'error');
      return;
    }

    const actionMessage = `${actionType.toUpperCase()} request on file: ${file.name}`;
    this.ui.addMessage(actionMessage, 'user');
    this.state.addMessage('user', actionMessage);

    try {
      // Set the file as selected for context
      if (window.fileUI) {
        window.fileUI.selectedFileId = fileId;
      }

      const context = this.buildContext();
      const response = await this.getAIResponse(actionMessage, context);
      
      this.ui.addMessage(response, 'agent');
      this.state.addMessage('assistant', response);
      
      this.logger.logUserAction('file_action_performed', { 
        actionType, 
        fileName: file.name,
        fileType: file.category 
      });
    } catch (error) {
      this.logger.error('File action failed', error);
      this.ui.addMessage(`File action failed: ${error.message}`, 'error');
    }
  }

  /**
   * Perform AI-powered file editing with actual content modification
   * @param {string} fileId - The file ID to edit
   * @param {string} editInstruction - User's editing instruction
   * @returns {Promise<boolean>} - Success status
   */
  async performFileEdit(fileId, editInstruction) {
    if (!window.fileManager) {
      this.ui.addMessage('File management not available', 'error');
      return false;
    }

    const file = window.fileManager.getFile(fileId);
    if (!file) {
      this.ui.addMessage('File not found', 'error');
      return false;
    }

    // Check if file is editable
    if (!window.fileManager.isFileEditable(fileId)) {
      this.ui.addMessage(`Cannot edit ${file.category} files. Only text files are editable.`, 'error');
      return false;
    }

    const actionMessage = `EDIT request on file: ${file.name}\n\nInstruction: ${editInstruction}`;
    this.ui.addMessage(actionMessage, 'user');
    this.state.addMessage('user', actionMessage);

    try {
      // Set the file as selected for context
      if (window.fileUI) {
        window.fileUI.selectedFileId = fileId;
      }

      const context = this.buildContext();
      
      // Build a specialized prompt for file editing
      const editPrompt = this.buildEditPrompt(editInstruction, context);
      const aiResponse = await this.getAIResponse(editPrompt, context);
      
      // Extract the edited content from AI response
      const editedContent = this.extractEditedContent(aiResponse, file.content);
      
      if (editedContent && editedContent !== file.content) {
        // Show preview of changes
        this.ui.addMessage(`📝 **AI Edit Preview:**\n\n${this.generateEditPreview(file.content, editedContent)}`, 'system');
        
        // Ask for confirmation
        const confirmed = await this.ui.showEditConfirmation(file.name, editInstruction);
        
        if (confirmed) {
          // Apply the changes
          await window.fileManager.updateFileContent(fileId, editedContent, editInstruction);
          
          // Update the file display
          if (window.fileUI) {
            window.fileUI.refreshFileDisplay(fileId);
          }
          
          this.ui.addMessage(`✅ **File updated successfully!**\n\nChanges applied to: ${file.name}`, 'success');
          this.logger.logUserAction('file_edit_applied', { 
            fileId, 
            fileName: file.name,
            instruction: editInstruction,
            oldSize: file.content?.length || 0,
            newSize: editedContent.length
          });
          
          return true;
        } else {
          this.ui.addMessage('❌ Edit cancelled by user', 'system');
          return false;
        }
      } else {
        this.ui.addMessage('⚠️ No changes detected in AI response. The file content remains unchanged.', 'system');
        return false;
      }
      
    } catch (error) {
      this.logger.error('File edit failed', error);
      this.ui.addMessage(`File edit failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Build specialized prompt for file editing
   * @param {string} editInstruction - User's editing instruction
   * @param {object} context - File context
   * @returns {string} - Formatted edit prompt
   */
  buildEditPrompt(editInstruction, context) {
    let prompt = `You are an expert file editor. Please edit the following file according to the user's instruction.

**EDITING INSTRUCTION:**
${editInstruction}

**FILE TO EDIT:**
Name: ${context.selectedFile.name}
Type: ${context.selectedFile.type}
Extension: ${context.selectedFile.extension}

**CURRENT FILE CONTENT:**
\`\`\`${this.getFileExtension(context.selectedFile.name)}
${context.fileContent}
\`\`\`

**INSTRUCTIONS:**
1. Analyze the current content and the editing instruction
2. Make the requested changes to the file content
3. Return ONLY the complete edited file content
4. Do not include any explanations, markdown formatting, or code blocks
5. Return the raw file content exactly as it should appear in the file
6. Preserve the original structure and formatting where appropriate
7. If the instruction is unclear, make reasonable assumptions based on context

**RESPONSE FORMAT:**
Return only the edited file content, nothing else.`;

    return prompt;
  }

  /**
   * Extract edited content from AI response
   * @param {string} aiResponse - AI's response
   * @param {string} originalContent - Original file content
   * @returns {string|null} - Extracted edited content or null if extraction failed
   */
  extractEditedContent(aiResponse, originalContent) {
    try {
      // Remove markdown code blocks if present
      let content = aiResponse.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
      
      // Remove any leading/trailing whitespace
      content = content.trim();
      
      // If the content is significantly different from original, return it
      if (content && content !== originalContent) {
        return content;
      }
      
      // If content is the same, try to extract from different patterns
      const patterns = [
        /^Content:\s*([\s\S]*)$/i,
        /^Edited content:\s*([\s\S]*)$/i,
        /^File content:\s*([\s\S]*)$/i
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1] && match[1].trim() !== originalContent) {
          return match[1].trim();
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to extract edited content', error);
      return null;
    }
  }

  /**
   * Generate a preview of changes between old and new content
   * @param {string} oldContent - Original content
   * @param {string} newContent - New content
   * @returns {string} - Formatted change preview
   */
  generateEditPreview(oldContent, newContent) {
    const oldLines = oldContent ? oldContent.split('\n') : [];
    const newLines = newContent ? newContent.split('\n') : [];
    
    const addedLines = newLines.length - oldLines.length;
    const removedLines = oldLines.length - newLines.length;
    const addedChars = Math.max(0, newContent.length - oldContent.length);
    const removedChars = Math.max(0, oldContent.length - newContent.length);
    
    return `**Changes Summary:**
• Lines: ${addedLines > 0 ? `+${addedLines}` : ''}${removedLines > 0 ? ` -${removedLines}` : ''}${addedLines === 0 && removedLines === 0 ? ' No line changes' : ''}
• Characters: ${addedChars > 0 ? `+${addedChars}` : ''}${removedChars > 0 ? ` -${removedChars}` : ''}${addedChars === 0 && removedChars === 0 ? ' No character changes' : ''}

**Preview (first 200 characters):**
${newContent.substring(0, 200)}${newContent.length > 200 ? '...' : ''}`;
  }

  /**
   * Get file extension from filename
   * @param {string} filename - The filename
   * @returns {string} - File extension
   */
  getFileExtension(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const extensionMap = {
      '.txt': 'text',
      '.md': 'markdown',
      '.py': 'python',
      '.js': 'javascript',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.csv': 'csv',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.vue': 'vue',
      '.php': 'php',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bash': 'bash',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.conf': 'conf',
      '.log': 'log'
    };
    
    return extensionMap[ext] || 'text';
  }

  loadConversationHistory() {
    const recentMessages = this.state.getConversationContext();
    recentMessages.forEach(msg => {
      if (msg.role === 'user') {
        this.ui.addMessage(msg.content, 'user');
      } else if (msg.role === 'assistant') {
        this.ui.addMessage(msg.content, 'agent');
      }
    });
    
    this.logger.debug('Conversation history loaded', { messageCount: recentMessages.length });
  }

  async changeModel(modelName) {
    try {
      const models = await this.ollama.getAvailableModels();
      const modelExists = models.some(model => model.name === modelName);
      
      if (modelExists) {
        this.state.currentModel = modelName;
        this.state.saveState();
        this.ui.updateModelSelect(models, modelName);
        this.ui.addMessage(`Model changed to: ${modelName}`, 'system');
        this.logger.logUserAction('model_changed', { modelName });
      } else {
        this.ui.addMessage(`Model ${modelName} not available`, 'error');
        this.logger.warn('Model not available', { requestedModel: modelName, availableModels: models.map(m => m.name) });
      }
    } catch (error) {
      this.logger.error('Failed to change model', error);
      this.ui.addMessage(`Failed to change model: ${error.message}`, 'error');
    }
  }

  clearSession() {
    this.state.clearSession();
    this.ui.clearChat();
    this.ui.addMessage('Session cleared', 'system');
    this.updateUI();
    this.logger.logUserAction('session_cleared');
  }

  createNewChat() {
    this.state.clearSession();
    this.ui.clearChat();
    this.ui.addMessage('New chat created', 'system');
    this.updateUI();
    this.logger.logUserAction('new_chat_created');
  }

  selectAutomationType(type) {
    this.state.setAutomationType(type);
    this.ui.selectAutomationType(type);
    this.ui.addMessage(`Automation type set to: ${type}`, 'system');
    this.logger.logUserAction('automation_type_changed', { type });
  }

  // Section toggle methods
  toggleSidebar() {
    if (this.state.canHideSection('sidebarVisible')) {
      const newState = !this.state.uiState.sidebarVisible;
      this.state.updateUIState('sidebarVisible', newState);
      this.ui.toggleSection('sidebar', newState);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('sidebar_toggled', { visible: newState });
    } else {
      this.ui.addMessage('Cannot hide sidebar: At least one section must remain visible', 'system');
      this.logger.warn('Cannot hide sidebar - at least one section must remain visible');
    }
  }

  toggleUserSection() {
    if (this.state.canHideSection('userSectionVisible')) {
      const newState = !this.state.uiState.userSectionVisible;
      this.state.updateUIState('userSectionVisible', newState);
      this.ui.toggleSection('userSection', newState);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('user_section_toggled', { visible: newState });
    } else {
      this.ui.addMessage('Cannot hide user section: At least one section must remain visible', 'system');
      this.logger.warn('Cannot hide user section - at least one section must remain visible');
    }
  }

  toggleChatSection() {
    if (this.state.canHideSection('chatSectionVisible')) {
      const newState = !this.state.uiState.chatSectionVisible;
      this.state.updateUIState('chatSectionVisible', newState);
      this.ui.toggleSection('chatSection', newState);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('chat_section_toggled', { visible: newState });
    } else {
      this.ui.addMessage('Cannot hide chat section: At least one section must remain visible', 'system');
      this.logger.warn('Cannot hide chat section - at least one section must remain visible');
    }
  }

  // Peek and restore methods
  restoreSidebar() {
    if (this.state.canHideSection('sidebarVisible')) {
      this.state.updateUIState('sidebarVisible', true);
      this.ui.toggleSection('sidebar', true);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('sidebar_restored');
    }
  }

  restoreUserSection() {
    if (this.state.canHideSection('userSectionVisible')) {
      this.state.updateUIState('userSectionVisible', true);
      this.ui.toggleSection('userSection', true);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('user_section_restored');
    }
  }

  restoreChatSection() {
    if (this.state.canHideSection('chatSectionVisible')) {
      this.state.updateUIState('chatSectionVisible', true);
      this.ui.toggleSection('chatSection', true);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('chat_section_restored');
    }
  }

  // Debug methods
  async checkModels() {
    const models = await this.ollama.getAvailableModels();
    this.logger.info('Available models checked', { models: models.map(m => m.name) });
    this.ui.addMessage(`Available models: ${models.map(m => m.name).join(', ')}`, 'system');
  }

  resetModel() {
    this.state.resetModel();
    this.logger.logUserAction('model_reset');
    location.reload();
  }

  initializeConnectionStatus() {
    this.updateConnectionStatus('connecting', 'Connecting...');
    
    // Test connection on initialization
    this.testConnection();
    
    // Set up periodic connection monitoring
    this.connectionMonitor = setInterval(() => {
      this.testConnection();
    }, 30000); // Check every 30 seconds
    
    // Add click handler for connection status
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.addEventListener('click', () => {
        this.testConnection(true); // Force test
      });
    }
  }

  async testConnection(force = false) {
    try {
      const result = await this.ollama.testConnection();
      
      if (result.success) {
        this.updateConnectionStatus('connected', 'Connected');
        this.logger.debug('Connection test successful');
      } else {
        this.updateConnectionStatus('error', 'Connection Error');
        this.logger.error('Connection test failed', result.error);
      }
    } catch (error) {
      this.updateConnectionStatus('disconnected', 'Disconnected');
      this.logger.error('Connection test error', error);
    }
  }

  updateConnectionStatus(status, text) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (indicator && statusText) {
      // Remove all status classes
      indicator.classList.remove('connected', 'connecting', 'disconnected', 'error');
      
      // Add current status class
      indicator.classList.add(status);
      
      // Update text
      statusText.textContent = text;
      
      this.logger.debug('Connection status updated', { status, text });
    }
  }

  cleanup() {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }
  }

  get ollamaAPI() {
    return this.ollama;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppController;
} else {
  window.AppController = AppController;
} 