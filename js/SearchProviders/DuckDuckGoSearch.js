/**
 * DuckDuckGo Search Provider
 * Uses DuckDuckGo Instant Answer API (no API key required)
 */
class DuckDuckGoSearch extends BaseSearchProvider {
  constructor(name, config, logger) {
    super(name, config, logger);
    this.baseUrl = '/api/web-search/search/duckduckgo';
  }

  async search(query, options = {}) {
    const startTime = performance.now();
    const validatedQuery = this.validateQuery(query);
    
    try {
      this.logger.info(`Searching DuckDuckGo for: ${validatedQuery}`);
      
      // Use backend proxy to avoid CORS issues
      const results = await this.searchViaProxy(validatedQuery, options);
      
      const duration = performance.now() - startTime;
      this.logSearch(validatedQuery, results.length, duration);
      
      return results;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logError(error, { query: validatedQuery, duration });
      throw error;
    }
  }

  async searchViaProxy(query, options) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search error: ${response.status}`);
    }

    const data = await response.json();
    return this.normalizeResults(data.results || []);
  }

  async getSuggestions(query) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // DuckDuckGo doesn't have a public suggestions API
      // Return basic suggestions based on query patterns
      const suggestions = [];
      
      // Add common search patterns
      if (query.toLowerCase().includes('how to')) {
        suggestions.push(`${query} step by step`);
        suggestions.push(`${query} tutorial`);
      }
      
      if (query.toLowerCase().includes('what is')) {
        suggestions.push(`${query} definition`);
        suggestions.push(`${query} meaning`);
      }
      
      if (query.toLowerCase().includes('best')) {
        suggestions.push(`${query} 2024`);
        suggestions.push(`${query} reviews`);
      }
      
      // Add generic suggestions
      suggestions.push(`${query} examples`);
      suggestions.push(`${query} guide`);
      
      return suggestions.slice(0, 5); // Limit to 5 suggestions
    } catch (error) {
      this.logger.error('Failed to get suggestions', error);
      return [];
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DuckDuckGoSearch;
} else {
  window.DuckDuckGoSearch = DuckDuckGoSearch;
} 