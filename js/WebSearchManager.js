/**
 * Web Search Manager
 * High-level orchestration of web search with AI integration
 */
class WebSearchManager {
  constructor(config, logger, ollamaAPI) {
    this.config = config;
    this.logger = logger;
    this.webSearchAPI = new WebSearchAPI(config, logger);
    this.ollamaAPI = ollamaAPI;
    this.searchHistory = [];
  }

  async performAISearch(query, context = {}) {
    const startTime = performance.now();
    
    try {
      this.logger.info('Performing AI-enhanced web search', { query, context });
      
      // Perform web search
      const searchResults = await this.webSearchAPI.search(query, {
        maxResults: this.config.get('webSearch.ai.maxResultsToAnalyze') || 5
      });

      if (searchResults.length === 0) {
        return {
          query,
          results: [],
          analysis: 'No search results found for the given query.',
          timestamp: new Date()
        };
      }

      // Analyze results with AI
      const analysis = await this.analyzeSearchResults(query, searchResults, context);
      
      // Store in search history
      const searchRecord = {
        query,
        results: searchResults,
        analysis,
        timestamp: new Date(),
        context
      };
      
      this.addToSearchHistory(searchRecord);

      const duration = performance.now() - startTime;
      this.logger.logPerformance('AI-enhanced search', duration, { 
        query, 
        resultCount: searchResults.length 
      });

      return searchRecord;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('AI-enhanced search (failed)', duration, { query });
      this.logger.error('AI-enhanced search failed', error);
      throw error;
    }
  }

  async searchAndAnalyze(query, analysisPrompt = null) {
    const startTime = performance.now();
    
    try {
      this.logger.info('Performing search and analysis', { query, analysisPrompt });
      
      // Perform web search
      const searchResults = await this.webSearchAPI.search(query);
      
      if (searchResults.length === 0) {
        return {
          query,
          results: [],
          analysis: 'No search results found.',
          timestamp: new Date()
        };
      }

      // Use custom analysis prompt or default
      const prompt = analysisPrompt || this.config.get('webSearch.ai.analysisPrompt');
      const analysis = await this.analyzeSearchResults(query, searchResults, {}, prompt);
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Search and analysis', duration, { 
        query, 
        resultCount: searchResults.length 
      });

      return {
        query,
        results: searchResults,
        analysis,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Search and analysis (failed)', duration, { query });
      this.logger.error('Search and analysis failed', error);
      throw error;
    }
  }

  async analyzeSearchResults(query, results, context = {}, customPrompt = null) {
    try {
      // Prepare results for AI analysis
      const resultsText = this.formatResultsForAnalysis(results);
      
      // Create analysis prompt
      const basePrompt = customPrompt || this.config.get('webSearch.ai.analysisPrompt');
      const analysisPrompt = this.buildAnalysisPrompt(query, resultsText, context, basePrompt);
      
      // Get AI analysis
      const analysis = await this.ollamaAPI.chat([
        {
          role: 'system',
          content: 'You are a helpful AI assistant that analyzes web search results and provides insightful summaries and analysis.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ]);

      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze search results', error);
      return 'Unable to analyze search results due to an error.';
    }
  }

  formatResultsForAnalysis(results) {
    return results.map((result, index) => {
      return `${index + 1}. **${result.title}**
URL: ${result.url}
Snippet: ${result.snippet}
${result.content ? `Content: ${result.content.substring(0, 500)}...` : ''}
---`;
    }).join('\n\n');
  }

  buildAnalysisPrompt(query, resultsText, context, basePrompt) {
    let prompt = `${basePrompt}\n\n`;
    prompt += `Query: "${query}"\n\n`;
    
    if (context.selectedText) {
      prompt += `Context (selected text): "${context.selectedText}"\n\n`;
    }
    
    if (context.conversationHistory) {
      prompt += `Conversation context: ${context.conversationHistory}\n\n`;
    }
    
    prompt += `Search Results:\n${resultsText}\n\n`;
    prompt += `Please provide a comprehensive analysis of these search results, including:\n`;
    prompt += `1. Key insights and findings\n`;
    prompt += `2. Relevance to the query\n`;
    prompt += `3. Any patterns or trends identified\n`;
    prompt += `4. Recommendations or next steps\n`;
    prompt += `5. Limitations or gaps in the information\n\n`;
    prompt += `Analysis:`;
    
    return prompt;
  }

  async getSearchSuggestions(query) {
    return await this.webSearchAPI.getSearchSuggestions(query);
  }

  async extractContent(url) {
    return await this.webSearchAPI.extractContent(url);
  }

  addToSearchHistory(searchRecord) {
    const maxHistory = this.config.get('ui.maxConversationHistory') || 20;
    
    this.searchHistory.unshift(searchRecord);
    
    if (this.searchHistory.length > maxHistory) {
      this.searchHistory = this.searchHistory.slice(0, maxHistory);
    }
  }

  getSearchHistory() {
    return [...this.searchHistory];
  }

  clearSearchHistory() {
    this.searchHistory = [];
    this.logger.info('Search history cleared');
  }

  getSearchStats() {
    return {
      totalSearches: this.searchHistory.length,
      lastSearch: this.searchHistory[0]?.timestamp || null,
      cacheStats: this.webSearchAPI.getCacheStats()
    };
  }

  async performMultiProviderSearch(query, options = {}) {
    const startTime = performance.now();
    
    try {
      this.logger.info('Performing multi-provider search', { query, options });
      
      // Get all available providers
      const providers = Array.from(this.webSearchAPI.providers.values());
      const searchPromises = providers.map(provider => 
        provider.search(query, options).catch(error => {
          this.logger.warn(`Provider ${provider.name} search failed`, error);
          return [];
        })
      );
      
      // Execute searches in parallel
      const results = await Promise.all(searchPromises);
      
      // Merge and deduplicate results
      const mergedResults = this.mergeSearchResults(results);
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Multi-provider search', duration, { 
        query, 
        providerCount: providers.length,
        totalResults: mergedResults.length 
      });
      
      return mergedResults;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Multi-provider search (failed)', duration, { query });
      this.logger.error('Multi-provider search failed', error);
      throw error;
    }
  }

  mergeSearchResults(resultsArrays) {
    const seen = new Set();
    const merged = [];
    
    resultsArrays.flat().forEach(result => {
      const key = `${result.url}:${result.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      }
    });
    
    // Sort by relevance
    return merged.sort((a, b) => (b.metadata.relevance || 0) - (a.metadata.relevance || 0));
  }

  async searchWithFilters(query, filters = {}) {
    const startTime = performance.now();
    
    try {
      this.logger.info('Performing filtered search', { query, filters });
      
      // Apply filters to search options
      const searchOptions = {
        maxResults: filters.maxResults || 10,
        dateRange: filters.dateRange,
        language: filters.language,
        region: filters.region,
        safeSearch: filters.safeSearch
      };
      
      const results = await this.webSearchAPI.search(query, searchOptions);
      
      // Apply additional client-side filtering if needed
      let filteredResults = results;
      
      if (filters.contentType) {
        filteredResults = filteredResults.filter(result => 
          result.metadata.contentType === filters.contentType
        );
      }
      
      if (filters.minRelevance) {
        filteredResults = filteredResults.filter(result => 
          (result.metadata.relevance || 0) >= filters.minRelevance
        );
      }
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Filtered search', duration, { 
        query, 
        filters,
        resultCount: filteredResults.length 
      });
      
      return filteredResults;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.logPerformance('Filtered search (failed)', duration, { query, filters });
      this.logger.error('Filtered search failed', error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSearchManager;
} else {
  window.WebSearchManager = WebSearchManager;
} 