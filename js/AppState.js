/**
 * Application State Management
 * Handles session management, context, conversation history, and UI state
 */
class AppState {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    this.sessionId = this.generateSessionId();
    this.userContext = new Map();
    this.conversationHistory = [];
    this.currentModel = this.config.getDefaultModel();
    this.ollamaEndpoint = this.config.getOllamaEndpoint();
    this.isProcessing = false;
    this.systemPrompt = this.config.getSystemPrompt();
    this.selectedAutomationType = this.config.getDefaultAutomationType();
    
    // UI State Management
    this.uiState = {
      sidebarVisible: true,
      userSectionVisible: true,
      chatSectionVisible: true
    };
    
    // Load state from localStorage if available
    this.loadState();
    
    this.logger.info('AppState initialized', {
      sessionId: this.sessionId,
      currentModel: this.currentModel,
      automationType: this.selectedAutomationType
    });
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  updateContext(key, value) {
    this.userContext.set(key, value);
    this.saveState();
    this.logger.logStateChange('AppState', 'context_update', { key, value });
  }

  getContext(key) {
    return this.userContext.get(key);
  }

  addMessage(role, content, metadata = {}) {
    const message = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };
    this.conversationHistory.push(message);
    this.saveState();
    
    this.logger.logStateChange('AppState', 'message_added', { role, contentLength: content.length });
    return message;
  }

  getConversationContext() {
    // Return last N messages for context based on config
    const maxMessages = this.config.getMaxContextMessages();
    return this.conversationHistory.slice(-maxMessages);
  }

  saveState() {
    try {
      const maxHistory = this.config.getMaxConversationHistory();
      const stateData = {
        sessionId: this.sessionId,
        userContext: Object.fromEntries(this.userContext),
        conversationHistory: this.conversationHistory.slice(-maxHistory),
        currentModel: this.currentModel,
        selectedAutomationType: this.selectedAutomationType,
        uiState: this.uiState
      };
      
      const storageKey = this.config.getLocalStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(stateData));
      
      this.logger.debug('State saved to localStorage', { storageKey });
    } catch (error) {
      this.logger.error('Failed to save state', error);
    }
  }

  loadState() {
    try {
      const storageKey = this.config.getLocalStorageKey();
      const savedState = localStorage.getItem(storageKey);
      
      if (savedState) {
        const stateData = JSON.parse(savedState);
        this.sessionId = stateData.sessionId || this.sessionId;
        this.userContext = new Map(Object.entries(stateData.userContext || {}));
        this.conversationHistory = stateData.conversationHistory || [];
        this.currentModel = stateData.currentModel || this.currentModel;
        this.selectedAutomationType = stateData.selectedAutomationType || this.selectedAutomationType;
        this.uiState = { ...this.uiState, ...stateData.uiState };
        
        this.logger.info('State loaded from localStorage', {
          sessionId: this.sessionId,
          messageCount: this.conversationHistory.length,
          contextKeys: Array.from(this.userContext.keys())
        });
      }
    } catch (error) {
      this.logger.error('Failed to load state', error);
    }
  }

  clearSession() {
    this.sessionId = this.generateSessionId();
    this.conversationHistory = [];
    this.userContext.clear();
    this.saveState();
    
    this.logger.logUserAction('session_cleared', { newSessionId: this.sessionId });
  }

  resetModel() {
    // Reset to default model and clear cache
    this.currentModel = this.config.getDefaultModel();
    const storageKey = this.config.getLocalStorageKey();
    localStorage.removeItem(storageKey);
    
    this.logger.logUserAction('model_reset', { newModel: this.currentModel });
  }

  setAutomationType(type) {
    this.selectedAutomationType = type;
    this.saveState();
    this.logger.logStateChange('AppState', 'automation_type_changed', { type });
  }

  // UI State Management
  updateUIState(key, value) {
    this.uiState[key] = value;
    this.saveState();
    this.logger.logStateChange('AppState', 'ui_state_changed', { key, value });
  }

  canHideSection(sectionName) {
    const visibleSections = Object.values(this.uiState).filter(visible => visible).length;
    return visibleSections > 1 || !this.uiState[sectionName];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppState;
} else {
  window.AppState = AppState;
} 