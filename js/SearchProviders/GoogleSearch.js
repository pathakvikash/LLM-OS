/**
 * Google Search Provider
 * Uses Google Custom Search API (requires API key and Search Engine ID)
 */
class GoogleSearch extends BaseSearchProvider {
  constructor(name, config, logger) {
    super(name, config, logger);
    this.apiKey = config.apiKey;
    this.searchEngineId = config.searchEngineId;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  async search(query, options = {}) {
    const startTime = performance.now();
    const validatedQuery = this.validateQuery(query);
    
    if (!this.apiKey || !this.searchEngineId) {
      throw new Error('Google Search requires API key and Search Engine ID');
    }
    
    try {
      this.logger.info(`Searching Google for: ${validatedQuery}`);
      
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
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: options.maxResults || 10
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseSearchResponse(data);
  }

  parseSearchResponse(data) {
    const results = [];
    
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        results.push({
          title: item.title || '',
          url: item.link || '',
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
      // Google doesn't provide a public suggestions API
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
  module.exports = GoogleSearch;
} else {
  window.GoogleSearch = GoogleSearch;
} 