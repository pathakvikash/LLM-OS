/**
 * Application Configuration
 * Centralized configuration for all application settings
 */
class AppConfig {
  constructor() {
    this.defaults = {
      // Ollama API Configuration
      ollama: {
        endpoint: this.getOllamaEndpoint(),
        modelsEndpoint: this.getOllamaModelsEndpoint(),
        defaultModel: 'llama3.2:1b',
        requestOptions: {
          temperature: 0.7,
          top_p: 0.9,
          stream: false
        }
      },

      // UI Configuration
      ui: {
        maxConversationHistory: 20,
        maxContextMessages: 10,
        messagePreviewLength: 200,
        sessionIdDisplayLength: 20,
        fadeInAnimation: true
      },

      // Session Configuration
      session: {
        localStorageKey: 'llmOS_state',
        autoSave: true,
        saveInterval: 5000 // 5 seconds
      },

      // Automation Configuration
      automation: {
        defaultType: 'ask',
        availableTypes: ['edit', 'ask', 'agent']
      },

      // System Prompts
      prompts: {
        system: `You are an intelligent AI assistant integrated into a web application. 
        You have access to user context including selected text and application state.
        Always provide helpful, concise, and actionable responses.
        Maintain context awareness and refer to previous conversation when relevant.`,
        
        error: {
          modelNotFound: (model) => `Model '${model}' not found. Please ensure the model is pulled with: ollama pull ${model}`,
          corsError: 'CORS Error: Make sure Ollama is running and accessible. You may need to configure CORS in Ollama or use a proxy.',
          generalError: (error) => `An error occurred: ${error}`,
          initializationError: 'Failed to initialize application. Please check the console for details.'
        }
      },

      // Debug Configuration
      debug: {
        enabled: false,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        showContextInfo: false
      }
    };

    // Load custom configuration if available
    this.config = this.loadCustomConfig();
  }

  /**
   * Detect if the application is running in a deployed environment
   * @returns {boolean}
   */
  isDeployed() {
    // Check if we're not on localhost
    const hostname = window.location.hostname;
    return hostname !== 'localhost' && 
           hostname !== '127.0.0.1' && 
           !hostname.includes('192.168.') &&
           !hostname.includes('10.') &&
           !hostname.includes('172.');
  }

  /**
   * Get the appropriate Ollama endpoint based on environment
   * @returns {string}
   */
  getOllamaEndpoint() {
    // Check for custom endpoint in localStorage first
    const customEndpoint = localStorage.getItem('llmOS_ollama_endpoint');
    if (customEndpoint) {
      return customEndpoint;
    }

    // Use localhost for deployed environments, relative path for local development
    if (this.isDeployed()) {
      return 'http://localhost:11434/api/generate';
    } else {
      return '/api/generate';
    }
  }

  /**
   * Get the appropriate Ollama models endpoint based on environment
   * @returns {string}
   */
  getOllamaModelsEndpoint() {
    // Check for custom models endpoint in localStorage first
    const customModelsEndpoint = localStorage.getItem('llmOS_ollama_models_endpoint');
    if (customModelsEndpoint) {
      return customModelsEndpoint;
    }

    // Use localhost for deployed environments, relative path for local development
    if (this.isDeployed()) {
      return 'http://localhost:11434/api/tags';
    } else {
      return '/api/tags';
    }
  }

  loadCustomConfig() {
    try {
      // Check for custom config in localStorage
      const customConfig = localStorage.getItem('llmOS_config');
      if (customConfig) {
        return { ...this.defaults, ...JSON.parse(customConfig) };
      }
    } catch (error) {
      console.warn('Failed to load custom config:', error);
    }
    
    return this.defaults;
  }

  saveCustomConfig(customConfig) {
    try {
      this.config = { ...this.defaults, ...customConfig };
      localStorage.setItem('llmOS_config', JSON.stringify(customConfig));
    } catch (error) {
      console.warn('Failed to save custom config:', error);
    }
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
    target[lastKey] = value;
  }

  // Convenience methods for common configurations
  getDefaultModel() {
    return this.get('ollama.defaultModel');
  }

  getRequestOptions() {
    return this.get('ollama.requestOptions');
  }

  getSystemPrompt() {
    return this.get('prompts.system');
  }

  getErrorPrompt(type, ...args) {
    const errorPrompts = this.get('prompts.error');
    const prompt = errorPrompts[type];
    return typeof prompt === 'function' ? prompt(...args) : prompt;
  }

  isDebugEnabled() {
    return this.get('debug.enabled');
  }

  getLogLevel() {
    return this.get('debug.logLevel');
  }

  shouldShowContextInfo() {
    return this.get('debug.showContextInfo');
  }

  getMaxConversationHistory() {
    return this.get('ui.maxConversationHistory');
  }

  getMaxContextMessages() {
    return this.get('ui.maxContextMessages');
  }

  getMessagePreviewLength() {
    return this.get('ui.messagePreviewLength');
  }

  getSessionIdDisplayLength() {
    return this.get('ui.sessionIdDisplayLength');
  }

  getLocalStorageKey() {
    return this.get('session.localStorageKey');
  }

  getDefaultAutomationType() {
    return this.get('automation.defaultType');
  }

  getAvailableAutomationTypes() {
    return this.get('automation.availableTypes');
  }

  /**
   * Set a custom Ollama endpoint
   * @param {string} endpoint - The custom endpoint URL
   */
  setCustomOllamaEndpoint(endpoint) {
    localStorage.setItem('llmOS_ollama_endpoint', endpoint);
  }

  /**
   * Set a custom Ollama models endpoint
   * @param {string} endpoint - The custom models endpoint URL
   */
  setCustomOllamaModelsEndpoint(endpoint) {
    localStorage.setItem('llmOS_ollama_models_endpoint', endpoint);
  }

  /**
   * Clear custom Ollama endpoints and use default behavior
   */
  clearCustomOllamaEndpoints() {
    localStorage.removeItem('llmOS_ollama_endpoint');
    localStorage.removeItem('llmOS_ollama_models_endpoint');
  }

  /**
   * Get current environment information
   * @returns {object} Environment details
   */
  getEnvironmentInfo() {
    return {
      isDeployed: this.isDeployed(),
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port,
      currentOllamaEndpoint: this.getOllamaEndpoint(),
      currentModelsEndpoint: this.getOllamaModelsEndpoint()
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
} else {
  window.AppConfig = AppConfig;
} 