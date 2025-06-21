/**
 * Ollama API Integration
 * Handles all communication with the Ollama API
 */
class OllamaAPI {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.endpoint = this.config.getOllamaEndpoint();
    this.modelsEndpoint = this.config.get('ollama.modelsEndpoint');
  }

  async chat(messages, model = null, options = {}) {
    const startTime = performance.now();
    const targetModel = model || this.config.getDefaultModel();
    const requestOptions = { ...this.config.getRequestOptions(), ...options };
    
    // Convert chat messages to a single prompt for generate endpoint
    const prompt = this.convertMessagesToPrompt(messages);
    
    const requestBody = {
      model: targetModel,
      prompt: prompt,
      ...requestOptions
    };

    this.logger.logAPIRequest(this.endpoint, 'POST', { model: targetModel, messageCount: messages.length });

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.includes('model') && errorData.error.includes('not found')) {
            errorMessage = this.config.getErrorPrompt('modelNotFound', targetModel);
          } else if (errorData.error) {
            errorMessage = `Ollama error: ${errorData.error}`;
          }
        } catch (e) {
          if (errorText.includes('model') && errorText.includes('not found')) {
            errorMessage = this.config.getErrorPrompt('modelNotFound', targetModel);
          }
        }
        
        this.logger.logAPIResponse(this.endpoint, response.status, { error: errorMessage });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const duration = performance.now() - startTime;
      
      this.logger.logAPIResponse(this.endpoint, response.status, { 
        model: targetModel, 
        responseLength: data.response?.length || 0 
      });
      this.logger.logPerformance('Ollama API request', duration, { model: targetModel });
      
      return data.response;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Ollama API request (failed)', duration, { model: targetModel });
      
      this.logger.error('Ollama API error', error);
      
      if (error.message.includes('CORS') || error.message.includes('preflight')) {
        throw new Error(this.config.getErrorPrompt('corsError'));
      }
      
      throw error;
    }
  }

  convertMessagesToPrompt(messages) {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }

  async getAvailableModels() {
    this.logger.logAPIRequest(this.modelsEndpoint, 'GET');
    
    try {
      const response = await fetch(this.modelsEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      this.logger.logAPIResponse(this.modelsEndpoint, response.status, { modelCount: models.length });
      this.logger.debug('Available models retrieved', models);
      
      return models;
    } catch (error) {
      this.logger.error('Failed to fetch models', error);
      return [];
    }
  }

  async validateAndSelectModel(currentModel) {
    try {
      const availableModels = await this.getAvailableModels();
      this.logger.debug('Model validation', { currentModel, availableModels });
      
      const modelExists = availableModels.some(model => model.name === currentModel);
      
      if (!modelExists && availableModels.length > 0) {
        const fallbackModel = availableModels[0].name;
        this.logger.warn(`Model '${currentModel}' not found, using '${fallbackModel}' instead`, {
          requestedModel: currentModel,
          fallbackModel: fallbackModel,
          availableModels: availableModels.map(m => m.name)
        });
        return fallbackModel;
      }
      
      return currentModel;
    } catch (error) {
      this.logger.error('Error validating model', error);
      return currentModel;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OllamaAPI;
} else {
  window.OllamaAPI = OllamaAPI;
} 