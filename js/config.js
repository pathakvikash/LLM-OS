/**
 * Application Configuration
 * Centralized configuration for all application settings
 */
class AppConfig {
  constructor() {
    this.defaults = {
      // Ollama API Configuration
      ollama: {
        endpoint: '/api/generate',
        modelsEndpoint: '/api/tags',
        defaultModel: 'llama3.2:1b',
        requestOptions: {
          temperature: 0.7,
          top_p: 0.9,
          stream: false
        }
      },

      // Web Search Configuration
      webSearch: {
        providers: {
          duckduckgo: {
            enabled: true,
            rateLimit: { requests: 50, window: 60000 }
          },
          google: {
            enabled: false,
            apiKey: this.getEnvVar('GOOGLE_API_KEY', ''),
            searchEngineId: this.getEnvVar('GOOGLE_SEARCH_ENGINE_ID', ''),
            rateLimit: { requests: 100, window: 60000 }
          },
          bing: {
            enabled: false,
            apiKey: this.getEnvVar('BING_API_KEY', ''),
            rateLimit: { requests: 50, window: 60000 }
          }
        },
        cache: {
          enabled: true,
          ttl: 3600000, // 1 hour
          maxSize: 1000
        },
        extraction: {
          enabled: true,
          maxContentLength: 50000,
          timeout: 10000
        },
        ai: {
          enabled: true,
          analysisPrompt: 'Analyze the following search results and provide insights:',
          maxResultsToAnalyze: 5
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

  getEnvVar(name, defaultValue = '') {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // In browser, try to get from window object or localStorage
      return window[name] || localStorage.getItem(name) || defaultValue;
    }
    
    // In Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name] || defaultValue;
    }
    
    return defaultValue;
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
  getOllamaEndpoint() {
    return this.get('ollama.endpoint');
  }

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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
} else {
  window.AppConfig = AppConfig;
} 