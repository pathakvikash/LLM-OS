/**
 * Bing Search Provider
 * Uses Bing Web Search API (requires API key)
 */
class BingSearch extends BaseSearchProvider {
  constructor(name, config, logger) {
    super(name, config, logger);
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.bing.microsoft.com/v7.0/search';
  }

  async search(query, options = {}) {
    const startTime = performance.now();
    const validatedQuery = this.validateQuery(query);
    
    if (!this.apiKey) {
      throw new Error('Bing Search requires API key');
    }
    
    try {
      this.logger.info(`Searching Bing for: ${validatedQuery}`);
      
      const results = await this.performSearch(validatedQuery, options);
      
      const duration = performance.now() - startTime;
      this.logSearch(validatedQuery, results.length, duration);
      
      return results;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logError(error, { query: validatedQuery, duration });
      throw error;
    }
  }

  async performSearch(query, options) {
    const params = new URLSearchParams({
      q: query,
      count: options.maxResults || 10,
      mkt: 'en-US'
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Bing Search API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseSearchResponse(data);
  }

  parseSearchResponse(data) {
    const results = [];
    
    if (data.webPages && data.webPages.value && Array.isArray(data.webPages.value)) {
      data.webPages.value.forEach(item => {
        results.push({
          title: item.name || '',
          url: item.url || '',
          snippet: item.snippet || '',
          content: item.snippet || '',
          relevance: 0.8,
          language: 'en'
        });
      });
    }

    return this.normalizeResults(results);
  }

  async getSuggestions(query) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Bing doesn't provide a public suggestions API
      // This would require additional implementation
      return [];
    } catch (error) {
      this.logger.error('Failed to get suggestions', error);
      return [];
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BingSearch;
} else {
  window.BingSearch = BingSearch;
} 