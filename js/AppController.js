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
    
    this.logger.info('AppController initialized successfully');
  }

  initializeEventListeners() {
    // Text selection handling
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

    const recentMessages = this.state.getConversationContext();
    if (recentMessages.length > 0) {
      const previewLength = this.config.getMessagePreviewLength();
      context.recentConversation = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, previewLength)
      }));
    }

    this.logger.debug('Context built', { contextKeys: Object.keys(context) });
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

    if (context.recentConversation && context.recentConversation.length > 0) {
      prompt += `\n\nRecent conversation context: ${JSON.stringify(context.recentConversation)}`;
    }

    return prompt;
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
  peekSidebar(show) {
    this.ui.peekSection('sidebar', show);
  }

  restoreSidebar() {
    if (this.state.canHideSection('sidebarVisible')) {
      this.state.updateUIState('sidebarVisible', true);
      this.ui.toggleSection('sidebar', true);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('sidebar_restored');
    }
  }

  peekUserSection(show) {
    this.ui.peekSection('userSection', show);
  }

  restoreUserSection() {
    if (this.state.canHideSection('userSectionVisible')) {
      this.state.updateUIState('userSectionVisible', true);
      this.ui.toggleSection('userSection', true);
      this.ui.updateCollapseButtons();
      this.logger.logUserAction('user_section_restored');
    }
  }

  peekChatSection(show) {
    this.ui.peekSection('chatSection', show);
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppController;
} else {
  window.AppController = AppController;
} 