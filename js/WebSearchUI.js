/**
 * Web Search UI
 * User interface components for web search functionality
 */
class WebSearchUI {
  constructor(config, logger, webSearchManager) {
    this.config = config;
    this.logger = logger;
    this.webSearchManager = webSearchManager;
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.createSearchInterface();
      this.bindEvents();
      this.isInitialized = true;
      this.logger.info('Web Search UI initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Web Search UI', error);
    }
  }

  createSearchInterface() {
    // Add search bar to chat input area
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (!chatInputContainer) {
      this.logger.warn('Chat input container not found');
      return;
    }

    // Create search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'web-search-bar';
    searchBar.innerHTML = `
      <div class="search-input-container">
        <input type="text" id="webSearchInput" placeholder="🔍 Search the web..." class="search-input">
        <button id="webSearchButton" class="search-button" title="Search the web">🔍</button>
        <button id="webSearchSuggestionsButton" class="suggestions-button" title="Get suggestions">💡</button>
      </div>
      <div id="searchSuggestions" class="search-suggestions" style="display: none;"></div>
    `;

    // Insert before chat input
    chatInputContainer.insertBefore(searchBar, chatInputContainer.firstChild);

    // Add CSS styles
    this.addStyles();
  }

  addStyles() {
    const styleId = 'web-search-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .web-search-bar {
        margin-bottom: 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #f9f9f9;
        padding: 8px;
      }

      .search-input-container {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .search-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }

      .search-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
      }

      .search-button, .suggestions-button {
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .search-button:hover, .suggestions-button:hover {
        background: #f0f0f0;
        border-color: #999;
      }

      .search-button:active, .suggestions-button:active {
        background: #e0e0e0;
      }

      .search-suggestions {
        margin-top: 8px;
        border-top: 1px solid #ddd;
        padding-top: 8px;
      }

      .suggestion-item {
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 4px;
        margin-bottom: 2px;
        font-size: 13px;
        color: #666;
      }

      .suggestion-item:hover {
        background: #e9ecef;
        color: #333;
      }

      .search-results {
        margin-top: 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: white;
        max-height: 300px;
        overflow-y: auto;
      }

      .search-result-item {
        padding: 12px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
      }

      .search-result-item:last-child {
        border-bottom: none;
      }

      .search-result-item:hover {
        background: #f8f9fa;
      }

      .search-result-title {
        font-weight: bold;
        color: #1a0dab;
        margin-bottom: 4px;
        font-size: 14px;
      }

      .search-result-url {
        color: #006621;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .search-result-snippet {
        color: #545454;
        font-size: 13px;
        line-height: 1.4;
      }

      .search-loading {
        text-align: center;
        padding: 20px;
        color: #666;
      }

      .search-error {
        color: #dc3545;
        padding: 10px;
        text-align: center;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  bindEvents() {
    const searchInput = document.getElementById('webSearchInput');
    const searchButton = document.getElementById('webSearchButton');
    const suggestionsButton = document.getElementById('webSearchSuggestionsButton');
    const suggestionsContainer = document.getElementById('searchSuggestions');

    if (!searchInput || !searchButton || !suggestionsButton) {
      this.logger.warn('Search UI elements not found');
      return;
    }

    // Search button click
    searchButton.addEventListener('click', () => {
      this.performSearch();
    });

    // Enter key in search input
    searchInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.performSearch();
      }
    });

    // Suggestions button click
    suggestionsButton.addEventListener('click', () => {
      this.toggleSuggestions();
    });

    // Input change for suggestions
    let suggestionTimeout;
    searchInput.addEventListener('input', (event) => {
      clearTimeout(suggestionTimeout);
      const query = event.target.value.trim();
      
      if (query.length >= 2) {
        suggestionTimeout = setTimeout(() => {
          this.getSuggestions(query);
        }, 300);
      } else {
        this.hideSuggestions();
      }
    });

    // Click outside to hide suggestions
    document.addEventListener('click', (event) => {
      if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        this.hideSuggestions();
      }
    });
  }

  async performSearch() {
    const searchInput = document.getElementById('webSearchInput');
    const query = searchInput.value.trim();

    if (!query) {
      return;
    }

    try {
      this.showLoading();
      
      // Perform AI-enhanced search
      const results = await this.webSearchManager.performAISearch(query, {
        selectedText: this.getSelectedText()
      });

      this.displaySearchResults(results);
      this.hideSuggestions();
      
    } catch (error) {
      this.logger.error('Search failed', error);
      this.showError('Search failed: ' + error.message);
    }
  }

  async getSuggestions(query) {
    try {
      const suggestions = await this.webSearchManager.getSearchSuggestions(query);
      this.displaySuggestions(suggestions);
    } catch (error) {
      this.logger.error('Failed to get suggestions', error);
    }
  }

  displaySuggestions(suggestions) {
    const container = document.getElementById('searchSuggestions');
    if (!container) return;

    if (suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = suggestions.map(suggestion => 
      `<div class="suggestion-item" onclick="webSearchUI.selectSuggestion('${suggestion}')">${suggestion}</div>`
    ).join('');
    
    container.style.display = 'block';
  }

  selectSuggestion(suggestion) {
    const searchInput = document.getElementById('webSearchInput');
    if (searchInput) {
      searchInput.value = suggestion;
      this.performSearch();
    }
  }

  hideSuggestions() {
    const container = document.getElementById('searchSuggestions');
    if (container) {
      container.style.display = 'none';
    }
  }

  toggleSuggestions() {
    const container = document.getElementById('searchSuggestions');
    if (container) {
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
  }

  displaySearchResults(searchRecord) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const { query, results, analysis } = searchRecord;

    // Create results HTML
    let resultsHTML = `
      <div class="search-results">
        <div style="padding: 12px; background: #f8f9fa; border-bottom: 1px solid #ddd;">
          <strong>🔍 Web Search Results for: "${query}"</strong>
        </div>
    `;

    if (results.length === 0) {
      resultsHTML += '<div class="search-loading">No results found</div>';
    } else {
      results.forEach((result, index) => {
        resultsHTML += `
          <div class="search-result-item" onclick="webSearchUI.openResult('${result.url}')">
            <div class="search-result-title">${result.title}</div>
            <div class="search-result-url">${result.url}</div>
            <div class="search-result-snippet">${result.snippet}</div>
          </div>
        `;
      });
    }

    resultsHTML += '</div>';

    // Add AI analysis
    if (analysis) {
      resultsHTML += `
        <div style="margin-top: 10px; padding: 12px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
          <strong>🤖 AI Analysis:</strong><br>
          ${analysis}
        </div>
      `;
    }

    // Add to chat
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fade-in';
    messageDiv.innerHTML = resultsHTML;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  showLoading() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'searchLoading';
    loadingDiv.className = 'search-loading fade-in';
    loadingDiv.innerHTML = '🔍 Searching the web...';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  showError(message) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    // Remove loading indicator
    const loadingDiv = document.getElementById('searchLoading');
    if (loadingDiv) {
      loadingDiv.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'search-error fade-in';
    errorDiv.innerHTML = message;
    chatBox.appendChild(errorDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  openResult(url) {
    if (url) {
      window.open(url, '_blank');
    }
  }

  getSelectedText() {
    const selection = window.getSelection();
    return selection.toString().trim();
  }

  // Public methods for external access
  search(query) {
    const searchInput = document.getElementById('webSearchInput');
    if (searchInput) {
      searchInput.value = query;
      this.performSearch();
    }
  }

  clearSearch() {
    const searchInput = document.getElementById('webSearchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    this.hideSuggestions();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSearchUI;
} else {
  window.WebSearchUI = WebSearchUI;
} 