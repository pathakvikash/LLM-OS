/**
 * Global Functions Module
 * Handles all global window functions and application initialization
 */
class GlobalFunctions {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.app = null;
  }

  initialize() {
    try {
      this.app = new AppController(this.config, this.logger);
      this.setupGlobalFunctions();
      this.logger.info('Global functions initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize global functions', error);
      throw error;
    }
  }

  setupGlobalFunctions() {
    // Core functionality
    window.sendMessage = () => this.app.sendMessage();
    window.performAction = (actionType) => this.app.performAction(actionType);
    window.performFileAction = (actionType, fileId) => this.app.performFileAction(actionType, fileId);
    window.performFileEdit = (fileId, editInstruction) => this.app.performFileEdit(fileId, editInstruction);
    window.handleKeyPress = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.app.sendMessage();
      }
    };

    // Model and automation functions
    window.changeModel = (modelName) => this.app.changeModel(modelName);
    window.selectAutomationType = (type) => this.app.selectAutomationType(type);
    window.createNewChat = () => this.app.createNewChat();
    window.clearSession = () => this.app.clearSession();
    window.resetModel = () => this.app.resetModel();
    
    // Section toggle functions
    window.toggleSidebar = () => this.app.toggleSidebar();
    window.toggleUserSection = () => this.app.toggleUserSection();
    window.toggleChatSection = () => this.app.toggleChatSection();
    
    // Peek and restore functions
    window.restoreSidebar = () => this.app.restoreSidebar();
    window.restoreUserSection = () => this.app.restoreUserSection();
    window.restoreChatSection = () => this.app.restoreChatSection();
    
    // Tab switching function
    window.switchTab = (tabName) => this.switchTab(tabName);
    
    // Resize functions
    window.resetSectionSizes = () => {
      if (window.resizeManager) {
        window.resizeManager.resetSizes();
      }
    };
    window.saveSectionSizes = () => {
      if (window.resizeManager) {
        window.resizeManager.saveSizes();
      }
    };
    
    // Debug functions
    window.checkModels = () => this.app.checkModels();
    window.testConnection = async () => {
      if (this.app && this.app.ollamaAPI) {
        const result = await this.app.ollamaAPI.testConnection();
        console.log('Connection test result:', result);
        return result;
      } else {
        console.error('OllamaAPI not available');
        return { success: false, error: 'OllamaAPI not available' };
      }
    };
    
    // Connection management functions
    window.testConnection = async () => this.testConnection();
    window.showEndpointConfig = () => this.showEndpointConfig();
    window.updateConnectionStatus = () => this.updateConnectionStatus();
    
    this.logger.debug('Global functions setup completed');
  }

  /**
   * Switch between tabs in the user section
   */
  switchTab(tabName) {
    try {
      // Update tab buttons
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
          btn.classList.add('active');
        }
      });

      // Update tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName + 'Tab') {
          content.classList.add('active');
        }
      });

      this.logger.debug('Tab switched', { tabName });
    } catch (error) {
      this.logger.error('Failed to switch tab', { tabName, error: error.message });
    }
  }

  getApp() {
    return this.app;
  }

  get appController() {
    return this.app;
  }

  /**
   * Test connection to Ollama API
   */
  async testConnection() {
    try {
      if (!this.app || !this.app.ollamaAPI) {
        throw new Error('OllamaAPI not available');
      }

      // Update status to checking
      this.updateConnectionStatus('checking', 'Testing connection...');
      
      const result = await this.app.ollamaAPI.testConnection();
      
      if (result.success) {
        this.updateConnectionStatus('connected', `Connected (${result.models.length} models)`);
        this.logger.info('Connection test successful', result);
      } else {
        this.updateConnectionStatus('disconnected', 'Connection failed');
        this.logger.error('Connection test failed', result);
      }
      
      return result;
    } catch (error) {
      this.updateConnectionStatus('disconnected', 'Connection error');
      this.logger.error('Connection test error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Show endpoint configuration dialog
   */
  showEndpointConfig() {
    const currentEndpoint = this.config.getOllamaEndpoint();
    const currentModelsEndpoint = this.config.getOllamaModelsEndpoint();
    const envInfo = this.config.getEnvironmentInfo();
    
    const endpoint = prompt(
      `Configure Ollama Endpoint\n\n` +
      `Current endpoint: ${currentEndpoint}\n` +
      `Environment: ${envInfo.isDeployed ? 'Deployed' : 'Local'}\n\n` +
      `Enter new endpoint (or leave empty to use default):`,
      currentEndpoint
    );
    
    if (endpoint !== null) {
      if (endpoint.trim() === '') {
        // Clear custom endpoint to use default
        this.config.clearCustomOllamaEndpoints();
        this.logger.info('Cleared custom endpoints, using defaults');
      } else {
        // Set custom endpoint
        this.config.setCustomOllamaEndpoint(endpoint.trim());
        this.logger.info('Set custom Ollama endpoint', { endpoint: endpoint.trim() });
      }
      
      // Reinitialize the app with new endpoints
      this.reinitializeWithNewEndpoints();
    }
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(status = 'checking', message = 'Checking...') {
    try {
      const statusElement = document.getElementById('sidebarConnectionStatus');
      const endpointElement = document.getElementById('sidebarEndpoint');
      
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-value ${status}`;
      }
      
      if (endpointElement) {
        const endpoint = this.config.getOllamaEndpoint();
        endpointElement.textContent = endpoint;
        endpointElement.title = endpoint;
      }
    } catch (error) {
      this.logger.error('Failed to update connection status', error);
    }
  }

  /**
   * Reinitialize the app with new endpoints
   */
  reinitializeWithNewEndpoints() {
    try {
      // Update the OllamaAPI endpoints
      if (this.app && this.app.ollamaAPI) {
        this.app.ollamaAPI.endpoint = this.config.getOllamaEndpoint();
        this.app.ollamaAPI.modelsEndpoint = this.config.getOllamaModelsEndpoint();
        this.logger.info('Updated OllamaAPI endpoints', {
          endpoint: this.app.ollamaAPI.endpoint,
          modelsEndpoint: this.app.ollamaAPI.modelsEndpoint
        });
      }
      
      // Update the display
      this.updateConnectionStatus();
      
      // Test the new connection
      setTimeout(() => this.testConnection(), 500);
    } catch (error) {
      this.logger.error('Failed to reinitialize with new endpoints', error);
    }
  }
}

// Legacy function for backward compatibility
function toggleSection(sectionId) {
  const sectionIds = ['sidebar', 'userSection', 'chatSection'];
  const visibleSections = sectionIds.filter(id => !document.getElementById(id).classList.contains('collapsed'));
  const section = document.getElementById(sectionId);

  if (!section.classList.contains('collapsed') && visibleSections.length === 1) {
    alert('At least one section must remain visible.');
    return;
  }
  section.classList.toggle('collapsed');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlobalFunctions, toggleSection };
} else {
  window.GlobalFunctions = GlobalFunctions;
  window.toggleSection = toggleSection;
} 