/**
 * Web Search API
 * Core web search functionality with caching, rate limiting, and provider management
 */
class WebSearchAPI {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providers = new Map();
    this.searchCache = new Map();
    this.rateLimiters = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    const webSearchConfig = this.config.get('webSearch');
    if (!webSearchConfig) {
      this.logger.warn('Web search configuration not found, using defaults');
      return;
    }

    // Initialize enabled providers
    Object.entries(webSearchConfig.providers || {}).forEach(([name, providerConfig]) => {
      if (providerConfig.enabled) {
        try {
          const ProviderClass = this.getProviderClass(name);
          if (ProviderClass) {
            const provider = new ProviderClass(name, providerConfig, this.logger);
            this.providers.set(name, provider);
            this.logger.info(`Initialized web search provider: ${name}`);
          }
        } catch (error) {
          this.logger.error(`Failed to initialize provider ${name}:`, error);
        }
      }
    });

    if (this.providers.size === 0) {
      this.logger.warn('No web search providers initialized');
    }
  }

  getProviderClass(name) {
    const providerClasses = {
      'duckduckgo': DuckDuckGoSearch,
      'google': GoogleSearch,
      'bing': BingSearch
    };
    return providerClasses[name];
  }

  async search(query, options = {}) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(query, options);
    
    // Check cache first
    if (this.isCacheEnabled() && this.searchCache.has(cacheKey)) {
      const cachedResult = this.searchCache.get(cacheKey);
      if (!this.isCacheExpired(cachedResult.timestamp)) {
        this.logger.debug('Returning cached search result', { query, cacheKey });
        return cachedResult.results;
      } else {
        this.searchCache.delete(cacheKey);
      }
    }

    this.logger.info('Performing web search', { query, options });

    try {
      // Select best provider based on query and availability
      const provider = this.selectProvider(query, options);
      if (!provider) {
        throw new Error('No available search providers');
      }

      // Check rate limiting
      if (!this.checkRateLimit(provider.name)) {
        throw new Error(`Rate limit exceeded for provider: ${provider.name}`);
      }

      // Perform search
      const results = await provider.search(query, options);
      
      // Cache results if enabled
      if (this.isCacheEnabled()) {
        this.cacheResults(cacheKey, results);
      }

      const duration = performance.now() - startTime;
      this.logger.logPerformance('Web search', duration, { 
        provider: provider.name, 
        query, 
        resultCount: results.length 
      });

      return results;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Web search (failed)', duration, { query });
      this.logger.error('Web search failed', error);
      throw error;
    }
  }

  async getSearchSuggestions(query) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Try to get suggestions from the first available provider
      const provider = Array.from(this.providers.values())[0];
      if (provider && typeof provider.getSuggestions === 'function') {
        return await provider.getSuggestions(query);
      }
    } catch (error) {
      this.logger.error('Failed to get search suggestions', error);
    }

    return [];
  }

  async extractContent(url) {
    const startTime = performance.now();
    
    try {
      this.logger.info('Extracting content from URL', { url });
      
      const response = await fetch('/api/web-search/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const duration = performance.now() - startTime;
      
      this.logger.logPerformance('Content extraction', duration, { url });
      return data.content;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Content extraction (failed)', duration, { url });
      this.logger.error('Content extraction failed', error);
      throw error;
    }
  }

  selectProvider(query, options) {
    // Simple provider selection - can be enhanced with more sophisticated logic
    const availableProviders = Array.from(this.providers.values());
    
    if (availableProviders.length === 0) {
      return null;
    }

    // Prefer providers that haven't hit rate limits
    const nonRateLimitedProviders = availableProviders.filter(provider => 
      this.checkRateLimit(provider.name)
    );

    if (nonRateLimitedProviders.length > 0) {
      return nonRateLimitedProviders[0];
    }

    return availableProviders[0];
  }

  checkRateLimit(providerName) {
    const rateLimiter = this.rateLimiters.get(providerName);
    if (!rateLimiter) {
      return true; // No rate limiting configured
    }
    return rateLimiter.checkLimit();
  }

  generateCacheKey(query, options) {
    const keyData = {
      query: query.toLowerCase().trim(),
      options: JSON.stringify(options)
    };
    return btoa(JSON.stringify(keyData));
  }

  isCacheEnabled() {
    const webSearchConfig = this.config.get('webSearch');
    return webSearchConfig?.cache?.enabled !== false;
  }

  isCacheExpired(timestamp) {
    const webSearchConfig = this.config.get('webSearch');
    const ttl = webSearchConfig?.cache?.ttl || 3600000; // 1 hour default
    return Date.now() - timestamp > ttl;
  }

  cacheResults(key, results) {
    const webSearchConfig = this.config.get('webSearch');
    const maxSize = webSearchConfig?.cache?.maxSize || 1000;
    
    // Implement LRU cache eviction if needed
    if (this.searchCache.size >= maxSize) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    
    this.searchCache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.searchCache.clear();
    this.logger.info('Web search cache cleared');
  }

  getCacheStats() {
    return {
      size: this.searchCache.size,
      keys: Array.from(this.searchCache.keys())
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSearchAPI;
} else {
  window.WebSearchAPI = WebSearchAPI;
} 