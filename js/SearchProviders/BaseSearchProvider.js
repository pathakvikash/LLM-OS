/**
 * Base Search Provider
 * Abstract base class for all search providers
 */
class BaseSearchProvider {
  constructor(name, config, logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
    this.rateLimiter = this.createRateLimiter(config.rateLimit);
  }

  createRateLimiter(rateLimitConfig) {
    if (!rateLimitConfig) {
      return null;
    }

    return {
      requests: rateLimitConfig.requests || 100,
      window: rateLimitConfig.window || 60000, // 1 minute default
      currentRequests: 0,
      resetTime: Date.now() + (rateLimitConfig.window || 60000),

      checkLimit() {
        const now = Date.now();
        
        // Reset counter if window has passed
        if (now > this.resetTime) {
          this.currentRequests = 0;
          this.resetTime = now + this.window;
        }

        if (this.currentRequests >= this.requests) {
          return false;
        }

        this.currentRequests++;
        return true;
      },

      reset() {
        this.currentRequests = 0;
        this.resetTime = Date.now() + this.window;
      }
    };
  }

  async search(query, options = {}) {
    throw new Error('search() method must be implemented by subclass');
  }

  async getSuggestions(query) {
    throw new Error('getSuggestions() method must be implemented by subclass');
  }

  normalizeResults(rawResults) {
    // Convert provider-specific results to standard format
    return rawResults.map(result => ({
      id: this.generateResultId(result),
      title: result.title || result.name || '',
      url: result.url || result.link || '',
      snippet: result.snippet || result.description || '',
      content: result.content || '',
      metadata: {
        source: this.name,
        timestamp: new Date(),
        relevance: result.relevance || 0.5,
        language: result.language || 'en'
      },
      provider: this.name,
      cached: false
    }));
  }

  generateResultId(result) {
    // Generate a unique ID for the result
    const url = result.url || result.link || '';
    const title = result.title || result.name || '';
    return btoa(`${this.name}:${url}:${title}`).replace(/[^a-zA-Z0-9]/g, '');
  }

  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }
    
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      throw new Error('Query cannot be empty');
    }

    return trimmedQuery;
  }

  logSearch(query, resultCount, duration) {
    this.logger.info(`Search completed for provider ${this.name}`, {
      query,
      resultCount,
      duration,
      provider: this.name
    });
  }

  logError(error, context = {}) {
    this.logger.error(`Search error for provider ${this.name}`, {
      error: error.message,
      provider: this.name,
      ...context
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseSearchProvider;
} else {
  window.BaseSearchProvider = BaseSearchProvider;
} 