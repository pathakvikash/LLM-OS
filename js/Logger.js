/**
 * Logger Utility
 * Provides consistent logging and debugging capabilities
 */
class Logger {
  constructor(config) {
    this.config = config;
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    const currentLevel = this.logLevels[this.config.getLogLevel()] || 1;
    const messageLevel = this.logLevels[level] || 1;
    return messageLevel >= currentLevel;
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[LLM-OS] [${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message}`, data;
    }
    return `${prefix} ${message}`;
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      const formattedMessage = this.formatMessage('debug', message);
      if (data) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      const formattedMessage = this.formatMessage('info', message);
      if (data) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      const formattedMessage = this.formatMessage('warn', message);
      if (data) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
    }
  }

  error(message, error = null) {
    if (this.shouldLog('error')) {
      const formattedMessage = this.formatMessage('error', message);
      if (error) {
        console.error(formattedMessage, error);
      } else {
        console.error(formattedMessage);
      }
    }
  }

  // Specialized logging methods
  logStateChange(component, action, data = null) {
    this.debug(`${component} state changed: ${action}`, data);
  }

  logAPIRequest(endpoint, method, data = null) {
    this.debug(`API Request: ${method} ${endpoint}`, data);
  }

  logAPIResponse(endpoint, status, data = null) {
    this.debug(`API Response: ${status} ${endpoint}`, data);
  }

  logUserAction(action, context = null) {
    this.info(`User action: ${action}`, context);
  }

  logError(error, context = null) {
    this.error(`Application error: ${error.message}`, { error, context });
  }

  // Performance logging
  logPerformance(operation, duration, data = null) {
    this.debug(`Performance: ${operation} took ${duration}ms`, data);
  }

  // Group logging for related operations
  group(label, callback) {
    if (this.config.isDebugEnabled()) {
      console.group(`[LLM-OS] ${label}`);
      callback();
      console.groupEnd();
    }
  }

  // Table logging for structured data
  table(data, columns = null) {
    if (this.config.isDebugEnabled()) {
      if (columns) {
        console.table(data, columns);
      } else {
        console.table(data);
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
} else {
  window.Logger = Logger;
} 